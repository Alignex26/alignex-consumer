-- Approving a version is not mutating it.
--
-- THE PROBLEM. `intervention_module_versions` is append-only: a trigger rejects
-- every UPDATE except a withdrawal. That is right — a version whose wording can
-- be edited in place is not a version, and approval would mean nothing if the
-- approved text could change afterwards.
--
-- But it also made it impossible to record that content had been APPROVED. The
-- five English rows were imported before their approval state was separated
-- from the module's playability flag, so they carry `approved_at = null`, and
-- the only ways to correct that were to publish a duplicate version of
-- identical wording, or to edit the database by hand around the guard. Both are
-- worse than the guard admitting the case.
--
-- THE DISTINCTION. Approving does not change the content. The module, the
-- version number, the locale, the wording, the technique, the storage path and
-- the duration are all identical before and after — only the record of a human
-- decision is added. That is the same category as withdrawal, which this
-- trigger has always permitted for exactly the same reason.
--
-- NARROW ON PURPOSE. The exception allows one transition, once:
--
--   * `approved_at` null -> non-null only. Un-approving is not permitted, and
--     re-approving an already-approved row is not permitted.
--   * The version must NOT be withdrawn. A withdrawn version cannot be revived
--     by approving it.
--   * Every substantive field must be unchanged, and that set now includes
--     `locale` and `script_text`, which were added after the original trigger
--     was written and were therefore not being checked at all.
--
-- The last point tightens the guard rather than loosening it: before this,
-- a withdrawal could have silently carried a different `script_text` with it.

create or replace function elsea_reject_version_mutation() returns trigger
language plpgsql as $$
begin
    -- Everything that makes a version WHAT IT IS. Unchanged in every permitted
    -- update below; `locale` and `script_text` are included here for the first
    -- time.
    if tg_op = 'UPDATE'
       and row(new.module_id, new.version, new.storage_path, new.duration_seconds,
               new.technique_key, new.locale, new.script_text)
           is not distinct from
           row(old.module_id, old.version, old.storage_path, old.duration_seconds,
               old.technique_key, old.locale, old.script_text)
    then
        -- Withdrawal: the original exception. One way only.
        if old.withdrawn_at is null and new.withdrawn_at is not null then
            return new;
        end if;

        -- Content approval: recording a decision, not altering content. Only
        -- onto a row that is not withdrawn, and only from null.
        if old.approved_at is null
           and new.approved_at is not null
           and old.withdrawn_at is null
           and new.withdrawn_at is null
        then
            return new;
        end if;
    end if;

    raise exception
        'intervention_module_versions is append-only; publish a new version '
        '(withdrawal and first content approval excepted)';
end;
$$;
