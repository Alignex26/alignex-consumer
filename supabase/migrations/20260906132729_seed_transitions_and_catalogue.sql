-- =============================================================
-- V1 content: five transitions, sixteen catalogue sessions
-- Storage paths are placeholders until audio is produced.
-- =============================================================

insert into transitions (key, state_from, state_to, direction, display_name) values
                                                                                 ('wound_up_home',      'wound_up',    'home',      'down',    'Wound up → Home'),
                                                                                 ('scattered_focused',  'scattered',   'focused',   'lateral', 'Scattered → Focused'),
                                                                                 ('nervous_ready',      'nervous',     'ready',     'lateral', 'Nervous → Ready'),
                                                                                 ('wired_sleep',        'tired_wired', 'sleep',     'down',    'Wired → Sleep'),
                                                                                 ('flat_go',            'flat',        'activated', 'up',      'Flat → Go');

insert into sessions_catalogue (transition_key, duration_seconds, intensity, requires_headphones) values
                                                                                                      ('wound_up_home',      300,  2, false),
                                                                                                      ('wound_up_home',      420,  2, false),
                                                                                                      ('wound_up_home',      600,  2, false),
                                                                                                      ('wound_up_home',      900,  2, false),

                                                                                                      ('scattered_focused',  300,  2, true),
                                                                                                      ('scattered_focused',  600,  2, true),
                                                                                                      ('scattered_focused',  900,  2, true),

                                                                                                      ('nervous_ready',      180,  2, false),
                                                                                                      ('nervous_ready',      300,  2, false),
                                                                                                      ('nervous_ready',      600,  2, false),

                                                                                                      ('wired_sleep',        600,  1, false),
                                                                                                      ('wired_sleep',        900,  1, false),
                                                                                                      ('wired_sleep',       1200,  1, false),

                                                                                                      -- flat_go caps at intensity 2 per the up-regulation ceiling
                                                                                                      ('flat_go',            180,  2, true),
                                                                                                      ('flat_go',            300,  2, true),
                                                                                                      ('flat_go',            600,  2, true);

-- One segment per session for V1. Paths are placeholders.
insert into session_segments (session_id, ordinal, storage_path, duration_seconds)
select
    id,
    1,
    'sessions/' || transition_key || '_' || duration_seconds || '.m4a',
    duration_seconds
from sessions_catalogue;