-- The approved wording had nowhere to live.
--
-- THE GAP THIS CLOSES. `intervention_module_versions` is the localised content
-- artifact: immutable, versioned, approvable, withdrawable, and now carrying a
-- locale. It recorded everything ABOUT a piece of approved content — which
-- technique, which language, which version, approved when, withdrawn when — and
-- not the content itself. The words existed only in a markdown pack.
--
-- That was survivable while audio was recorded by a person reading from the
-- pack. It stops being survivable the moment a server generates the audio,
-- because the server has to be able to retrieve the approved script rather than
-- being handed text by whoever is calling. An endpoint that accepts arbitrary
-- text and speaks it is an endpoint that can say anything.
--
-- So the wording goes where the rest of the content facts already are. This is
-- not a new version model; it is the missing column on the existing one.
--
-- STILL IMMUTABLE. The append-only trigger already covers this table, so a
-- script cannot be edited in place — changing the words means publishing a new
-- version, which is what "the approved wording" has to mean if approval is to
-- mean anything.

alter table intervention_module_versions
    add column if not exists script_text text;

comment on column intervention_module_versions.script_text is
    'The approved localised wording, exactly as approved. Read by the master '
    'generator so that synthesis can only ever speak approved content. Nullable '
    'only because existing rows predate it; a version with no script cannot be '
    'generated from.';

-- Deliberately nullable rather than NOT NULL. There are no rows today, but a
-- NOT NULL column would force any future backfill to invent text for a version
-- whose wording was never recorded — and inventing approved content is the one
-- thing that must not happen. The generator refuses a version with no script
-- instead, which is the honest failure.
