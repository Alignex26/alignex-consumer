-- ELSEA — protect the proprietary session intelligence, and seed P19.
--
-- Three things, in this order, because the lockdown must land before the IP
-- does:
--
--   1. Close anon read access to the recipe and library tables.
--   2. Adopt the approved module-family vocabulary.
--   3. Seed the five recipe phase structures and their family eligibility.
--
-- Additive as a migration: a new file, nothing edited that has been applied.
-- It does DROP three policies, which is the point of it.

-- ---------------------------------------------------------------------------
-- 1. THE SECURITY CORRECTION
--
-- `recipe_phases`, `module_affinities` and `intervention_modules` were
-- readable with the public anon key. The five recipes and their eligibility
-- rules are ELSEA's proprietary product intelligence, and anyone who can read
-- the anon key out of the app could have enumerated them through PostgREST.
--
-- These tables become service-role only. Composition moves server-side, into
-- an Edge Function that reads them with the service role and returns a
-- finished manifest. The client receives what to play, never how it was
-- decided.
--
-- The manifest carries resolved storage paths, so the client no longer needs
-- to read `intervention_modules` to find its audio.
-- ---------------------------------------------------------------------------

drop policy if exists recipe_phases_readable on recipe_phases;
drop policy if exists affinities_readable   on module_affinities;
drop policy if exists modules_readable      on intervention_modules;
-- `module_affinities` keeps its policy dropped here even though the table is
-- removed next: the two migrations must each be correct on their own.

-- RLS is already enabled on all three. With no policy, and no service-role
-- bypass, they are unreachable through PostgREST entirely.

-- ---------------------------------------------------------------------------
-- 2. THE APPROVED MODULE-FAMILY VOCABULARY
--
-- Twelve product-level families. These are TAXONOMY SLOTS. What technique
-- fills one is authored and approved outside engineering (S4).
--
-- Canonical form is LOWER CASE, consistent with every other identifier in this
-- schema (`wound_up_home`, `nervous`, `home`). The approved vocabulary is
-- written in upper case, and upper case remains the DISPLAY treatment — but
-- presentation casing is not something to bake into the database, the API or
-- the domain model.
--
-- `is_bed` stays an orthogonal boolean rather than a family: a bed is a
-- LAYER, not a step in a transition, and it still needs a family of its own
-- for selection to reason about.
-- ---------------------------------------------------------------------------

alter table intervention_modules
    drop constraint if exists intervention_modules_family_check;

alter table intervention_modules
    add constraint intervention_modules_family_check
    check (family in (
        'orient', 'regulate', 'ground', 'release', 'reframe', 'focus',
        'activate', 'prepare', 'transition', 'settle', 'sleep', 'close'
    ));

-- ---------------------------------------------------------------------------
-- 3. FAMILY ELIGIBILITY PER PHASE
--
-- SCHEMA GAP THIS FILLS. `module_affinities` binds one MODULE to a phase, so
-- it cannot express "this phase accepts these families" — it needs a module
-- id, and the library is empty. The approved product decision is family-level
-- eligibility, which is a different relation and needs its own table.
--
-- `module_affinities` is dropped in the migration that follows this one. Two
-- overlapping ways to say whether a module belongs in a phase is one too many,
-- and a vague table left "in case" becomes accidental architecture. If a
-- per-module clinical override is ever needed it will be an explicit
-- construct with explicit semantics, decided then.
-- ---------------------------------------------------------------------------

-- Needed so eligibility can reference a phase by name rather than by ordinal.
alter table recipe_phases
    drop constraint if exists recipe_phases_transition_phase_key;

alter table recipe_phases
    add constraint recipe_phases_transition_phase_key unique (transition_key, phase);

create table if not exists recipe_phase_families (
    transition_key  text not null,
    phase           text not null,
    family          text not null check (family in (
        'orient', 'regulate', 'ground', 'release', 'reframe', 'focus',
        'activate', 'prepare', 'transition', 'settle', 'sleep', 'close'
    )),
    primary key (transition_key, phase, family),
    foreign key (transition_key, phase)
        references recipe_phases (transition_key, phase) on delete cascade
);

-- Proprietary, like the phases themselves. Service-role only.
alter table recipe_phase_families enable row level security;

-- ---------------------------------------------------------------------------
-- 4. SEED — P19, approved as a PRODUCT DRAFT.
--
-- Five state-transition pathways, not five scripts. Duration stays a runtime
-- parameter (P4): the allocator fills the bottom of these bands for a short
-- session and distributes the surplus within the ceilings as more time is
-- available. There are no 5/10/15/20 minute variants and must never be.
--
-- EVERY FLOOR HERE IS PROVISIONAL PENDING CLINICAL REVIEW (S14). The
-- `is_provisional` column carries that with the data so it cannot quietly
-- harden into a settled number.
-- ---------------------------------------------------------------------------

insert into recipe_phases (transition_key, ordinal, phase, min_seconds, max_seconds, is_provisional) values
    -- WOUND UP -> HOME
    ('wound_up_home',     0, 'arrive',                   20,  60, true),
    ('wound_up_home',     1, 'downshift_arousal',        60, 300, true),
    ('wound_up_home',     2, 'leave_work_behind',        45, 240, true),
    ('wound_up_home',     3, 'reconnect_to_now',         45, 360, true),
    ('wound_up_home',     4, 'settle',                   30, 240, true),
    ('wound_up_home',     5, 'close',                    15,  45, true),

    -- SCATTERED -> FOCUSED
    ('scattered_focused', 0, 'arrive',                   20,  60, true),
    ('scattered_focused', 1, 'reduce_noise',             45, 240, true),
    ('scattered_focused', 2, 'choose_direction',         30, 180, true),
    ('scattered_focused', 3, 'stabilise_attention',      60, 480, true),
    ('scattered_focused', 4, 'build_momentum',           45, 420, true),
    ('scattered_focused', 5, 'close',                    15,  45, true),

    -- NERVOUS -> READY
    ('nervous_ready',     0, 'arrive',                   20,  60, true),
    ('nervous_ready',     1, 'regulate_arousal',         60, 300, true),
    ('nervous_ready',     2, 'reframe_energy',           45, 240, true),
    ('nervous_ready',     3, 'build_readiness',          60, 480, true),
    ('nervous_ready',     4, 'direct_attention_forward', 45, 300, true),
    ('nervous_ready',     5, 'close',                    15,  45, true),

    -- WIRED -> SLEEP
    ('wired_sleep',       0, 'arrive',                   20,  60, true),
    ('wired_sleep',       1, 'settle_body',              60, 360, true),
    ('wired_sleep',       2, 'slow_system',              45, 300, true),
    ('wired_sleep',       3, 'release_thoughts',         45, 300, true),
    ('wired_sleep',       4, 'allow_sleep',              60, 480, true),
    ('wired_sleep',       5, 'close',                    10,  45, true),

    -- FLAT -> GO
    ('flat_go',           0, 'arrive',                   20,  60, true),
    ('flat_go',           1, 'wake_body',                45, 180, true),
    ('flat_go',           2, 'raise_energy',             45, 300, true),
    ('flat_go',           3, 'find_direction',           45, 240, true),
    ('flat_go',           4, 'choose_first_move',        45, 180, true),
    ('flat_go',           5, 'build_momentum',           60, 420, true),
    ('flat_go',           6, 'close',                    15,  45, true)
on conflict (transition_key, ordinal) do nothing;

insert into recipe_phase_families (transition_key, phase, family) values
    ('wound_up_home',     'arrive',                   'orient'),
    ('wound_up_home',     'downshift_arousal',        'regulate'),
    ('wound_up_home',     'downshift_arousal',        'release'),
    ('wound_up_home',     'leave_work_behind',        'reframe'),
    ('wound_up_home',     'leave_work_behind',        'transition'),
    ('wound_up_home',     'reconnect_to_now',         'ground'),
    ('wound_up_home',     'reconnect_to_now',         'transition'),
    ('wound_up_home',     'reconnect_to_now',         'settle'),
    ('wound_up_home',     'settle',                   'settle'),
    ('wound_up_home',     'settle',                   'ground'),
    ('wound_up_home',     'close',                    'close'),

    ('scattered_focused', 'arrive',                   'orient'),
    ('scattered_focused', 'reduce_noise',             'release'),
    ('scattered_focused', 'reduce_noise',             'ground'),
    ('scattered_focused', 'choose_direction',         'focus'),
    ('scattered_focused', 'choose_direction',         'reframe'),
    ('scattered_focused', 'stabilise_attention',      'focus'),
    ('scattered_focused', 'stabilise_attention',      'ground'),
    ('scattered_focused', 'build_momentum',           'activate'),
    ('scattered_focused', 'build_momentum',           'prepare'),
    ('scattered_focused', 'build_momentum',           'focus'),
    ('scattered_focused', 'close',                    'close'),

    ('nervous_ready',     'arrive',                   'orient'),
    ('nervous_ready',     'regulate_arousal',         'regulate'),
    ('nervous_ready',     'regulate_arousal',         'ground'),
    ('nervous_ready',     'reframe_energy',           'reframe'),
    ('nervous_ready',     'build_readiness',          'prepare'),
    ('nervous_ready',     'build_readiness',          'activate'),
    ('nervous_ready',     'direct_attention_forward', 'focus'),
    ('nervous_ready',     'direct_attention_forward', 'prepare'),
    ('nervous_ready',     'close',                    'close'),

    ('wired_sleep',       'arrive',                   'orient'),
    ('wired_sleep',       'settle_body',              'settle'),
    ('wired_sleep',       'settle_body',              'release'),
    ('wired_sleep',       'slow_system',              'regulate'),
    ('wired_sleep',       'slow_system',              'settle'),
    ('wired_sleep',       'release_thoughts',         'release'),
    ('wired_sleep',       'release_thoughts',         'reframe'),
    ('wired_sleep',       'allow_sleep',              'sleep'),
    ('wired_sleep',       'allow_sleep',              'settle'),
    ('wired_sleep',       'close',                    'close'),
    ('wired_sleep',       'close',                    'sleep'),

    ('flat_go',           'arrive',                   'orient'),
    ('flat_go',           'wake_body',                'activate'),
    ('flat_go',           'raise_energy',             'activate'),
    ('flat_go',           'raise_energy',             'regulate'),
    ('flat_go',           'find_direction',           'reframe'),
    ('flat_go',           'find_direction',           'focus'),
    ('flat_go',           'choose_first_move',        'focus'),
    ('flat_go',           'choose_first_move',        'prepare'),
    ('flat_go',           'build_momentum',           'activate'),
    ('flat_go',           'build_momentum',           'prepare'),
    ('flat_go',           'close',                    'close')
on conflict (transition_key, phase, family) do nothing;
