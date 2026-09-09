-- Content ingestion hardening, and atomic manifest persistence.
--
-- Two things the functional build needs before real content arrives:
--   1. the database refusing a module that points anywhere but the private
--      bucket, so a mistake in an import script cannot make one selectable;
--   2. manifest persistence that cannot leave a half-written graph behind.
--
-- Additive. Nothing applied is edited.

-- ---------------------------------------------------------------------------
-- 1. `storage_path` must be a private-bucket object key
--
-- The composer signs paths against `intervention-audio`. Nothing stops a row
-- holding an absolute URL to somewhere public, and such a module would be
-- selectable, playable and quietly outside the private-audio guarantee.
--
-- A bare object key is required: no scheme, no host, no leading slash, no
-- traversal. `modules/<family>/<key>.m4a` per the audio production spec.
-- ---------------------------------------------------------------------------

alter table intervention_modules
    drop constraint if exists intervention_modules_storage_path_check;

alter table intervention_modules
    add constraint intervention_modules_storage_path_check
    check (
        storage_path ~ '^modules/[a-z]+/[a-z0-9_]+\.m4a$'
    );

-- ---------------------------------------------------------------------------
-- 2. Approval provenance
--
-- `approved` is the clinical gate and carried no record of when it was set.
-- For a gate whose whole purpose is that a human passed it, "when" is the
-- minimum audit trail. Nullable, so existing rows and un-approved drafts are
-- unaffected, and deliberately NOT a foreign key to a user: who may approve is
-- a product decision that has not been made.
-- ---------------------------------------------------------------------------

alter table intervention_modules
    add column if not exists approved_at timestamptz;

alter table intervention_modules
    add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 3. Atomic manifest persistence
--
-- The composer wrote the manifest, then its segments, and deleted the manifest
-- by hand if the segments failed. That compensating delete is itself a write
-- that can fail — a dropped connection between the two leaves an orphan
-- manifest with no segments, which `user_sessions.manifest_id` may already
-- point at.
--
-- One function, one transaction. Postgres either commits both or neither.
--
-- SECURITY: `security definer` with a pinned `search_path`, and NOT granted to
-- anon or authenticated. Only the service role may call it, which means only
-- the composer. Without the pinned path a caller could shadow `public` and
-- have this run against their own tables with the definer's rights.
-- ---------------------------------------------------------------------------

create or replace function persist_session_manifest(
    p_user_id uuid,
    p_transition_key text,
    p_duration_seconds integer,
    p_recipe_version integer,
    p_dynamic_seconds integer,
    p_segments jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_manifest_id uuid;
begin
    if p_user_id is null then
        raise exception 'persist_session_manifest requires a user';
    end if;

    if p_segments is null or jsonb_array_length(p_segments) = 0 then
        raise exception 'refusing to persist a manifest with no segments';
    end if;

    insert into session_manifests (
        user_id, transition_key, duration_seconds, recipe_version, dynamic_seconds
    ) values (
        p_user_id, p_transition_key, p_duration_seconds, p_recipe_version, p_dynamic_seconds
    )
    returning id into v_manifest_id;

    insert into manifest_segments (
        manifest_id, ordinal, kind, module_id, generated_id,
        layer, offset_seconds, duration_seconds
    )
    select
        v_manifest_id,
        (seg ->> 'ordinal')::integer,
        seg ->> 'kind',
        nullif(seg ->> 'module_id', '')::uuid,
        nullif(seg ->> 'generated_id', '')::uuid,
        coalesce(seg ->> 'layer', 'foreground'),
        (seg ->> 'offset_seconds')::integer,
        (seg ->> 'duration_seconds')::integer
    from jsonb_array_elements(p_segments) as seg;

    -- Any constraint violation above raises, the transaction rolls back, and
    -- the manifest row goes with it. There is nothing to clean up by hand.
    return v_manifest_id;
end;
$$;

-- Service role only. Never anon, never authenticated: a client able to call
-- this could write manifests for anybody.
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb) from public;
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb) from anon;
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb) from authenticated;
