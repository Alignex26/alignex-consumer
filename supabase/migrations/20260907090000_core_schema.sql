-- =============================================================
-- Core schema reconciliation.
--
-- WHY THIS EXISTS
--
-- 20260906131226_initial_schema.sql was committed empty (0 bytes, confirmed in
-- git history), so the repository has never described the schema it depends
-- on. The tables were created out-of-band and the catalogue is seeded — the
-- live database holds 5 transitions, 16 catalogue sessions and 16 segments —
-- but none of that shape is in version control.
--
-- This migration reconciles the two. It is written against the schema as it
-- actually is, verified by introspection, not against what the empty file
-- implies. It is additive and idempotent throughout: every table already
-- present is left exactly as it is, and only missing pieces are added.
--
-- WHAT IT ACTUALLY CHANGES ON THE LIVE DATABASE
--
--   1. Adds read policies to the catalogue tables. This is the important one.
--      RLS is enabled on `transitions`, `sessions_catalogue` and
--      `session_segments` with no policy granting `anon` or `authenticated`
--      SELECT, so the app reads zero rows from a catalogue that is fully
--      populated, and every session selection fails as `none_eligible`.
--
--   2. Extends `user_sessions` with the columns the product now needs.
--      `user_sessions` is the existing session-run entity and is REUSED — a
--      separate `session_runs` table would be a duplicate of the same concept.
--
--   3. Creates `session_outcomes`, which has no existing equivalent.
--
-- `safety_events` is deliberately untouched: it exists, holds rows, and its
-- timestamp column is `occurred_at`. The Edge Function inserts only `user_id`.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. Catalogue tables.
--
-- These all exist on the live database, so every statement here is a no-op
-- against it. They are written out so that a database created from these
-- migrations alone lands in the same place, which is not true today.
-- -------------------------------------------------------------

create table if not exists transitions (
    key           text primary key,
    state_from    text        not null,
    state_to      text        not null,
    direction     text        not null,
    display_name  text        not null,
    is_active     boolean     not null default true
);

create table if not exists sessions_catalogue (
    id                   uuid primary key default gen_random_uuid(),
    transition_key       text     not null references transitions (key) on delete restrict,
    duration_seconds     integer  not null,
    intensity            smallint not null,
    requires_headphones  boolean  not null default false,
    is_active            boolean  not null default true,
    unique (transition_key, duration_seconds)
);

create table if not exists session_segments (
    id                uuid primary key default gen_random_uuid(),
    session_id        uuid    not null references sessions_catalogue (id) on delete cascade,
    ordinal           integer not null,
    storage_path      text    not null,
    duration_seconds  integer not null,
    unique (session_id, ordinal)
);

-- Contentless by design: a timestamp and, if the person happens to be signed
-- in, who. No category, no classification, no text. Never edited here.
create table if not exists safety_events (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users (id) on delete set null,
    occurred_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2. Session runs.
--
-- `user_sessions` already exists with: id, user_id, session_id,
-- transition_key, state_current, state_target, context_tag, started_at,
-- completed_at, completed. The columns below are what the product needs on top
-- of that, added individually so an existing table is extended rather than
-- replaced.
--
-- `completed` and `completed_at` are left in place and kept in step by the
-- app, so anything already reading them continues to work.
-- -------------------------------------------------------------

create table if not exists user_sessions (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid references auth.users (id) on delete cascade,
    session_id      uuid references sessions_catalogue (id) on delete restrict,
    transition_key  text references transitions (key) on delete restrict,
    state_current   text,
    state_target    text,
    context_tag     text,
    started_at      timestamptz not null default now(),
    completed_at    timestamptz,
    completed       boolean     not null default false
);

-- How long the chosen session was, so outcomes can be compared by length.
alter table user_sessions add column if not exists duration_seconds integer;

-- How the transition was arrived at, so a corrected run can be told apart from
-- an interpreted one when looking at what works.
alter table user_sessions add column if not exists origin text
    default 'interpreted';

-- `completed` is a boolean and cannot express "ended early", which is a
-- measurement rather than a failure and has to be distinguishable.
alter table user_sessions add column if not exists status text
    default 'started';

-- How far the person actually got.
alter table user_sessions add column if not exists elapsed_seconds integer
    default 0;

alter table user_sessions add column if not exists ended_at timestamptz;

-- Constraints are added separately and guarded: adding them inline above would
-- do nothing on the existing table, since the columns are added by ALTER.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'user_sessions_origin_check') then
        alter table user_sessions add constraint user_sessions_origin_check
            check (origin is null or origin in ('interpreted', 'corrected', 'picker', 'quick_return'));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'user_sessions_status_check') then
        alter table user_sessions add constraint user_sessions_status_check
            check (status is null or status in ('started', 'completed', 'ended_early', 'abandoned'));
    end if;
end $$;

-- -------------------------------------------------------------
-- 3. Outcomes. No existing equivalent.
--
-- Controlled values only, never presentation text. One row per run: recording
-- an outcome twice updates rather than duplicating, which the unique
-- constraint on `run_id` enforces.
-- -------------------------------------------------------------

create table if not exists session_outcomes (
    id           uuid primary key default gen_random_uuid(),
    run_id       uuid        not null unique references user_sessions (id) on delete cascade,
    user_id      uuid references auth.users (id) on delete cascade,
    outcome      text        not null check (outcome in ('yes', 'partly', 'not_really')),
    -- One optional extra signal. A controlled code, never a diary entry.
    detail_code  text,
    created_at   timestamptz not null default now()
);

create index if not exists session_outcomes_user_idx
    on session_outcomes (user_id, created_at desc);

-- -------------------------------------------------------------
-- 4. Row level security.
--
-- The catalogue is product content, not personal data, and is readable by
-- anyone who can reach the API. Everything personal is readable and writable
-- only by its owner.
--
-- `safety_events` deliberately gets NO client policy at all: the Edge Function
-- writes it with the service role, which bypasses RLS, and nothing client-side
-- may read or write it.
-- -------------------------------------------------------------

alter table transitions        enable row level security;
alter table sessions_catalogue enable row level security;
alter table session_segments   enable row level security;
alter table safety_events      enable row level security;
alter table user_sessions      enable row level security;
alter table session_outcomes   enable row level security;

do $$
begin
    -- --- Catalogue: readable. This is what unblocks session selection. ---
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'transitions'
                     and policyname = 'transitions_readable') then
        create policy transitions_readable on transitions
            for select to anon, authenticated using (is_active);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'sessions_catalogue'
                     and policyname = 'catalogue_readable') then
        create policy catalogue_readable on sessions_catalogue
            for select to anon, authenticated using (is_active);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'session_segments'
                     and policyname = 'segments_readable') then
        create policy segments_readable on session_segments
            for select to anon, authenticated using (true);
    end if;

    -- --- Runs: owner only. ---
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'user_sessions'
                     and policyname = 'user_sessions_own_select') then
        create policy user_sessions_own_select on user_sessions
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'user_sessions'
                     and policyname = 'user_sessions_own_insert') then
        create policy user_sessions_own_insert on user_sessions
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'user_sessions'
                     and policyname = 'user_sessions_own_update') then
        create policy user_sessions_own_update on user_sessions
            for update to authenticated using (auth.uid() = user_id);
    end if;

    -- --- Outcomes: owner only. ---
    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'session_outcomes'
                     and policyname = 'outcomes_own_select') then
        create policy outcomes_own_select on session_outcomes
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'session_outcomes'
                     and policyname = 'outcomes_own_insert') then
        create policy outcomes_own_insert on session_outcomes
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies
                   where schemaname = 'public' and tablename = 'session_outcomes'
                     and policyname = 'outcomes_own_update') then
        create policy outcomes_own_update on session_outcomes
            for update to authenticated using (auth.uid() = user_id);
    end if;
end $$;
