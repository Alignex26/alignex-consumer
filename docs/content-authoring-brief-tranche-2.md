# ELSEA — content authoring brief, Tranche 2: WOUND UP → HOME

**For the content author, clinical reviewer and voice producer.**
No knowledge of the codebase is needed to work from this document.

Prepared: 2026-09-09. Companion to
[`content-authoring-brief-tranche-1.md`](./content-authoring-brief-tranche-1.md).
Every number was read out of the running system, not estimated.

**This document contains no intervention content and proposes none.**

---

## Read this first — this tranche is much smaller than it looks

`wound_up_home` uses eight module families. **Five of them are already being
authored in Tranche 1.**

| Family | Needed here | Already in Tranche 1? |
|---|---|---|
| `orient` | `arrive` | **yes** |
| `regulate` | `downshift_arousal` | **yes** |
| `reframe` | `leave_work_behind` | **yes** |
| `ground` | `reconnect_to_now`, `settle` | **yes** |
| `close` | `close` | **yes** |
| `release` | `downshift_arousal` | no — new |
| `transition` | `leave_work_behind`, `reconnect_to_now` | no — new |
| `settle` | `reconnect_to_now`, `settle` | no — new |

A module is selectable by **any** recipe whose phase accepts its family and
whose time allocation it fits. Nothing about a module ties it to the recipe it
was written for.

### What this means, concretely

**If the five Tranche 1 core modules are authored to their cross-recipe
limits, this recipe needs only TWO new modules to compose at all:**

- one `transition` module (≤55s)
- one `settle` module (≤40s)

The `orient`, `regulate` and `close` modules from Tranche 1 cover three of the
five load-bearing slots here, because their cross-recipe ceilings (21s, 45s,
11s) are tighter than what this recipe's slots require (23s, 80s, 18s).

**This depends entirely on an open decision from Tranche 1** — whether those
modules are authored to cross-recipe limits or to the looser
`nervous_ready`-only limits. If they are written to the looser limits, this
recipe needs its own `orient`, `regulate` and `close`, and the tranche is five
new modules instead of two.

That decision is worth making before Tranche 1 recording starts, because it
changes the size of this tranche by more than half. It is listed again in §13.

> **How precise this is.** The two-module figure comes from the verified
> minimum set for this recipe — the set proven load-bearing by removing each
> member in turn until composition failed. That verification was run before
> Tranche 1 existed, so it did not have a `reframe` module available; with one,
> the true minimum may be smaller still.
>
> It cannot be pinned down further yet, because the Tranche 1 depth modules
> have no agreed durations — they are upper bounds, not decisions. **Once
> Tranche 1 durations are fixed, engineering should re-run the allocator and
> confirm exactly which slots this recipe still needs.** Treat two as the
> planning figure, not a guarantee.

---

## 1. Purpose of this tranche

### What `wound_up_home` is for

The end of a hard day. Someone is still carrying work — still keyed up, still
running the meeting again — and they are physically at home but not actually
there yet. This pathway is about closing that gap.

It is the most ordinary and probably the most frequent use of ELSEA: not a
crisis, just the daily transition most people make badly.

### Where someone starts

One of the approved starting states that routes here: `wound_up`, `angry` or
`overwhelmed`. These are canonical system values, not words shown on screen.

### Where they are meant to arrive

`home` — labelled **Calmer** on screen — or `settled`, labelled **Settled**.
Both destinations use this same pathway. The label and the canonical value are
deliberately different, and the canonical value is never renamed to match.

### What the author is responsible for

The technique in each module and its name (`technique_key`); the wording;
delivery, pacing and tone; whether a module needs headphones; the intensity
rating; and the approval decision.

### What engineering is responsible for

Choosing which modules play and in what order; placing silence; timing, fades,
pause and resume; storing and delivering audio securely; and never letting
unapproved content into a session.

**Engineering will not write, edit, shorten or approve any content.**

---

## 2. The user journey

Identical in shape to Tranche 1:

```
the person describes how they feel, in their own words
        ↓
a safety check runs on the server        ← their words go here and nowhere else
        ↓
ELSEA interprets a starting state         (e.g. wound up)
        ↓
they choose where they want to get to     (Calmer → home)
        ↓
they choose how long they have            (5, 10, 15 or 20 minutes)
        ↓
a session is composed for them
        ↓
they listen, and can pause or leave early
        ↓
they say how it went
```

**Nobody receives a script.** Every session is assembled at the moment it is
requested. Each module must stand alone, must end somewhere the next can begin
from, and must never refer to another module, to the session's structure, or to
how much time is left.

---

## 3. The locked recipe structure

Six phases, in this order, every time. **Fixed; not open for change in this
tranche.** All bands are provisional pending clinical review, and are being
used as settled because nothing else exists.

| # | Phase | What this phase is for, in plain English | Eligible families | Min | Max |
|---:|---|---|---|---:|---:|
| 0 | `arrive` | Land. They have just walked in from their day. | `orient` | 20s | 60s |
| 1 | `downshift_arousal` | Bring the body down out of the day's activation. | `regulate`, `release` | 60s | 300s |
| 2 | `leave_work_behind` | Put down what is still being carried. | `reframe`, `transition` | 45s | 240s |
| 3 | `reconnect_to_now` | Arrive in the place they are actually in. | `ground`, `transition`, `settle` | 45s | 360s |
| 4 | `settle` | Come to rest. | `settle`, `ground` | 30s | 240s |
| 5 | `close` | End cleanly and hand them back to their evening. | `close` | 15s | 45s |

### The composition constraint that matters most here

**Three families each serve two phases** — `transition` (phases 2 and 3),
`ground` (3 and 4) and `settle` (3 and 4). In `nervous_ready` only one family
does this.

The consequence is in §7, and it is the single most important thing for an
author to understand about this recipe.

---

## 4. Modules required for this tranche

**Eleven slots**, of which — see the opening section — as few as **two may be
genuinely new**.

### The five that make the pathway work

| Module | Family | Intended role | Max (this recipe) | Max if reusable | New, or covered by Tranche 1? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---:|---|---|---|---|---|
| `wuh_arrive_short` | `orient` | Land them out of the day | ≤23s | **≤21s** | covered, if T1 authored to 21s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_downshift_short` | `regulate` | Bring activation down | ≤80s | **≤45s** | covered, if T1 authored to 45s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_transition_short` | `transition` | Put the day down | **≤61s** | **≤55s** | **NEW** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_settle_short` | `settle` | Come to rest | ≤47s | **≤40s** | **NEW** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_close_short` | `close` | End cleanly | ≤18s | **≤11s** | covered, if T1 authored to 11s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

`wuh_transition_short` is sized to **61s, not 71s** — the tighter of the two
phases it serves. At 71s it would be unselectable in `leave_work_behind` at
five minutes and the phase would fail.

### The six that add depth

Without these, a twenty-minute session is **72% silence**. With them, 15%.

| Module | Family | Intended role | Max | New? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---|---|---|---|---|
| `wuh_release_mid` | `release` | An alternative to regulation in the same phase | ≤290s | **NEW** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_regulate_long` | `regulate` | Longer downshift | ≤290s | family shared with T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_reframe_mid` | `reframe` | Put the day down, differently | ≤231s | family shared with T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_transition_long` | `transition` | Longer version, serves both phases | ≤231s | **NEW** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_ground_mid` | `ground` | Reconnect to the present | ≤231s | family shared with T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `wuh_settle_mid` | `settle` | Longer settling | ≤231s | **NEW** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

### Values this brief cannot supply

`technique_key` — **TO DECIDE, clinical.**
`intensity` — **TO DECIDE, clinical.** 1–10 accepted; no scale defined.
`requires_headphones` — **TO DECIDE per module**, content.

---

## 5. Authoring sheet for each module

Copy one block per module. **Fields marked REQUIRED are deliberately empty.**

---

### MODULE: `wuh_transition_short`  ← highest priority, genuinely new
```
FAMILY:                 transition
TARGET DURATION:        55s or under (see note)
MAXIMUM DURATION:       61s in this recipe / 55s if reusable across recipes
USED IN:                wound_up_home → leave_work_behind
                        wound_up_home → reconnect_to_now
                        (eligible for both; MAY PLAY TWICE — see §7)
PURPOSE:                Put down what is still being carried from the day.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in BOTH phases, and must not
                        sound odd if the listener hears it twice in one
                        session. See §7 before writing this one.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_transition_short.m4a
```

---

### MODULE: `wuh_settle_short`  ← genuinely new
```
FAMILY:                 settle
TARGET DURATION:        40s or under (see note)
MAXIMUM DURATION:       47s in this recipe / 40s if reusable across recipes
USED IN:                wound_up_home → settle
                        Also eligible for reconnect_to_now
PURPOSE:                Come to rest.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_settle_short.m4a
```

---

### MODULE: `wuh_arrive_short`
```
FAMILY:                 orient
TARGET DURATION:        21s or under
MAXIMUM DURATION:       23s in this recipe / 21s if reusable across recipes
USED IN:                wound_up_home → arrive
                        Also eligible for the opening phase of all five recipes
PURPOSE:                Land them out of the day and into the session.
NOTE:                   NOT REQUIRED if the Tranche 1 orient module is
                        authored at 21s or under — that module already covers
                        this slot.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_arrive_short.m4a
```

---

### MODULE: `wuh_downshift_short`
```
FAMILY:                 regulate
TARGET DURATION:        45s or under
MAXIMUM DURATION:       80s in this recipe / 45s if reusable across recipes
USED IN:                wound_up_home → downshift_arousal
NOTE:                   NOT REQUIRED if the Tranche 1 regulate module is
                        authored at 45s or under.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_downshift_short.m4a
```

---

### MODULE: `wuh_close_short`
```
FAMILY:                 close
TARGET DURATION:        11s or under
MAXIMUM DURATION:       18s in this recipe / 11s if reusable across recipes
USED IN:                wound_up_home → close
                        Also eligible for the closing phase of all five recipes
PURPOSE:                End cleanly, into an evening rather than into a task.
NOTE:                   NOT REQUIRED if the Tranche 1 close module is authored
                        at 11s or under.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_close_short.m4a
```

---

### MODULE: `wuh_release_mid`  ← genuinely new
```
FAMILY:                 release
TARGET DURATION:        REQUIRED — up to 290s
MAXIMUM DURATION:       290s
USED IN:                wound_up_home → downshift_arousal
PURPOSE:                A different way of filling the downshift phase, so it
                        is not identical every time.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_release_mid.m4a
```

---

### MODULE: `wuh_regulate_long`
```
FAMILY:                 regulate
TARGET DURATION:        REQUIRED — up to 290s
MAXIMUM DURATION:       290s
USED IN:                wound_up_home → downshift_arousal
PURPOSE:                Longer downshift for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_regulate_long.m4a
```

---

### MODULE: `wuh_reframe_mid`
```
FAMILY:                 reframe
TARGET DURATION:        REQUIRED — up to 231s
MAXIMUM DURATION:       231s
USED IN:                wound_up_home → leave_work_behind
PURPOSE:                Put the day down by changing the relationship to it.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_reframe_mid.m4a
```

---

### MODULE: `wuh_transition_long`  ← genuinely new
```
FAMILY:                 transition
TARGET DURATION:        REQUIRED — up to 231s
MAXIMUM DURATION:       231s
USED IN:                wound_up_home → leave_work_behind
                        wound_up_home → reconnect_to_now
                        (eligible for both; MAY PLAY TWICE — see §7)
PURPOSE:                A longer version of putting the day down.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in both phases
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_transition_long.m4a
```

---

### MODULE: `wuh_ground_mid`
```
FAMILY:                 ground
TARGET DURATION:        REQUIRED — up to 231s
MAXIMUM DURATION:       231s
USED IN:                wound_up_home → reconnect_to_now
                        wound_up_home → settle
                        (eligible for both; MAY PLAY TWICE — see §7)
PURPOSE:                Arrive in the place they are actually in.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in both phases
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_ground_mid.m4a
```

---

### MODULE: `wuh_settle_mid`  ← genuinely new
```
FAMILY:                 settle
TARGET DURATION:        REQUIRED — up to 231s
MAXIMUM DURATION:       231s
USED IN:                wound_up_home → reconnect_to_now
                        wound_up_home → settle
                        (eligible for both; MAY PLAY TWICE — see §7)
PURPOSE:                Longer settling.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in both phases
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        wuh_settle_mid.m4a
```

---

## 6. Duration is a hard constraint

Unchanged from Tranche 1, and it applies identically here. A module longer than
its slot is not shortened — **it is skipped**, silently.

### What each phase actually gets

| Phase | 5 min | 10 min | 15 min | 20 min |
|---|---:|---:|---:|---:|
| `arrive` | **23s** | 35s | 47s | 58s |
| `downshift_arousal` | **80s** | 150s | 220s | 290s |
| `leave_work_behind` | **61s** | 118s | 175s | 231s |
| `reconnect_to_now` | **71s** | 163s | 254s | 346s |
| `settle` | **47s** | 108s | 170s | 231s |
| `close` | **18s** | 26s | 34s | 44s |

**The five-minute column is the hard ceiling on every short module.**

### A module must fit the tightest slot in ANY recipe that can use it

This recipe's slots are slightly *more* generous than `nervous_ready`'s at the
edges — 23s versus 22s for `arrive`, 18s versus 16s for `close`. That makes it
tempting to write to these numbers. Don't: a `close` module written at 18s is
unusable in `nervous_ready` (16s) and in `wired_sleep` (11s).

**The cross-recipe ceilings are the ones to author to**, unless a deliberate
decision is made otherwise.

### One module serving two phases takes the tighter of the two

`wuh_transition_short` serves `leave_work_behind` (61s) and `reconnect_to_now`
(71s). It must be **≤61s**, or it silently stops being selectable in the first
of them at five minutes.

### Choose durations deliberately, not just "as many modules as possible"

With the full eleven modules, measured silence runs **3% / 25% / 12% / 15%**
across the four session lengths. That is not a mistake: the ten-minute session
is emptier than the fifteen-minute one, because of which module durations
happen to fit which slots.

**Inventory duration choice matters more than inventory size.** A module at the
right length removes more silence than two at awkward ones.

---

## 7. Cross-phase repetition — the distinctive issue in this recipe

**Read this before writing `wuh_transition_short`, `wuh_transition_long`,
`wuh_ground_mid` or `wuh_settle_mid`.**

### What happens

Three families here each serve two different phases. A module belongs to a
family, so a module in one of those families can be chosen for **both** phases
in the same session.

With the minimum inventory, this recipe produces **6 module segments at five
minutes and 7 at longer durations, from only 5 distinct modules**. One or two
modules therefore play twice in a single session.

No module ever repeats *within* one phase. The repetition is across phases —
typically `leave_work_behind` and `reconnect_to_now`, which are adjacent.

### Why it is not a bug

It follows directly from the approved family eligibility. It is a content
judgement with an engineering consequence, not a defect, and nothing is being
changed to prevent it.

### What it means for authoring

A module in `transition`, `ground` or `settle` should be written so that
hearing it twice in one session is not jarring. In practice that argues for
content that does not announce itself as a one-time event — but **that is a
content judgement and this brief does not make it.**

The alternative is to author more modules in those three families so the
composer has enough distinct options to avoid reuse. That is the product
decision in §13.

---

## 8. Audio production requirements

Identical to Tranche 1, and enforced automatically.

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

**Name each delivered file `<module_key>.m4a`** — e.g.
`wuh_transition_short.m4a`. Lower case letters, digits and underscores only.

Trim leading and trailing silence to ≤100ms: silence inside a file is invisible
to the engine and makes the session's timing drift. Do not apply fades — the
player applies its own 250ms ramp at every boundary, and a baked-in fade is
applied twice.

**Consistency matters more than usual in this recipe.** Because modules repeat
across phases here, a loudness or tone mismatch between neighbours is heard
more often than in other pathways.

Voice, delivery, pacing, tone and headphone requirements are not specified
anywhere, and are yours.

---

## 9. Manifest handoff

One data file describing every module, plus one folder of audio named
`<module_key>.m4a`.

| Field | Plain English | Who supplies it |
|---|---|---|
| `module_key` | Identifier, e.g. `wuh_transition_short`. Lower case, unique. | product |
| `family` | One of the twelve families, lower case. | fixed by this brief |
| `technique_key` | Name of the technique. **Must not be a placeholder.** | clinical |
| `duration_seconds` | Whole seconds. Must match the file within 0.25s. | content |
| `intensity` | Optional. Whole number 1–10. | clinical |
| `requires_headphones` | true or false | content |
| `is_bed` | `false` for every module in this tranche | product |
| `approved` | **Explicitly** true or false | clinical |
| `version` | Optional, defaults to 1. Raise only when replacing audio. | product |
| `storage_path` | `modules/<family>/<module_key>.m4a` | engineering |

The shape, illustrative only — **not content**:

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

---

## 10. Validation process

```
author → clinical approval → record → prepare manifest
      → validate → dry-run import → commit import → selectable
```

Validate — safe to run repeatedly, changes nothing:

```bash
node scripts/modules-validate.mjs <manifest.json> --audio-dir <folder>
```

Dry run — **the default**; writes and uploads nothing:

```bash
node scripts/modules-import.mjs <manifest.json> --audio-dir <folder>
```

Real import — needs the explicit `--commit` flag and a service-role key
supplied for that one command:

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/modules-import.mjs <manifest.json> --audio-dir <folder> --commit
```

The import validates first and refuses on any failure. Audio uploads before
rows are written, so a module row never points at audio that is not there.

> Loudness checks need `ffmpeg` on the machine running the validator. Without
> it those checks report as **skipped**, never as passed.

---

## 11. Definition of done for a module

Unchanged from Tranche 1. A module is done only when all fourteen are true:
wording authored; technique identified; `technique_key` supplied; `intensity`
supplied; content approved; duration within its limit **and its cross-recipe
limit if it is to be reusable**; audio recorded; audio passes technical
validation; manifest entry valid; imported; uploaded to private storage;
`approved` true in production; selectable by the composer; and **successfully
played in a real composed session on a real device**.

No module in any tranche has reached item 14, because none exists.

---

## 12. Tranche completion checklist

Honest current status. **Nothing in this tranche has been started.**

| Module | Authored | Approved | Recorded | Audio valid | Manifest valid | Imported | Live | Device proven |
|---|---|---|---|---|---|---|---|---|
| `wuh_transition_short` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_settle_short` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_arrive_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_downshift_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_close_short` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_release_mid` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_regulate_long` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_reframe_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_transition_long` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_ground_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `wuh_settle_mid` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

**The milestone is the first two rows.** With Tranche 1 complete and authored
to cross-recipe limits, `wuh_transition_short` and `wuh_settle_short` are all
that stand between here and `wound_up_home` composing at every duration.

---

## 13. Open decisions

### CONTENT DECISION

1. **Technique, wording and delivery** for every module in §5.
2. **Whether a module heard twice in one session is acceptable**, and whether
   it matters more when the two occurrences are in adjacent phases. See §7.
3. **`requires_headphones`** per module.
4. **Target durations for the six depth modules.** Only upper bounds are fixed,
   and §6 shows the choice affects silence more than the module count does.
5. **Whether `wuh_transition_short` can do its job in 55s**, given it must
   serve two phases and may be heard twice.

### CLINICAL / APPROVAL DECISION

6. **Every `technique_key`.**
7. **The `intensity` scale** — unchanged from Tranche 1 and still undefined.
8. **Approval of each module.**
9. **Confirmation of the six phase bands**, all still provisional.

### PRODUCT DECISION

10. **Whether Tranche 1 modules are authored to cross-recipe limits.** This
    changes Tranche 2 from five new core modules to two. It should be settled
    before Tranche 1 recording begins, not after.
11. **Acceptable silence.** Still no threshold. Minimum inventory gives 3% /
    44% / 63% / 72%; the full eleven give 3% / 25% / 12% / 15%.
12. **Whether to add more `transition`, `ground` and `settle` modules** to
    reduce cross-phase repetition, rather than authoring around it.
13. **Final module identifiers.** The `wuh_*` names are proposals.

---

## Appendix — how this tranche relates to Tranche 1

| | Tranche 1 — `nervous_ready` | Tranche 2 — `wound_up_home` |
|---|---|---|
| Slots | 11 | 11 |
| Genuinely new families | 8 | **3** (`release`, `transition`, `settle`) |
| Families reused from T1 | — | 5 |
| Minimum new modules to compose | 5 | **2**, if T1 authored to cross-recipe limits |
| Distinctive issue | tightest `close` slot in the product | cross-phase repetition |
| Silence, minimum inventory | 8 / 54 / 69 / 77% | 3 / 44 / 63 / 72% |
| Silence, full inventory | 8 / 12 / 14 / 20% | 3 / 25 / 12 / 15% |

**Each further tranche should get cheaper**, as the shared families fill up.
That only holds if modules are authored to their cross-recipe ceilings — which
is why decision 10 is the one worth making first.
