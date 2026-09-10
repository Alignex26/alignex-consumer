-- Multilingual readiness, and a third voice profile.
--
-- MULTILINGUAL-READY, NOT MULTILINGUAL. This migration makes the data model
-- capable of holding more than one language. No translated content exists, none
-- is created here, and English is the only content-ready locale.
--
-- THE FOUR THINGS THAT ARE NOT THE SAME THING:
--
--     module identity   the intervention concept. One row, forever.
--     localised content the approved wording in one language, versioned.
--     voice profile     a presentation choice.
--     audio rendition   one recording of one localised version in one voice.
--
--     module + locale + version           = one approved localised script
--     that + voice profile                = one audio rendition
--
-- `intervention_module_versions` already WAS the content artifact — immutable,
-- versioned, approvable, withdrawable. It needed a locale, not a competing
-- system alongside it. That is the smallest correct change and the reason no
-- second version model appears here.
--
-- Additive. `20260910100000_voice_profiles_and_renditions` is not edited.
-- Nothing is migrated because all three tables are empty.

-- ---------------------------------------------------------------------------
-- 1. Locales
--
-- BCP 47 identifiers, not display strings. `pt-BR` is a different content
-- artifact from `pt`, and keying on "Portuguese (Brazil)" would make the label
-- the identity.
--
-- TWO SEPARATE FLAGS, because they mean different things and conflating them is
-- how a language gets offered before it can be delivered:
--
--   is_enabled        the product intends to offer this
--   is_content_ready  a COMPLETE approved library actually exists
--
-- A language is offerable only when both are true. Planned locales are recorded
-- so the architecture is exercised, and are neither.
-- ---------------------------------------------------------------------------

create table if not exists locales (
    id               text primary key check (id ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    display_label    text    not null,
    -- Shown to a person. False for a language we intend to add but cannot yet.
    is_enabled       boolean not null default false,
    -- A complete approved library exists in this language. Never set by
    -- inference: set it when the library is actually complete.
    is_content_ready boolean not null default false,
    created_at       timestamptz not null default now()
);

insert into locales (id, display_label, is_enabled, is_content_ready) values
    ('en',    'English',              true,  true),
    -- Planned. Recorded so the model is exercised, and deliberately neither
    -- enabled nor content-ready: no translated content exists.
    ('es',    'Español',              false, false),
    ('de',    'Deutsch',              false, false),
    ('fr',    'Français',             false, false),
    ('pt-BR', 'Português (Brasil)',   false, false)
on conflict (id) do nothing;

-- Display labels are not IP; they appear in a picker. Readable, never writable.
alter table locales enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'locales_read') then
        create policy locales_read on locales
            for select to anon, authenticated using (true);
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The third voice profile
--
-- `bright` is a product profile with no provider binding. It is deliberately
-- NOT marked usable: availability is derived from having an active provider
-- mapping, not from a flag somebody set optimistically.
-- ---------------------------------------------------------------------------

insert into voice_profiles (id, display_label, is_default) values
    ('bright', 'Bright', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Provider voice mapping
--
-- The layer that stops ELEVENLABS_VOICE_ID becoming the architecture. A single
-- environment variable is fine to bootstrap one voice; it cannot express three
-- profiles across five languages.
--
-- SERVICE ROLE ONLY. A provider's voice id is not something the client needs,
-- and publishing the mapping would say which vendor ELSEA uses and which of
-- their voices — commercial information with no product reason to be public.
--
-- The user's saved preference is an ELSEA profile such as `warm`. The provider
-- is resolved here, server-side, so switching vendor is a data change.
-- ---------------------------------------------------------------------------

create table if not exists provider_voice_mappings (
    voice_profile     text not null references voice_profiles (id) on delete cascade,
    locale            text not null references locales (id) on delete restrict,
    provider          text not null,
    provider_voice_id text not null,
    is_active         boolean not null default true,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    -- One binding per profile per language per provider. Two would make "the
    -- voice for warm in English" ambiguous at resolution time.
    primary key (voice_profile, locale, provider)
);

alter table provider_voice_mappings enable row level security;
-- No policy. Service role only, like the recipes and the storage paths.

-- ---------------------------------------------------------------------------
-- 4. Which voices a person may actually choose
--
-- Derived, not declared. A profile is offerable in a language when the profile
-- is active, the language is enabled, and an active provider binding exists.
-- `bright` therefore appears the moment it is mapped and not before — adding it
-- later is a data action, not another migration.
--
-- Exposes labels only. No provider name, no provider voice id.
-- ---------------------------------------------------------------------------

create or replace view available_voices
with (security_invoker = true) as
    select
        v.id            as voice_profile,
        v.display_label as voice_label,
        l.id            as locale,
        l.display_label as locale_label,
        v.is_default
    from voice_profiles v
    join provider_voice_mappings m
        on m.voice_profile = v.id and m.is_active
    join locales l
        on l.id = m.locale and l.is_enabled
    where v.is_active;

grant select on available_voices to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Localised content versions
--
-- `intervention_module_versions` becomes the LOCALISED content artifact. The
-- English and future Spanish wording of `nr_regulate_short` are the same
-- intervention and different approved content, which is exactly the distinction
-- this table already drew between versions — it only lacked a language.
--
-- The module row is untouched. A language must not fork module identity.
-- ---------------------------------------------------------------------------

alter table intervention_module_versions
    add column if not exists locale text not null default 'en'
        references locales (id) on delete restrict;

-- Version numbers run per language: Spanish version 1 is not English version 1.
alter table intervention_module_versions
    drop constraint if exists intervention_module_versions_module_id_version_key;

alter table intervention_module_versions
    add constraint intervention_module_versions_identity
    unique (module_id, locale, version);

comment on column intervention_module_versions.storage_path is
    'DEPRECATED 2026-09-10. Audio lives in module_renditions, one row per voice. '
    'This table is the localised CONTENT artifact; it does not own audio.';

-- ---------------------------------------------------------------------------
-- 6. Renditions become locale-aware
--
--     module + locale + version + voice profile = one audio rendition
--
-- A rendition still carries only recording-specific facts. Effectiveness is not
-- among them and never will be: it belongs to the intervention, and splitting it
-- by voice or language would fragment a person's history the first time they
-- changed either.
-- ---------------------------------------------------------------------------

alter table module_renditions
    add column if not exists locale text not null default 'en'
        references locales (id) on delete restrict;

alter table module_renditions
    drop constraint if exists module_renditions_module_id_version_voice_profile_key;

alter table module_renditions
    add constraint module_renditions_identity
    unique (module_id, locale, version, voice_profile);

-- The composer resolves by locale first and never across one.
drop index if exists module_renditions_lookup;
create index if not exists module_renditions_lookup
    on module_renditions (module_id, locale, voice_profile)
    where approved and is_active;

-- ---------------------------------------------------------------------------
-- 7. Language preference
--
-- Extending `user_preferences` rather than adding a table: it is one more scalar
-- choice belonging to one person, and a second table would need its own RLS and
-- its own join for no gain.
--
-- Per-language voice preference was considered and rejected as over-engineering
-- for V1 — one enabled language means it could not yet differ from the single
-- value, and it can be added later without disturbing this column.
-- ---------------------------------------------------------------------------

alter table user_preferences
    add column if not exists locale text not null default 'en'
        references locales (id) on delete restrict;

-- Own-row RLS is unchanged and still applies to the new column.
