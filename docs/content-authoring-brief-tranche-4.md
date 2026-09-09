# ELSEA — content authoring brief, Tranche 4: WIRED → SLEEP

**For the content author, clinical reviewer and voice producer.**
No knowledge of the codebase is needed to work from this document.

Prepared: 2026-09-09. Fourth in the series. Every number was read out of the
running system.

**This document contains no intervention content and proposes none.**

---

## Read this first — two things make this tranche different

### 1. It introduces the last new family in the product

`sleep` appears in this recipe and nowhere else. It is the twelfth and final
family. Everything else `wired_sleep` needs — `orient`, `settle`, `release`,
`regulate`, `reframe`, `close` — is already covered by Tranches 1 and 2.

### 2. It contains the tightest slot in the entire product, and a known variety problem

The `close` phase here is allocated **11 seconds** at five minutes. Not 15, not
16 — eleven. A `close` module written for any other recipe (15–18s) **cannot
fill it**, and no five-minute `wired_sleep` session composes without one that
does.

That single constraint has a measured consequence. Simulating thirty repeat
sessions of this recipe against the planned inventory:

| Recipe | Distinct sessions in 30 | Most-used module |
|---|---:|---|
| `nervous_ready` | 30 / 30 | — |
| `flat_go` | 15 / 30 | — |
| `scattered_focused` | 13 / 30 | — |
| `wound_up_home` | 12 / 30 | — |
| **`wired_sleep`** | **7 / 30** | **the 10s sleep module — in all 30** |

One module appeared in **every single session**, because it is the only thing
short enough for that slot. No amount of engineering varies a slot with one
candidate.

> **This is flagged in the repository as CONTENT INVENTORY EXPANSION DECISION
> REQUIRED.** Modules were deliberately not invented to improve the number. It
> is the single most consequential content decision in this tranche, and it is
> in §13.

---

## 1. Purpose of this tranche

### What `wired_sleep` is for

Someone is exhausted and cannot sleep. Tired but wired — the body wants rest
and the system will not come down. It is late, and the day will not let go.

Distinct from `wound_up_home`, which is about arriving home. This is about
arriving at sleep, and it ends with the person leaving rather than continuing.

### Where someone starts

`tired_wired`, `wound_up` or `anxious`. Canonical system values, not words on
screen.

### Where they are meant to arrive

`sleep` — labelled **Rested**. The canonical value is never renamed to match
the label.

> Someone interpreted as `tired_wired` is offered **only this destination**.
> Every other target card is shown disabled, because no approved route exists
> from `tired_wired` to anything else. That is the transition map working, not
> a fault.

### Responsibilities

**Author:** technique and `technique_key`; wording; delivery, pacing and tone;
headphone requirement; intensity; approval.

**Engineering:** module selection and order; silence; timing, fades, pause and
resume; secure storage and delivery; and never letting unapproved content into
a session.

**Engineering will not write, edit, shorten or approve any content.**

---

## 2. The user journey

```
the person describes how they feel, in their own words
        ↓
a safety check runs on the server        ← their words go here and nowhere else
        ↓
ELSEA interprets a starting state         (e.g. tired_wired)
        ↓
the destination is Rested — the only one offered from this state
        ↓
they choose how long they have            (5, 10, 15 or 20 minutes)
        ↓
a session is composed for them
        ↓
they listen, and can pause or leave early
        ↓
they say how it went
```

**One thing is different here.** In every other pathway the person is being
handed back to their day. Here they are, ideally, asleep — or close to it — by
the end. **The session may well not be heard to completion, and that is a
success, not a failure.** The outcome question may be answered the next day, or
never.

**Nobody receives a script.** Each module must stand alone and must never refer
to another module, to the session's structure, or to how much time is left.

---

## 3. The locked recipe structure

Six phases, in this order, every time. **Fixed.** All bands provisional pending
clinical review.

| # | Phase | What this phase is for, in plain English | Eligible families | Min | Max |
|---:|---|---|---|---:|---:|
| 0 | `arrive` | Land. It is late and they have stopped. | `orient` | 20s | 60s |
| 1 | `settle_body` | Let the body come down. | `settle`, `release` | 60s | 360s |
| 2 | `slow_system` | Slow the whole system. | `regulate`, `settle` | 45s | 300s |
| 3 | `release_thoughts` | Put down what the mind is still running. | `release`, `reframe` | 45s | 300s |
| 4 | `allow_sleep` | Stop trying, and allow it. | `sleep`, `settle` | 60s | 480s |
| 5 | `close` | Leave, quietly. | `close`, `sleep` | **10s** | 45s |

Note the `close` floor: **10 seconds**, lower than every other recipe's 15.

Family reuse is heavy here: **`settle` spans three phases** (1, 2 and 4), and
`release` and `sleep` span two each.

---

## 4. Modules required for this tranche

### The six that make the pathway work

| Module | Family | Intended role | Max (this recipe) | Max if reusable | Covered earlier? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---:|---|---|---|---|---|
| `ws_arrive` | `orient` | Land, late | ≤22s | **≤21s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `ws_settle_body` | `settle` or `release` | Let the body come down | ≤74s | **≤40s** / **≤45s** | yes — T2 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `ws_slow_system` | `regulate` or `settle` | Slow the system | ≤57s | **≤45s** / **≤40s** | yes — T1/T2 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `ws_release_thoughts` | `release` or `reframe` | Put the mind down | ≤57s | **≤45s** / **≤40s** | yes — T1/T2 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `ws_allow_sleep` | `sleep` or `settle` | Allow sleep | ≤79s | — | **NEW family** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `ws_close` | `close` or `sleep` | Leave quietly | **≤11s** | **≤11s** | **NEW — nothing else fits** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

### The `sleep` family — new, and the depth this recipe needs

`allow_sleep` grows from 79s at five minutes to **369s** at twenty. The
consolidated plan allows four `sleep` modules at roughly 10s, 90s, 150s and
200s.

| Module | Family | Serves | Target length | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---|---|---|---|
| `sleep_10s` | `sleep` | `close` — **the 11s slot** | ~10s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sleep_mid` | `sleep` | `allow_sleep` | ~90s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sleep_long` | `sleep` | `allow_sleep` | ~150s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sleep_xlong` | `sleep` | `allow_sleep` at 15–20 min | ~200s | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

**`sleep_10s` is the module that appears in all thirty simulated sessions.**
See §7.

### Values this brief cannot supply

`technique_key` — **TO DECIDE, clinical.**
`intensity` — **TO DECIDE, clinical.** 1–10 accepted; no scale defined.
`requires_headphones` — **TO DECIDE per module**, content. Worth particular
thought here: someone falling asleep in headphones is a different proposition
from someone using them at a desk.

---

## 5. Authoring sheet for each module

Copy one block per module. **Fields marked REQUIRED are deliberately empty.**

---

### MODULE: `sleep_10s`  ← the tightest slot in the product
```
FAMILY:                 sleep   (or close — REQUIRED, choose one)
TARGET DURATION:        10s
MAXIMUM DURATION:       11s. Not 12.
USED IN:                wired_sleep → close
PURPOSE:                Leave the person, quietly, at the end of the session.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED. Two things to know before writing this:
                        (1) It is eleven seconds. Nothing longer can be used,
                            and no five-minute session in this recipe exists
                            without it.
                        (2) As things stand it plays in EVERY session of this
                            recipe, because nothing else fits. Read §7.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sleep_10s.m4a
```

---

### MODULE: `sleep_mid`  ← new family
```
FAMILY:                 sleep
TARGET DURATION:        REQUIRED — around 90s
MAXIMUM DURATION:       176s (allow_sleep at 10 min)
USED IN:                wired_sleep → allow_sleep
PURPOSE:                Allow sleep rather than pursue it.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — the listener may fall asleep during this
                        module. It should not require them to stay awake for
                        anything that follows.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sleep_mid.m4a
```

---

### MODULE: `sleep_long`  ← new family
```
FAMILY:                 sleep
TARGET DURATION:        REQUIRED — around 150s
MAXIMUM DURATION:       272s (allow_sleep at 15 min)
USED IN:                wired_sleep → allow_sleep
PURPOSE:                A longer allowing, for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sleep_long.m4a
```

---

### MODULE: `sleep_xlong`  ← new family
```
FAMILY:                 sleep
TARGET DURATION:        REQUIRED — around 200s
MAXIMUM DURATION:       369s (allow_sleep at 20 min)
USED IN:                wired_sleep → allow_sleep at 15 and 20 minutes
PURPOSE:                Sustained allowing for the longest sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — most likely to be playing at the moment the
                        person actually falls asleep.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sleep_xlong.m4a
```

---

### MODULE: `ws_settle_body`
```
FAMILY:                 settle  OR  release  — REQUIRED, choose one
TARGET DURATION:        40s (settle) or 45s (release) or under
MAXIMUM DURATION:       74s in this recipe
USED IN:                wired_sleep → settle_body
PURPOSE:                Let the body come down.
NOTE:                   May already be covered by the Tranche 2 settle or
                        release module.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        ws_settle_body.m4a
```

---

### MODULE: `ws_slow_system`
```
FAMILY:                 regulate  OR  settle  — REQUIRED, choose one
TARGET DURATION:        40s (settle) or 45s (regulate) or under
MAXIMUM DURATION:       57s in this recipe
USED IN:                wired_sleep → slow_system
PURPOSE:                Slow the whole system down.
NOTE:                   May already be covered by Tranche 1 regulate or
                        Tranche 2 settle.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        ws_slow_system.m4a
```

---

### MODULE: `ws_release_thoughts`
```
FAMILY:                 release  OR  reframe  — REQUIRED, choose one
TARGET DURATION:        40s (reframe) or 45s (release) or under
MAXIMUM DURATION:       57s in this recipe
USED IN:                wired_sleep → release_thoughts
PURPOSE:                Put down what the mind is still running.
NOTE:                   May already be covered by Tranche 1 reframe or
                        Tranche 2 release.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        ws_release_thoughts.m4a
```

---

### MODULE: `ws_arrive`
```
FAMILY:                 orient
TARGET DURATION:        21s or under
MAXIMUM DURATION:       22s in this recipe / 21s if reusable
USED IN:                wired_sleep → arrive
NOTE:                   NOT REQUIRED if the Tranche 1 orient module is
                        authored at 21s or under. Consider whether a late-night
                        arrival needs different delivery from a daytime one —
                        that is a content judgement, not a technical one.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        ws_arrive.m4a
```

---

## 6. Duration is a hard constraint

A module longer than its slot is not shortened — **it is skipped**, silently.

### What each phase actually gets

| Phase | 5 min | 10 min | 15 min | 20 min |
|---|---:|---:|---:|---:|
| `arrive` | **22s** | 31s | 40s | 49s |
| `settle_body` | **74s** | 143s | 212s | 281s |
| `slow_system` | **57s** | 115s | 174s | 233s |
| `release_thoughts` | **57s** | 115s | 174s | 233s |
| `allow_sleep` | **79s** | 176s | 272s | 369s |
| `close` | **11s** | 20s | 28s | 35s |

### Eleven seconds

The `close` slot at five minutes is **11 seconds**. This is the hardest
constraint in the product and it cannot be worked around:

- A `close` module written for the other four recipes (15–18s) **will not fit**.
- Without a module of 11s or less, **no five-minute `wired_sleep` session
  exists at all** — the phase cannot be filled and the whole composition fails.
- Writing it at 12s does not "nearly work". It does not work.

If eleven seconds is not enough to close a sleep session properly, **that is a
real finding and should be raised** — not solved by overrunning, which would
silently remove the five-minute session from this pathway.

### Spread the `sleep` durations

`allow_sleep` runs from 79s to 369s. Four `sleep` modules clustered at similar
lengths leave the twenty-minute session mostly silence. Roughly 10 / 90 / 150 /
200 seconds is the assumed shape.

---

## 7. The variety problem — measured, not predicted

**Read this before deciding how many modules this tranche gets.**

Thirty consecutive sessions of each recipe were simulated against the planned
inventory. `wired_sleep` produced **7 distinct sessions out of 30** — the worst
in the product by a wide margin, against 30 out of 30 for `nervous_ready`.

`sleep_10s` appeared in **all thirty**.

### Why

It is the only module short enough for the 11-second `close` slot. Every
session in this recipe therefore ends with the same ten seconds of audio. The
system has a freshness mechanism, but **no mechanism can vary a slot with one
candidate in it.**

### What would change it

More short modules eligible for `close` — that is, more `close` or `sleep`
modules at **11 seconds or less**. That is a content decision about how much
content this pathway warrants, and it is in §13. Engineering deliberately did
not invent modules to improve the number.

### What it means for authoring `sleep_10s`

Until that decision is made, assume **every person using this pathway hears
this module every single time**. Someone using ELSEA nightly hears it nightly.
Whether that is acceptable — or even desirable, as a consistent closing ritual
— is a content judgement this brief does not make.

---

## 8. Audio production requirements

Enforced automatically. A file that misses any of these is rejected.

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

**Name each delivered file `<module_key>.m4a`** — e.g. `sleep_10s.m4a`.

**The loudness target is not negotiable downward for this recipe.** It is
tempting to record sleep content quieter. Do not: the person sets their own
volume, and a module quieter than its neighbours produces a level jump at every
boundary — the opposite of what this pathway is for. Deliver at −16 LUFS like
everything else and let quietness come from delivery, not from level.

Trim leading and trailing silence to ≤100ms. Do not apply fades; the player
applies its own 250ms ramp.

Voice, delivery, pacing, tone and headphone requirements are yours.

---

## 9. Manifest handoff

One data file per tranche, plus one folder of audio named `<module_key>.m4a`.

| Field | Plain English | Who supplies it |
|---|---|---|
| `module_key` | Identifier, lower case, unique | product |
| `family` | One of the twelve families, lower case | fixed by this brief |
| `technique_key` | Name of the technique. **Not a placeholder.** | clinical |
| `duration_seconds` | Whole seconds; must match the file within 0.25s | content |
| `intensity` | Optional; whole number 1–10 | clinical |
| `requires_headphones` | true or false | content |
| `is_bed` | `false` for every module in this tranche | product |
| `approved` | **Explicitly** true or false | clinical |
| `version` | Optional, defaults to 1 | product |
| `storage_path` | `modules/<family>/<module_key>.m4a` | engineering |

Illustrative shape is in
[Tranche 1 §9](./content-authoring-brief-tranche-1.md).

---

## 10. Validation process

```
author → clinical approval → record → prepare manifest
      → validate → dry-run import → commit import → selectable
```

```bash
# safe to run repeatedly; changes nothing
node scripts/modules-validate.mjs <manifest.json> --audio-dir <folder>

# dry run — the default; writes and uploads nothing
node scripts/modules-import.mjs <manifest.json> --audio-dir <folder>

# real import — needs the explicit flag and a service-role key
SUPABASE_SERVICE_ROLE_KEY=... node scripts/modules-import.mjs <manifest.json> --audio-dir <folder> --commit
```

> **The 0.25s duration tolerance will bite hardest on `sleep_10s`.** A module
> declared at 10s must measure 9.75–10.25s. Check it before delivery.

> **ffmpeg is required to import.** The audio checks — codec, sample rate,
> channels, bitrate, duration, loudness and true peak — all need `ffmpeg` and
> `ffprobe` on the machine running the validator. Without them the only thing
> known about a file is that it exists and is not empty: **a text file renamed
> `.m4a` passes.**
>
> So the validator reports those checks as **skipped, never as passed**, and
> **the importer refuses to `--commit`** until they have actually run. A dry run
> still works, because it writes nothing.
>
> Install ffmpeg before delivery. Importing unchecked masters is possible only
> by passing `--allow-unverified-audio` deliberately, and it is how
> non-conforming audio reaches a device after a tranche has been recorded.

---

## 11. Definition of done for a module

Unchanged across all tranches. All fourteen must be true: wording authored;
technique identified; `technique_key` supplied; `intensity` supplied; content
approved; duration within its limit **and its cross-recipe limit if reusable**;
audio recorded; audio passes technical validation; manifest valid; imported;
uploaded to private storage; `approved` true in production; selectable by the
composer; and **successfully played in a real composed session on a real
device**.

No module in any tranche has reached item 14.

---

## 12. Tranche completion checklist

Honest current status. **Nothing in this tranche has been started.**

| Module | Authored | Approved | Recorded | Audio valid | Manifest valid | Imported | Live | Device proven |
|---|---|---|---|---|---|---|---|---|
| `sleep_10s` **NEW — critical** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sleep_mid` **NEW family** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sleep_long` **NEW family** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sleep_xlong` **NEW family** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_settle_body` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_slow_system` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_release_thoughts` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_allow_sleep` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_arrive` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `ws_close` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

**`sleep_10s` is the gating module.** Without it this recipe has no
five-minute session at all.

---

## 13. Open decisions

### CONTENT DECISION

1. **Technique, wording and delivery** for every module in §5.
2. **Whether an 11-second close can do the job.** If not, that is a real
   finding to raise — the alternative is losing the five-minute session from
   this pathway entirely.
3. **Which family fills the either/or slots** — `ws_settle_body`,
   `ws_slow_system`, `ws_release_thoughts`, `ws_allow_sleep`, `ws_close`.
4. **The four `sleep` durations.** Roughly 10 / 90 / 150 / 200s is assumed.
5. **`requires_headphones`** per module — with particular attention to someone
   falling asleep wearing them.
6. **Whether the same `orient` and `regulate` content suits a late-night
   session** as suits a daytime one, or whether this pathway wants its own.

### CLINICAL / APPROVAL DECISION

7. **Every `technique_key`.**
8. **The `intensity` scale** — still undefined.
9. **Approval of each module.**
10. **Confirmation of the six phase bands**, including the 10-second `close`
    floor that is unique to this recipe.

### PRODUCT DECISION

11. **CONTENT INVENTORY EXPANSION — the significant one.** `wired_sleep`
    produces 7 distinct sessions in 30, and one module plays in every session.
    Options the architecture already supports:
    - **Accept it.** A consistent closing ritual may be right for sleep.
      Costs nothing; a nightly user hears the same ten seconds nightly.
    - **Add more `close`/`sleep` modules at ≤11s.** Directly increases variety
      in the slot that has none. Costs authoring and recording.
    - **Add depth elsewhere in the recipe.** Improves the other five phases;
      does nothing for the closing slot, which stays identical every time.

    No recommendation is made here: the repository contains no approved
    freshness threshold, so there is nothing to derive an answer from.
12. **Acceptable silence** — still no threshold anywhere.
13. **Final module identifiers.** The `ws_*` and `sleep_*` names are proposals.

---

## Appendix — where this sits in the series

| | T1 | T2 | T3 | T4 `wired_sleep` |
|---|---|---|---|---|
| New families | 8 | 3 | 0 | **1** — `sleep`, the last |
| Distinctive issue | tightest `close` at 16s | cross-phase repetition | one family, three phases | **11s close, 7/30 variety** |
| Tightest slot | 16s | 18s | 16s | **11s** |
| Real work | the whole core | `transition` + `settle` | `focus` depth | **the `sleep` family** |

With this tranche, all twelve families exist. Tranche 5 introduces none.
