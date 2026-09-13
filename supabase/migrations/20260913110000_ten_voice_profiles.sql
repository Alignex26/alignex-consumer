-- The ten ELSEA voice profiles.
--
-- PRODUCT IDENTITIES, NOT PROVIDER NAMES. A profile is what a customer chooses:
-- "Warm", "Grounded". Which ElevenLabs voice renders it lives in
-- `provider_voice_mappings`, server-side, and never reaches the client. That
-- separation is what allows a provider to change without a customer noticing,
-- and it is why a preference stores `warm` rather than a vendor's voice id.
--
-- SEVEN OF THESE CANNOT BE SELECTED, AND THAT IS THE POINT. `warm`, `clear` and
-- `bright` exist with real provider mappings. The other seven are catalogue
-- entries with no mapping, `is_active = false`, and no audio. They exist so the
-- product, the tooling and the coverage reports can address ten voices; they do
-- not exist so that anyone can pick one and hear silence.
--
-- Choosing the seven provider voices is a PRODUCT DECISION and has not been
-- taken. No provider voice id is invented here. `docs/voice-catalogue.md`
-- carries the operator checklist for activating one.
--
-- BACKWARD COMPATIBILITY. `warm`, `clear` and `bright` keep their existing ids,
-- labels and default flag. Nothing about the three approved voices changes.

-- ---------------------------------------------------------------------------
-- 1. The columns a catalogue needs
-- ---------------------------------------------------------------------------
--
-- `display_label` and `is_default` already exist. These add what a real picker
-- needs: an ordering that is a product decision rather than alphabetical
-- accident, and a short human descriptor.
alter table voice_profiles
    add column if not exists descriptor text,
    add column if not exists sort_order integer not null default 100;

comment on column voice_profiles.descriptor is
    'One short customer-facing phrase. Never technical, never a provider name.';
comment on column voice_profiles.sort_order is
    'Presentation order in the picker. Lower first.';

-- ---------------------------------------------------------------------------
-- 2. The catalogue
-- ---------------------------------------------------------------------------
--
-- Descriptors are plain description of delivery, not a claim about what the
-- voice will do for somebody. "Soft" describes a sound; "calming" would be a
-- wellbeing claim, and those are not written here.
insert into voice_profiles (id, display_label, descriptor, is_default, is_active, sort_order) values
    ('warm',      'Warm',      'Unhurried and close',        true,  true,  10),
    ('clear',     'Clear',     'Even and articulate',        false, true,  20),
    ('bright',    'Bright',    'Lighter, with more lift',    false, false, 30),
    ('grounded',  'Grounded',  'Steady and low',             false, false, 40),
    ('gentle',    'Gentle',    'Quiet and unhurried',        false, false, 50),
    ('direct',    'Direct',    'Plain and to the point',     false, false, 60),
    ('calm',      'Calm',      'Level and slow',             false, false, 70),
    ('confident', 'Confident', 'Assured and grounded',       false, false, 80),
    ('soft',      'Soft',      'Close and understated',      false, false, 90),
    ('deep',      'Deep',      'Lower and resonant',         false, false, 100)
on conflict (id) do update set
    -- Descriptor and order are catalogue presentation and may be corrected.
    descriptor = excluded.descriptor,
    sort_order = excluded.sort_order;
    -- is_active, is_default and display_label are deliberately NOT updated:
    -- `bright` may have been activated by an operator after human listening, and
    -- a re-run of this migration must not quietly deactivate it again. That
    -- exact mistake was made once already, when bright was inserted active
    -- before any mapping existed.

-- ---------------------------------------------------------------------------
-- 3. A profile without a mapping must never be selectable
-- ---------------------------------------------------------------------------
--
-- Activation is not a flag somebody remembers to check. A voice is selectable
-- only when it can actually be heard, and this refuses the write otherwise.
--
-- Deliberately NOT automatic: having a mapping does not activate a voice, because
-- a mapped voice still needs approved audio and a human decision. This only
-- prevents the incoherent direction.
--
-- IT POLICES THE TRANSITION, NOT THE STATE. Only a row becoming active is
-- checked. Provider mappings are operator data rather than seeded data, so on a
-- fresh database none exist yet and `warm` is already active — a rule written
-- against the state would make every later edit to that row fail, including
-- editing its descriptor.
create or replace function elsea_voice_requires_mapping() returns trigger
language plpgsql as $$
begin
    if new.is_active
       and (tg_op = 'INSERT' or not old.is_active)
       and not exists (
           select 1 from provider_voice_mappings
           where voice_profile = new.id and is_active
       )
    then
        raise exception
            'voice profile "%" cannot be activated: no active provider mapping exists', new.id;
    end if;

    if new.is_default and not new.is_active then
        raise exception
            'voice profile "%" cannot be the default while inactive', new.id;
    end if;

    return new;
end;
$$;

drop trigger if exists voice_profiles_require_mapping on voice_profiles;
create trigger voice_profiles_require_mapping
    before insert or update on voice_profiles
    for each row execute function elsea_voice_requires_mapping();
