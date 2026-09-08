-- ELSEA Session Engine.
--
-- Sessions become COMPOSED rather than stored. The existing catalogue tables
-- are left untouched and still serve the live path: retiring them before the
-- module library has any audio in it would leave no playable session at all.
-- See docs/session-engine.md.
--
-- The structural difference from `session_segments`: a module belongs to no
-- session. `session_segments.session_id` is a cascade-owned FK, so those rows
-- can never be shared between sessions. These can.

-- ---------------------------------------------------------------------------
-- The library
-- ---------------------------------------------------------------------------

create table if not exists intervention_modules (
    id                   uuid primary key default gen_random_uuid(),
    -- Stable, human-readable, quoted in manifests and support tickets.
    module_key           text     not null unique,
    family               text     not null
        check (family in ('regulation', 'cognitive', 'activation', 'transition', 'bed')),
    -- A slot in the taxonomy. The clinical CONTENT that fills it is authored
    -- and approved outside engineering (S4).
    technique_key        text     not null,
    storage_path         text     not null,
    duration_seconds     integer  not null check (duration_seconds > 0),
    intensity            smallint not null check (intensity between 1 and 10),
    requires_headphones  boolean  not null default false,
    -- Beds are background layers, played under foreground modules.
    is_bed               boolean  not null default false,
    -- Nothing unapproved may ever be composed into a session.
    approved             boolean  not null default false,
    version              integer  not null default 1,
    is_active            boolean  not null default true,
    created_at           timestamptz not null default now()
);

-- Which (transition, phase) slots a module is allowed to serve. Explicit
-- rather than inferred, so a module cannot drift into a recipe it was never
-- approved for.
create table if not exists module_affinities (
    module_id       uuid not null references intervention_modules (id) on delete cascade,
    transition_key  text not null references transitions (key) on delete restrict,
    phase           text not null,
    primary key (module_id, transition_key, phase)
);

create index if not exists module_affinities_lookup_idx
    on module_affinities (transition_key, phase);

-- ---------------------------------------------------------------------------
-- Recipe phase structure (P19)
--
-- Persisted here rather than living only in conversation. `is_provisional`
-- carries S14 forward: the drafted floors are provisional pending clinical
-- review, and must not quietly harden into settled numbers.
-- ---------------------------------------------------------------------------

create table if not exists recipe_phases (
    transition_key  text    not null references transitions (key) on delete cascade,
    ordinal         integer not null,
    phase           text    not null,
    min_seconds     integer not null check (min_seconds >= 0),
    max_seconds     integer not null,
    is_provisional  boolean not null default true,
    primary key (transition_key, ordinal),
    check (max_seconds >= min_seconds)
);

-- ---------------------------------------------------------------------------
-- Effectiveness (Rule 8)
--
-- Personalisation is data, not a bigger prompt. A tally, not a model: the
-- reason a module was chosen must be explainable in one sentence.
-- ---------------------------------------------------------------------------

create table if not exists module_effectiveness (
    user_id     uuid        not null references auth.users (id) on delete cascade,
    module_id   uuid        not null references intervention_modules (id) on delete cascade,
    positive    integer     not null default 0 check (positive >= 0),
    total       integer     not null default 0 check (total >= 0),
    updated_at  timestamptz not null default now(),
    primary key (user_id, module_id),
    check (positive <= total)
);

-- ---------------------------------------------------------------------------
-- Generated speech cache (Rule 9)
--
-- Three scopes. `cache_key` is DERIVED from structured state and never from
-- user text — otherwise this table becomes a store of what people wrote (S3).
--
--   global    — reusable by anyone; user_id null
--   situation — common structured contexts; user_id null
--   personal  — one person's segment; user_id set
--
-- Write-through: a row is inserted when generation succeeds, before playback,
-- so a retried or replayed session never pays for the same characters twice.
-- TTS bills on characters submitted, including output later discarded.
-- ---------------------------------------------------------------------------

create table if not exists generated_segments (
    id                uuid        primary key default gen_random_uuid(),
    scope             text        not null check (scope in ('global', 'situation', 'personal')),
    cache_key         text        not null,
    user_id           uuid        references auth.users (id) on delete cascade,
    storage_path      text        not null,
    -- Actual spend is measured from this, never estimated from a spreadsheet.
    character_count   integer     not null check (character_count > 0),
    duration_seconds  integer     not null check (duration_seconds > 0),
    provider          text        not null,
    voice             text        not null,
    created_at        timestamptz not null default now(),
    last_used_at      timestamptz,
    use_count         integer     not null default 0,
    -- Personal segments belong to someone; shared ones must not.
    check (
        (scope = 'personal' and user_id is not null)
        or (scope <> 'personal' and user_id is null)
    )
);

-- Postgres treats NULLs as distinct, so a plain unique constraint would let
-- duplicate global rows through. Two partial indexes instead.
create unique index if not exists generated_segments_shared_key_idx
    on generated_segments (scope, cache_key) where user_id is null;

create unique index if not exists generated_segments_personal_key_idx
    on generated_segments (scope, cache_key, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- Manifests
-- ---------------------------------------------------------------------------

create table if not exists session_manifests (
    id                uuid        primary key default gen_random_uuid(),
    user_id           uuid        references auth.users (id) on delete cascade,
    transition_key    text        not null references transitions (key) on delete restrict,
    duration_seconds  integer     not null check (duration_seconds > 0),
    recipe_version    integer     not null default 1,
    -- Budget audit. Rule 4 is enforced at composition; this records what was
    -- actually spent so drift is visible in data, not just in code review.
    dynamic_seconds   integer     not null default 0 check (dynamic_seconds >= 0),
    created_at        timestamptz not null default now()
);

create index if not exists session_manifests_user_idx
    on session_manifests (user_id, created_at desc);

create table if not exists manifest_segments (
    manifest_id       uuid    not null references session_manifests (id) on delete cascade,
    ordinal           integer not null,
    kind              text    not null check (kind in ('module', 'generated', 'silence')),
    module_id         uuid    references intervention_modules (id) on delete restrict,
    generated_id      uuid    references generated_segments (id) on delete restrict,
    -- Beds play under foreground segments; offset positions a segment within
    -- the composition rather than assuming it starts when the last one ended.
    layer             text    not null default 'foreground'
        check (layer in ('foreground', 'bed')),
    offset_seconds    integer not null default 0 check (offset_seconds >= 0),
    duration_seconds  integer not null check (duration_seconds > 0),
    primary key (manifest_id, layer, ordinal),
    -- Each kind carries exactly the reference it needs and no other. Silence
    -- (S15) is composed, never baked into an audio file.
    check (
        (kind = 'module'    and module_id is not null and generated_id is null)
     or (kind = 'generated' and generated_id is not null and module_id is null)
     or (kind = 'silence'   and module_id is null and generated_id is null)
    )
);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Library and recipe structure are readable like the catalogue. Everything
-- carrying a person is restricted to that person. Not weakened for
-- development convenience.
-- ---------------------------------------------------------------------------

alter table intervention_modules  enable row level security;
alter table module_affinities     enable row level security;
alter table recipe_phases         enable row level security;
alter table module_effectiveness  enable row level security;
alter table generated_segments    enable row level security;
alter table session_manifests     enable row level security;
alter table manifest_segments     enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'modules_readable') then
        create policy modules_readable on intervention_modules
            for select to anon, authenticated using (is_active and approved);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'affinities_readable') then
        create policy affinities_readable on module_affinities
            for select to anon, authenticated using (true);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'recipe_phases_readable') then
        create policy recipe_phases_readable on recipe_phases
            for select to anon, authenticated using (true);
    end if;

    -- Effectiveness: own rows only, read and write.
    if not exists (select 1 from pg_policies where policyname = 'effectiveness_own_select') then
        create policy effectiveness_own_select on module_effectiveness
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'effectiveness_own_insert') then
        create policy effectiveness_own_insert on module_effectiveness
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'effectiveness_own_update') then
        create policy effectiveness_own_update on module_effectiveness
            for update to authenticated using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    -- Shared generated speech is readable by anyone; personal only by its owner.
    if not exists (select 1 from pg_policies where policyname = 'generated_shared_readable') then
        create policy generated_shared_readable on generated_segments
            for select to anon, authenticated using (user_id is null);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'generated_own_readable') then
        create policy generated_own_readable on generated_segments
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'manifests_own_select') then
        create policy manifests_own_select on session_manifests
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'manifests_own_insert') then
        create policy manifests_own_insert on session_manifests
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'manifest_segments_own_select') then
        create policy manifest_segments_own_select on manifest_segments
            for select to authenticated using (
                exists (
                    select 1 from session_manifests m
                    where m.id = manifest_segments.manifest_id
                      and m.user_id = auth.uid()
                )
            );
    end if;

    if not exists (select 1 from pg_policies where policyname = 'manifest_segments_own_insert') then
        create policy manifest_segments_own_insert on manifest_segments
            for insert to authenticated with check (
                exists (
                    select 1 from session_manifests m
                    where m.id = manifest_segments.manifest_id
                      and m.user_id = auth.uid()
                )
            );
    end if;
end $$;
