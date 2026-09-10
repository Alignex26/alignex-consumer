-- `bright` exists as a product profile and is not yet selectable.
--
-- The previous migration inserted it with the column default, `is_active =
-- true`, which would have put it in front of people immediately — and the read
-- policy on `voice_profiles` filters on exactly that flag. A voice offered
-- before it can resolve to audio is a voice that produces a session someone
-- cannot hear.
--
-- No provider binding exists for it, and choosing one is a casting decision
-- nobody has made. So the row is present, the architecture is exercised, and
-- the profile is inactive.
--
-- FLIPPING THIS IS A DATA ACTION, NOT A MIGRATION. When a provider voice is
-- chosen and mapped in `provider_voice_mappings`, and renditions exist:
--
--     update voice_profiles set is_active = true where id = 'bright';
--
-- `warm` and `clear` are untouched and continue to behave exactly as before.

update voice_profiles
   set is_active = false
 where id = 'bright';

comment on table voice_profiles is
    'Product voice profiles. `is_active` gates whether a profile is offered: a '
    'profile must have a provider binding in provider_voice_mappings, and '
    'approved renditions, before it is activated. Internal product keys — not '
    'gender classifications and not provider identifiers.';
