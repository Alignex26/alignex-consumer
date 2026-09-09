-- Make the manifest fingerprint reachable.
--
-- THE DEFECT THIS FIXES. `20260909160000` added `session_manifests.fingerprint`
-- so ordinary composition could tell a fresh session from one the person has
-- just had. But `persist_session_manifest` was written before it and takes no
-- fingerprint, so the column has never been written and cannot be. Every
-- manifest persisted so far carries a null there.
--
-- That makes the novelty work unreachable rather than merely dormant: recency
-- reads a person's recent fingerprints, and if none are ever recorded, there is
-- no history to read even once the policy is decided. Worse, the history is not
-- recoverable later — a session that was not fingerprinted when it was composed
-- cannot be fingerprinted afterwards, because the module versions behind it may
-- have moved on.
--
-- WHAT THIS DOES NOT DO. It does not apply any novelty policy, weighting or
-- lookback. Recording what was composed is bookkeeping; deciding that a recent
-- module should be deprioritised is a product decision, and it is not made
-- here. This only stops the record being thrown away.
--
-- The signature changes, so the old function is dropped rather than replaced:
-- `create or replace` with a different argument list creates an OVERLOAD, and
-- two candidates with the same name would make the call ambiguous. Dropping a
-- function is not editing an applied migration — the earlier file is untouched.

drop function if exists persist_session_manifest(uuid, text, integer, integer, integer, jsonb);

create or replace function persist_session_manifest(
    p_user_id uuid,
    p_transition_key text,
    p_duration_seconds integer,
    p_recipe_version integer,
    p_dynamic_seconds integer,
    p_segments jsonb,
    -- Nullable on purpose. A caller that cannot compute a fingerprint should
    -- still be able to persist a manifest; a null here means "not recorded",
    -- which is honest, rather than an invented value that would look like a
    -- composition nobody ever heard.
    p_fingerprint text default null
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
        user_id, transition_key, duration_seconds, recipe_version,
        dynamic_seconds, fingerprint
    ) values (
        p_user_id, p_transition_key, p_duration_seconds, p_recipe_version,
        p_dynamic_seconds, p_fingerprint
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

-- Service role only, exactly as before. A client able to call this could write
-- manifests for anybody.
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb, text) from public;
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb, text) from anon;
revoke all on function persist_session_manifest(uuid, text, integer, integer, integer, jsonb, text) from authenticated;
