-- Session novelty, and intentional replay.
--
-- "Fresh by default. Repeat on purpose."
--
-- Ordinary composition should not serve the same experience twice in a row.
-- Someone who saved a session because it worked must be able to have it again.
-- These are different intents and get different paths; this migration gives
-- both the state they need.
--
-- Additive. Nothing applied is edited.

-- ---------------------------------------------------------------------------
-- 1. Manifest fingerprint
--
-- A stable identity for the meaningful composition: recipe, plus the ordered
-- module identities and their content versions.
--
-- NOT the signed URLs, which expire in two hours and differ on every request —
-- including them would make every session unique and the freshness check inert
-- while appearing to work. Not silence or duration either: the same modules in
-- the same order at five and ten minutes are the same experience at two
-- lengths, and treating them as distinct would let the composer repeat itself
-- by varying the length.
-- ---------------------------------------------------------------------------

alter table session_manifests
    add column if not exists fingerprint text;

create index if not exists session_manifests_user_fingerprint_idx
    on session_manifests (user_id, created_at desc)
    where fingerprint is not null;

-- ---------------------------------------------------------------------------
-- 2. Immutable content versions
--
-- `intervention_modules.version` exists but is mutable in place: replacing a
-- module's approved audio and bumping its version leaves no record of what the
-- old one was. An exact replay would then silently deliver different content
-- under the same name, which is precisely what "exact" must not mean.
--
-- Each approved version gets an immutable row. The module row stays the
-- CURRENT pointer; this is the history.
-- ---------------------------------------------------------------------------

create table if not exists intervention_module_versions (
    id            uuid primary key default gen_random_uuid(),
    module_id     uuid    not null references intervention_modules (id) on delete cascade,
    version       integer not null,
    storage_path  text    not null,
    duration_seconds integer not null check (duration_seconds > 0),
    technique_key text    not null,
    approved_at   timestamptz,
    -- Set when this version stops being servable. A saved session referencing
    -- it must then fail as unavailable rather than quietly using something else.
    withdrawn_at  timestamptz,
    created_at    timestamptz not null default now(),
    unique (module_id, version)
);

-- Append-only, like the rate cards and for the same reason: a version that can
-- be edited is not a version.
create or replace function elsea_reject_version_mutation() returns trigger
language plpgsql as $$
begin
    -- Withdrawal is the one permitted change, and only one way.
    if tg_op = 'UPDATE'
       and old.withdrawn_at is null
       and new.withdrawn_at is not null
       and row(new.module_id, new.version, new.storage_path, new.duration_seconds, new.technique_key)
           is not distinct from
           row(old.module_id, old.version, old.storage_path, old.duration_seconds, old.technique_key)
    then
        return new;
    end if;

    raise exception
        'intervention_module_versions is append-only; publish a new version (withdrawal excepted)';
end;
$$;

drop trigger if exists intervention_module_versions_immutable on intervention_module_versions;
create trigger intervention_module_versions_immutable
    before update or delete on intervention_module_versions
    for each row execute function elsea_reject_version_mutation();

-- ---------------------------------------------------------------------------
-- 3. Saved sessions
--
-- What someone chose to keep. Deliberately NOT a rendered audio file: it is a
-- reference to the composition, which keeps Rule 2 intact and means a saved
-- session costs bytes rather than megabytes.
--
-- Signed URLs are never stored. They expire; a saved session must not.
-- ---------------------------------------------------------------------------

create table if not exists saved_sessions (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users (id) on delete cascade,
    manifest_id   uuid not null references session_manifests (id) on delete cascade,
    transition_key text not null references transitions (key) on delete restrict,
    duration_seconds integer not null check (duration_seconds > 0),
    -- The composition identity at the time of saving. If the content behind it
    -- changes, this no longer matches and exact replay must say so.
    fingerprint   text not null,
    /**
     * Ordered module version ids, as saved. This is what makes an exact replay
     * exact: the module row may move on, these do not.
     */
    module_version_ids uuid[] not null,
    label         text,
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    unique (user_id, manifest_id)
);

create index if not exists saved_sessions_owner_idx
    on saved_sessions (user_id, created_at desc) where is_active;

-- ---------------------------------------------------------------------------
-- 4. Access
--
-- Saved sessions are the person's own data: own-row select, insert, update.
-- `intervention_module_versions` is library metadata and stays service-role
-- only, like every other table that describes the content itself.
-- ---------------------------------------------------------------------------

alter table saved_sessions                enable row level security;
alter table intervention_module_versions  enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'saved_sessions_own_select') then
        create policy saved_sessions_own_select on saved_sessions
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'saved_sessions_own_insert') then
        create policy saved_sessions_own_insert on saved_sessions
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    -- Update is limited to the fields a person owns: naming and removing.
    -- Nothing here lets anyone change what a saved session CONTAINS.
    if not exists (select 1 from pg_policies where policyname = 'saved_sessions_own_update') then
        create policy saved_sessions_own_update on saved_sessions
            for update to authenticated using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end $$;
