-- Two narration voices for V1.
--
-- THE SHAPE OF THE PROBLEM. A module's identity is its technique, its wording
-- and its approval. None of that changes because a different person read it
-- aloud. So a second voice must not create a second module: doing that would
-- fork effectiveness data, double the library, and make "the same intervention"
-- two rows that have to be kept in step by hand.
--
-- What actually differs is the recording. So:
--
--     module  +  version  +  voice profile  =  one audio rendition
--
-- `module_renditions` is that relation, and it becomes the only place an
-- intervention's audio path lives. `intervention_modules.storage_path` is
-- deprecated by this migration and made nullable; it cannot be dropped, because
-- dropping a column from an applied migration is not something to do to a live
-- schema, and leaving it NOT NULL would force every import to invent a value
-- for a field nothing reads.
--
-- Nothing is migrated because there is nothing to migrate: the library is
-- empty. Had it not been, the existing paths would have become `warm`
-- renditions.

-- ---------------------------------------------------------------------------
-- 1. Voice profiles
--
-- Exactly two for V1. `warm` and `clear` are internal product labels, not
-- descriptions of a person and not gender classifications, and the display
-- label is the only thing a person ever sees.
--
-- A table rather than an enum so a third voice is an insert rather than a
-- migration, and so `is_active` can retire one without deleting the renditions
-- recorded against it.
-- ---------------------------------------------------------------------------

create table if not exists voice_profiles (
    id            text primary key check (id ~ '^[a-z][a-z0-9_]*$'),
    display_label text    not null,
    is_active     boolean not null default true,
    -- The voice used when someone has expressed no preference, and the one
    -- every fallback resolves to.
    is_default    boolean not null default false,
    created_at    timestamptz not null default now()
);

-- At most one default. Two would make "the default rendition" ambiguous at
-- exactly the moment a fallback is being resolved.
create unique index if not exists voice_profiles_single_default
    on voice_profiles ((is_default)) where is_default;

insert into voice_profiles (id, display_label, is_default) values
    ('warm',  'Warm',  true),
    ('clear', 'Clear', false)
on conflict (id) do nothing;

-- The two labels are not IP: they are visible in the app the moment someone
-- opens the voice picker. Readable, never writable.
alter table voice_profiles enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'voice_profiles_read') then
        create policy voice_profiles_read on voice_profiles
            for select to anon, authenticated using (is_active);
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Renditions
--
-- One row per (module, version, voice). The technique, the wording and the
-- module's own approval live on the module; this carries only what is true of
-- a particular recording.
--
-- APPROVAL IS PER RENDITION AS WELL AS PER MODULE, and both must pass. The
-- module's flag says the content is approved; this one says this recording of
-- it is. A bad take of approved wording must not be playable, and approving a
-- module must not silently bless every future recording of it.
-- ---------------------------------------------------------------------------

create table if not exists module_renditions (
    id               uuid primary key default gen_random_uuid(),
    module_id        uuid    not null references intervention_modules (id) on delete cascade,
    -- Matches `intervention_module_versions.version`. A rendition is of a
    -- specific version of the content, not of the module in the abstract.
    version          integer not null,
    voice_profile    text    not null references voice_profiles (id) on delete restrict,
    storage_path     text    not null,
    duration_seconds integer not null check (duration_seconds > 0),
    approved         boolean not null default false,
    approved_at      timestamptz,
    is_active        boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (module_id, version, voice_profile)
);

create index if not exists module_renditions_lookup
    on module_renditions (module_id, voice_profile)
    where approved and is_active;

-- Storage paths are the same class of IP as the recipes: knowing them is
-- knowing the library's shape. Service role only, exactly like
-- `intervention_modules`. No anon policy, no authenticated policy.
alter table module_renditions enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Deprecate the single-voice path
--
-- Made nullable rather than dropped. Nothing reads it after this migration;
-- the composer resolves audio through `module_renditions`.
-- ---------------------------------------------------------------------------

alter table intervention_modules
    alter column storage_path drop not null;

comment on column intervention_modules.storage_path is
    'DEPRECATED 2026-09-10. Audio lives in module_renditions, one row per voice. '
    'Retained nullable rather than dropped; nothing reads it.';

-- ---------------------------------------------------------------------------
-- 4. User preference
--
-- The smallest thing that holds one choice per person. Deliberately its own
-- table rather than a column on a profile that does not exist.
--
-- Changing it must not disturb anything else, and by construction it cannot:
-- nothing joins to it except audio resolution. Session history, module
-- identity, effectiveness and recipe selection are all keyed on the module,
-- never on the narrator.
-- ---------------------------------------------------------------------------

create table if not exists user_preferences (
    user_id       uuid primary key references auth.users (id) on delete cascade,
    voice_profile text not null default 'warm' references voice_profiles (id) on delete restrict,
    updated_at    timestamptz not null default now()
);

alter table user_preferences enable row level security;

do $$
begin
    if not exists (select 1 from pg_policies where policyname = 'user_preferences_own_select') then
        create policy user_preferences_own_select on user_preferences
            for select to authenticated using (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'user_preferences_own_insert') then
        create policy user_preferences_own_insert on user_preferences
            for insert to authenticated with check (auth.uid() = user_id);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'user_preferences_own_update') then
        create policy user_preferences_own_update on user_preferences
            for update to authenticated using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end $$;
