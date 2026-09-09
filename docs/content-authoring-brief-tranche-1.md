# ELSEA — content authoring brief, Tranche 1: NERVOUS → READY

**For the content author, clinical reviewer and voice producer.**
No knowledge of the codebase is needed to work from this document.

Prepared: 2026-09-09. Every number here was read out of the running system, not
estimated. If the recipe or the allocator changes, this brief must be recomputed.

**This document contains no intervention content and proposes none.** It states
what each slot has to do and the constraints it has to satisfy. What is said,
how it is said, and whether it is safe to say are authored and approved outside
engineering.

---

## 1. Purpose of this tranche

### What `nervous_ready` is for

It is the pathway for someone who arrives **nervous or anxious** and wants to
arrive **ready** — before something that matters to them. An interview, a
conversation, a performance, a first day.

The person is not asking to stop feeling anything. The product's own words for
this are *"How you feel now doesn't have to decide how you feel next."* The
pathway is about changing what happens next, not about eliminating the feeling.

### Where someone starts

One of the approved starting states that routes into this pathway: `nervous`
or `anxious`. These are canonical system values, not words shown on screen.

### Where they are meant to arrive

The approved destination state `ready`. On screen this is labelled **Confident**.
The label and the canonical value are deliberately different, and the canonical
value is never renamed to match the label.

### What the author is responsible for

- The technique used in each module, and its name (`technique_key`)
- The wording, in full
- Delivery, pacing and tone
- Whether a module needs headphones
- The intensity rating, once a scale exists
- The approval decision

### What engineering is responsible for

- Choosing which modules play, in what order, for the requested length
- Placing silence between them
- Timing, fades, pause and resume
- Storing the audio privately and delivering it securely
- Never letting unapproved content into a session

**Engineering will not write, edit, shorten or approve any content.** If a
module is too long, it will simply never be selected — engineering will not
trim it to fit.

---

## 2. The user journey

Where this content appears in the real product:

```
the person describes how they feel, in their own words
        ↓
a safety check runs on the server        ← their words go here and nowhere else
        ↓
ELSEA interprets a starting state         (e.g. nervous)
        ↓
they choose where they want to get to     (Confident → ready)
        ↓
they choose how long they have            (5, 10, 15 or 20 minutes)
        ↓
a session is composed for them
        ↓
they listen, and can pause or leave early
        ↓
they say how it went
```

### The most important thing to understand

**Nobody receives a script.** There is no "nervous to ready, 10 minute
recording". Every session is assembled at the moment it is requested, from
approved modules, to fit the time available.

Two people asking for the same thing on the same day may hear different
modules. The same person asking twice should not hear the identical session
twice.

This has three consequences for authoring:

1. **Every module must stand alone.** It will be heard next to modules you did
   not choose and cannot predict.
2. **Every module must end in a state the next one can begin from.** No module
   may leave the listener mid-exercise.
3. **No module may refer to another module** — not by name, not as "as we did a
   moment ago", not "later we'll…". The module you are imagining next to it may
   not be there.

---

## 3. The locked recipe structure

Six phases, in this order, every time. **This is fixed and is not open for
change in this tranche.** All bands are marked provisional pending clinical
review, but they are being used as settled because nothing else exists.

| # | Phase | What this phase is for, in plain English | Eligible families | Min | Max |
|---:|---|---|---|---:|---:|
| 0 | `arrive` | Land. The person has just come from their own life into the session. | `orient` | 20s | 60s |
| 1 | `regulate_arousal` | Bring the physical activation down. | `regulate`, `ground` | 60s | 300s |
| 2 | `reframe_energy` | Change the relationship to what is being felt. | `reframe` | 45s | 240s |
| 3 | `build_readiness` | Build toward the thing they are about to do. | `prepare`, `activate` | 60s | 480s |
| 4 | `direct_attention_forward` | Point attention at what is coming, not at the feeling. | `focus`, `prepare` | 45s | 300s |
| 5 | `close` | End cleanly and hand them back to their day. | `close` | 15s | 45s |

### Composition constraints that affect authoring

- **A phase may be filled by more than one module**, chained back to back, if
  the time allows.
- **No module plays twice in one session.** If a phase can only be filled by
  one module, that phase gets one module.
- **Silence is placed by the engine**, between modules, as deliberate gaps of
  known length. It is not part of your recording.
- A phase whose eligible families have no approved content **cannot be filled**,
  and the whole session fails rather than playing with a hole in it.

---

## 4. Modules required for this tranche

**Eleven modules.** Five are load-bearing — remove any one and a five-minute
session cannot be built at all. Six add depth, without which longer sessions
become mostly silence.

Module identifiers below are **proposed** and can be renamed freely until the
content exists.

### The five that make the pathway work

| Module | Family | Intended role | Max duration (this recipe) | Max if reusable across recipes | Used by other recipes? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---:|---|---|---|---|---|
| `nr_arrive_short` | `orient` | Land the person into the session | **≤22s** | **≤21s** | yes — all five recipes open with `orient` | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_regulate_short` | `regulate` | Bring activation down | **≤71s** | **≤45s** | yes — 4 phases across recipes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_reframe_short` | `reframe` | Change the relationship to the feeling | **≤54s** | **≤40s** | yes — 5 phases | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_prepare_short` | `prepare` | Build toward the thing ahead | **≤57s** | **≤45s** | yes — 4 phases | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_close_short` | `close` | End cleanly | **≤16s** | **≤11s** | yes — all five recipes close | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

`nr_prepare_short` is used **twice over** inside this one recipe — it is
eligible for both `build_readiness` and `direct_attention_forward`. It will
never play twice in the same session, but it must make sense in either place.

### The six that add depth

Without these, a twenty-minute session is **77% silence**. With them, 20%.

| Module | Family | Intended role | Max duration | Used by other recipes? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---|---|---|---|---|
| `nr_regulate_long` | `regulate` | Longer regulation | ≤254s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_ground_mid` | `ground` | Alternative to regulation, so the phase varies | ≤254s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_reframe_long` | `reframe` | Longer reframe | ≤203s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_prepare_long` | `prepare` | Longer readiness build | ≤400s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_activate_mid` | `activate` | Alternative to prepare in `build_readiness` | ≤400s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `nr_focus_mid` | `focus` | Direct attention forward | ≤251s | yes | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

### Values this brief cannot supply

`intensity` (1–10) — **TO DECIDE.** No scale is defined anywhere in the system.
The column exists, is constrained to 1–10, and is currently read by nothing.

`technique_key` — **TO DECIDE, clinical.** Naming it names a technique, which
engineering must not do.

`requires_headphones` — **TO DECIDE per module**, content decision. The app
already tells the person before the session starts.

---

## 5. Authoring sheet for each module

Copy one block per module. **Fields marked REQUIRED must be filled by the
author, clinical reviewer or producer — they are deliberately empty.**

---

### MODULE: `nr_arrive_short`
```
FAMILY:                 orient
TARGET DURATION:        20s or under (see note)
MAXIMUM DURATION:       22s in this recipe / 21s if reusable across all recipes
USED IN:                nervous_ready → arrive
                        Also eligible for the opening phase of all five recipes
PURPOSE:                Land the person into the session from whatever they
                        were doing a moment ago.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical (1–10; no scale defined yet)
REQUIRES HEADPHONES:    REQUIRED — true or false
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_arrive_short.m4a
```
> Author to 21s or under if this module is to serve every recipe. At 22s it
> works here and is silently unusable in `flat_go`.

---

### MODULE: `nr_regulate_short`
```
FAMILY:                 regulate
TARGET DURATION:        45s or under (see note)
MAXIMUM DURATION:       71s in this recipe / 45s if reusable across recipes
USED IN:                nervous_ready → regulate_arousal
PURPOSE:                Bring physical activation down.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_regulate_short.m4a
```

---

### MODULE: `nr_reframe_short`
```
FAMILY:                 reframe
TARGET DURATION:        40s or under (see note)
MAXIMUM DURATION:       54s in this recipe / 40s if reusable across recipes
USED IN:                nervous_ready → reframe_energy
PURPOSE:                Change the person's relationship to what they are
                        feeling, rather than removing it.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_reframe_short.m4a
```

---

### MODULE: `nr_prepare_short`
```
FAMILY:                 prepare
TARGET DURATION:        45s or under (see note)
MAXIMUM DURATION:       57s in this recipe / 45s if reusable across recipes
USED IN:                nervous_ready → build_readiness
                        nervous_ready → direct_attention_forward
                        (eligible for both; never plays twice in one session)
PURPOSE:                Build toward the thing the person is about to do.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must make sense in either of its two phases
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_prepare_short.m4a
```

---

### MODULE: `nr_close_short`
```
FAMILY:                 close
TARGET DURATION:        11s or under (see note)
MAXIMUM DURATION:       16s in this recipe / 11s if reusable across recipes
USED IN:                nervous_ready → close
                        Also eligible for the closing phase of all five recipes
PURPOSE:                End the session cleanly and hand the person back to
                        their day.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_close_short.m4a
```
> **This is the tightest slot in the entire product.** Eleven seconds is very
> little. If the closing thought cannot be delivered in 11 seconds, that is a
> genuine finding and should be raised rather than solved by overrunning.

---

### MODULE: `nr_regulate_long`
```
FAMILY:                 regulate
TARGET DURATION:        REQUIRED — up to 254s
MAXIMUM DURATION:       254s
USED IN:                nervous_ready → regulate_arousal
PURPOSE:                A longer regulation option for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_regulate_long.m4a
```

---

### MODULE: `nr_ground_mid`
```
FAMILY:                 ground
TARGET DURATION:        REQUIRED — up to 254s
MAXIMUM DURATION:       254s
USED IN:                nervous_ready → regulate_arousal
PURPOSE:                A different way of filling the same phase, so that the
                        phase is not identical every time.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_ground_mid.m4a
```

---

### MODULE: `nr_reframe_long`
```
FAMILY:                 reframe
TARGET DURATION:        REQUIRED — up to 203s
MAXIMUM DURATION:       203s
USED IN:                nervous_ready → reframe_energy
PURPOSE:                A longer reframe for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_reframe_long.m4a
```

---

### MODULE: `nr_prepare_long`
```
FAMILY:                 prepare
TARGET DURATION:        REQUIRED — up to 400s
MAXIMUM DURATION:       400s
USED IN:                nervous_ready → build_readiness
PURPOSE:                A longer readiness build.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_prepare_long.m4a
```

---

### MODULE: `nr_activate_mid`
```
FAMILY:                 activate
TARGET DURATION:        REQUIRED — up to 400s
MAXIMUM DURATION:       400s
USED IN:                nervous_ready → build_readiness
PURPOSE:                An alternative to `prepare` in the same phase, so
                        readiness can be built more than one way.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_activate_mid.m4a
```

---

### MODULE: `nr_focus_mid`
```
FAMILY:                 focus
TARGET DURATION:        REQUIRED — up to 251s
MAXIMUM DURATION:       251s
USED IN:                nervous_ready → direct_attention_forward
PURPOSE:                Point attention at what is coming rather than at the
                        feeling.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        nr_focus_mid.m4a
```

---

## 6. Duration is a hard constraint

**Please read this section before writing anything.**

Duration is not a guideline, a target, or something that can be adjusted in the
edit. It decides whether a module can be used at all.

### How it actually works

When someone asks for a five-minute session, the engine divides those five
minutes across the six phases. The `arrive` phase gets **22 seconds**. It then
looks for `orient` modules that are **22 seconds or shorter**.

A 25-second `orient` module is not shortened, faded, or squeezed in. **It is
skipped.** If it is the only one, the five-minute session cannot be built.

### What each phase actually gets

| Phase | 5 min | 10 min | 15 min | 20 min |
|---|---:|---:|---:|---:|
| `arrive` | **22s** | 32s | 42s | 52s |
| `regulate_arousal` | **71s** | 132s | 193s | 254s |
| `reframe_energy` | **54s** | 104s | 153s | 203s |
| `build_readiness` | **80s** | 186s | 293s | 400s |
| `direct_attention_forward` | **57s** | 122s | 187s | 251s |
| `close` | **16s** | 24s | 32s | 40s |

**The five-minute column is the hard ceiling on every short module.**

### A module must fit the tightest slot in ANY recipe that can use it

This is the part that catches people out. A module belongs to a *family*, and
every recipe that accepts that family can select it. So its real limit is the
smallest slot in **any** of them, not the one it was written for.

- An `orient` module written at 22s works here — and is **unusable** in
  `flat_go`, whose opening slot is 21s.
- A `close` module written at 16s works here — and is **unusable** in
  `wired_sleep`, whose closing slot is 11s.

A module that fits only one recipe is not wrong, but it is worth less: it has
to be written again for the others.

### Four things that follow

1. **Do not write long and trim later.** A trimmed recording rarely lands on
   the second it needs to, and the validator rejects a file that differs from
   its declared length by more than a quarter of a second.
2. **A module over its limit is not "slightly too long" — it is unusable.** It
   fails silently: nothing errors, it is simply never chosen.
3. **Shorter is always safe.** A 15-second `close` fits every slot a 16-second
   one does, and more besides.
4. **There are no 5 / 10 / 15 / 20-minute versions of anything.** Length is a
   property of the session, never of the content. Do not write variants.

---

## 7. Content rules

Every rule below is already locked in the system. They are not preferences.

### About the person's own words

- **The words someone types are never used in any recording.** They go to a
  safety check and to interpretation, and nowhere else.
- **No module may depend on knowing what the person wrote.** You do not have
  it, will not have it, and must not write as though you do.
- **No module may assume anything not carried by the structured state.** All
  that is known is a starting state, a destination and a length. Not their
  name, their job, what they are nervous about, the time of day, or anything
  they said.

### About composition

- **Modules must be reusable.** Each one will appear in many different sessions
  alongside different neighbours.
- **Content must sit well next to unknown neighbours.** You cannot know what
  plays before or after.
- **Do not reference other modules**, or the session's structure, or how much
  time is left.
- **No module plays twice in one session.**
- **Silence is composed by the engine, not recorded.** Gaps between modules are
  placed deliberately with known durations. Do not build pauses into the file
  to create space — record the speech, and let composition place the silence.

### About approval

- **No module is production-ready without explicit approval.** Approval is a
  single flag, set from the approval decision and never inferred. Unapproved
  content cannot be selected, and no session will ever contain it.
- **A change to phases or the planner requires re-approval** of content
  affected by it.
- Approval is carried through exactly as given. Engineering never defaults it
  to true.

---

## 8. Audio production requirements

Every value below is enforced automatically. A file that misses any of them is
rejected before it can be imported.

| Property | Required value |
|---|---|
| Container | `.m4a` (MPEG-4 audio) |
| Codec | AAC-LC |
| Sample rate | 44 100 Hz |
| Channels | **Mono** |
| Bitrate | 96 kbps CBR (accepted range 64–128 kbps) |
| Integrated loudness | **−16 LUFS**, ±1 LU |
| True peak ceiling | **−1 dBTP** |
| Leading silence | ≤ 100 ms |
| Trailing silence | ≤ 100 ms |
| Fades | **None baked in** |
| Declared vs actual length | must match within 0.25s |

### File naming

**Name each delivered file `<module_key>.m4a`** — for example
`nr_arrive_short.m4a`. Lower-case letters, digits and underscores only.

> **Documentation conflict, flagged rather than resolved.**
> `docs/audio-production-spec.md` lists a naming pattern of
> `<family>_<key>_<seconds>s.m4a`. The tooling does not use that: it looks for a
> file named exactly after the module key. The tooling is what runs, so follow
> `<module_key>.m4a`. Engineering should reconcile the spec — it is a
> documentation defect, not an authoring question.

### Silence and fades

- **Trim leading and trailing silence to 100ms or less.** Silence inside a file
  is invisible to the engine: a 90-second module with two seconds of trailing
  air is really 92 seconds, and the session's timing drifts.
- **Do not apply fades.** The player applies a 250ms ramp at every boundary. A
  fade already in the file is applied twice.

### Why −16 LUFS specifically

A session is several recordings played back to back. A module 3 LU louder than
its neighbour is a jolt in the middle of a regulation exercise. −16 LUFS is the
mobile spoken-word convention and matches Apple's own normalisation, so ELSEA
sits at the same level as the listener's other audio. **The ±1 tolerance is
tight on purpose.**

### Not specified anywhere, and therefore yours

Voice, delivery, pacing, tone, and whether a given module needs headphones.

---

## 9. Manifest handoff

Once a module is authored, approved and recorded, engineering needs one small
data file describing it. One entry per module.

Per module, supply:

| Field | Plain English | Who supplies it |
|---|---|---|
| `module_key` | The identifier, e.g. `nr_arrive_short`. Lower-case letters, digits, underscores. Must be unique. | product |
| `family` | One of the twelve families. Lower case. | fixed by this brief |
| `technique_key` | The name of the technique used. **Must not be left as a placeholder** — the validator rejects `CONTENT_AUTHORING_REQUIRED`. | clinical |
| `duration_seconds` | Whole seconds. Must match the actual file within 0.25s. | content |
| `intensity` | Optional. Whole number 1–10. | clinical |
| `requires_headphones` | true or false | content |
| `is_bed` | `false` for every module in this tranche | product |
| `approved` | **Explicitly** true or false. Never left out. | clinical |
| `version` | Optional; defaults to 1. Increase it only when replacing the audio of an existing module. | product |
| `storage_path` | `modules/<family>/<module_key>.m4a` | engineering |

The shape, using the example fixture — **this is illustrative, not content**:

```json
[
  {
    "module_key": "example_not_real_content",
    "family": "orient",
    "technique_key": "CONTENT_AUTHORING_REQUIRED",
    "storage_path": "modules/orient/example_not_real_content.m4a",
    "duration_seconds": 20,
    "intensity": 5,
    "requires_headphones": false,
    "is_bed": false,
    "approved": false
  }
]
```

Deliver alongside it **one folder of audio**, each file named
`<module_key>.m4a`.

---

## 10. Validation process

```
author content
   ↓
clinical approval
   ↓
record audio
   ↓
prepare the manifest file
   ↓
run the validator          ← rejects anything non-conforming
   ↓
dry-run the import         ← shows exactly what would happen; writes nothing
   ↓
commit the import          ← uploads audio and writes the rows
   ↓
approved modules become selectable by the composer
```

### The commands

Validate — safe to run as often as you like, changes nothing:

```bash
node scripts/modules-validate.mjs <manifest.json> --audio-dir <folder>
```

Dry run — **this is what happens by default**; nothing is written or uploaded:

```bash
node scripts/modules-import.mjs <manifest.json> --audio-dir <folder>
```

Real import — requires the explicit `--commit` flag **and** a service-role key
supplied for that one command:

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/modules-import.mjs <manifest.json> --audio-dir <folder> --commit
```

### What the validator will reject

An unknown family; a storage path that is not
`modules/<family>/<module_key>.m4a`, or that sits under the wrong family; a
duplicate module key; a `technique_key` left as the placeholder; an `approved`
value that is not explicitly true or false; a non-positive duration; an
intensity outside 1–10; a version that is not a positive whole number; any
audio property outside the table in §8; a declared duration more than 0.25s
from the real one; and **an approved module with no audio file at all**.

The import validates first and refuses to proceed on any failure. Audio is
uploaded before rows are written, so a module row never exists pointing at
audio that is not there.

> **Note on loudness checks.** They require `ffmpeg` on the machine running the
> validator. Where it is missing, the validator reports those checks as
> **skipped** — never as passed. Make sure the machine used for the real check
> has it.

---

## 11. Definition of done for a module

A module is not done until **every** one of these is true:

1. Wording authored in full
2. Technique identified
3. `technique_key` supplied — not a placeholder
4. `intensity` supplied
5. Content approved by clinical review
6. Duration within its limit, and within its cross-recipe limit if it is to be reusable
7. Audio recorded
8. Audio passes the validator's technical checks
9. Manifest entry valid
10. Imported successfully
11. Audio uploaded to private storage
12. `approved` set true in production
13. Selectable by the composer
14. **Successfully played in a real composed session on a real device**

Item 14 has never been achieved by any module, because none exists. It is the
one that proves the whole chain.

---

## 12. Tranche completion checklist

Honest current status. **Nothing in this tranche has been started.**

| Module | Authored | Approved | Recorded | Audio valid | Manifest valid | Imported | Live | Device proven |
|---|---|---|---|---|---|---|---|---|
| `nr_arrive_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_regulate_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_reframe_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_prepare_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_close_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_regulate_long` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_ground_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_reframe_long` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_prepare_long` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_activate_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `nr_focus_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

**The first five are the milestone.** With those five approved, recorded and
imported, `nervous_ready` composes and plays at all four durations — and ELSEA
delivers its first real session. The other six change how it feels, not whether
it works.

---

## 13. Open decisions

Only decisions that genuinely need a human. Engineering questions the
repository already answers are excluded.

### CONTENT DECISION

1. **The technique, wording and delivery for all eleven modules.** The whole of
   §5.
2. **Whether each module requires headphones.**
3. **Whether `nr_close_short` can do its job in 11 seconds**, or whether 16
   seconds is needed — accepting that at 16s it cannot serve `wired_sleep` and
   a second closing module must be written for that recipe later.
4. **Target durations for the six depth modules.** Only upper bounds are fixed.

### CLINICAL / APPROVAL DECISION

5. **Every `technique_key`.** Naming these names a technique; engineering must
   not.
6. **The `intensity` scale.** The field accepts 1–10 and nothing defines what a
   3 means versus an 8. It is currently read by nothing, so it can also be
   deferred — but then it should be deferred deliberately rather than filled in
   arbitrarily.
7. **Approval of each module**, which is the only thing that makes content
   selectable.
8. **Confirmation of the six phase bands**, all currently marked provisional
   pending clinical review, and being used as settled because nothing else
   exists.

### PRODUCT DECISION

9. **Acceptable silence.** No threshold exists. With only the five core modules
   a twenty-minute session is 77% silence; with all eleven, 20%. There is no
   approved answer for what is acceptable, so "how many modules are enough"
   cannot be answered from the repository.
10. **Whether modules should be authored to their cross-recipe limits** (21s
    `orient`, 11s `close`) so one recording serves all five recipes, or to this
    recipe's more generous limits, accepting that separate modules will be
    needed for the others.
11. **Final module identifiers.** The `nr_*` names above are proposals and are
    free to change until content exists.

---

## Appendix — what engineering has already finished

So the author knows what is waiting for this content:

- The composer is deployed and selects modules by family, duration and approval
- Private audio storage is live; the client never receives a storage path
- The validator and importer are built and tested
- Manifest persistence, session timing, pause, resume and early exit are built
- All twenty recipe/duration cases are proven to compose

**The only thing standing between here and ELSEA's first real session is
approved content.**
