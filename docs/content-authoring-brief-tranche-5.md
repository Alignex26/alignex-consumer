# ELSEA — content authoring brief, Tranche 5: FLAT → GO

**For the content author, clinical reviewer and voice producer.**
No knowledge of the codebase is needed to work from this document.

Prepared: 2026-09-09. Last in the series. Every number was read out of the
running system.

**This document contains no intervention content and proposes none.**

---

## Read this first — no new families, one structural trap

`flat_go` introduces **no new module families**. Everything it needs —
`orient`, `activate`, `regulate`, `reframe`, `focus`, `prepare`, `close` — is
covered by earlier tranches.

It has two features nothing else in the product has:

### 1. Seven phases, not six

The only recipe with an extra phase. `find_direction` and `choose_first_move`
are separate steps here, where other recipes fold that work together.

### 2. `activate` is eligible in three phases AND is the only family for one of them

`wake_body` accepts **`activate` and nothing else**. `activate` is also
eligible in `raise_energy` and `build_momentum`. Since no module plays twice in
a session, a single session can consume three distinct `activate` modules — and
the first phase has no alternative family to fall back on.

> **This already caused a real failure.** With one short `activate` module,
> `wake_body` consumed it, and `build_momentum` — allocated 68s — then had
> nothing short enough left, because the next `activate` was too long and
> `prepare` had already been used by `choose_first_move`. Five-minute sessions
> failed outright with `phase_unfilled`.
>
> It was fixed by adding a **second short variant** in both `activate` and
> `prepare` — an inventory change, not a recipe change. That is why the plan
> gives those two families five modules each while most have four.

**The work in this tranche is `activate` and `prepare` depth**, at two short
lengths each rather than one.

---

## 1. Purpose of this tranche

### What `flat_go` is for

Someone is flat. Not distressed, not anxious — just empty, and something needs
doing. The energy is not there and waiting for it to arrive is not working.

This pathway ends in movement. It is the only one whose destination is more
activation than the person started with; every other pathway brings something
down.

### Where someone starts

`flat` or `low_energy`. Canonical system values, not words on screen.

### Where they are meant to arrive

`activated` — labelled **Energised** — or `ready`, labelled **Confident**. Both
destinations use this pathway. Canonical values are never renamed to match
labels.

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
ELSEA interprets a starting state         (e.g. flat)
        ↓
they choose where they want to get to     (Energised, or Confident)
        ↓
they choose how long they have            (5, 10, 15 or 20 minutes)
        ↓
a session is composed for them
        ↓
they listen, and can pause or leave early
        ↓
they say how it went
```

**Nobody receives a script.** Each module must stand alone, must end somewhere
the next can begin from, and must never refer to another module, to the
session's structure, or to how much time is left.

**One thing to hold in mind for this pathway specifically:** someone who is
flat is not necessarily going to meet enthusiasm well. What the right register
is, is a content judgement this brief does not make.

---

## 3. The locked recipe structure

Seven phases, in this order, every time. **Fixed.** All bands provisional
pending clinical review.

| # | Phase | What this phase is for, in plain English | Eligible families | Min | Max |
|---:|---|---|---|---:|---:|
| 0 | `arrive` | Land, from flatness. | `orient` | 20s | 60s |
| 1 | `wake_body` | Get the body moving at all. | **`activate` only** | 45s | 180s |
| 2 | `raise_energy` | Bring energy up. | `activate`, `regulate` | 45s | 300s |
| 3 | `find_direction` | Work out what to aim at. | `reframe`, `focus` | 45s | 240s |
| 4 | `choose_first_move` | Pick the one thing to do first. | `focus`, `prepare` | 45s | 180s |
| 5 | `build_momentum` | Keep going once started. | `activate`, `prepare` | 60s | 420s |
| 6 | `close` | End, and let them go. | `close` | 15s | 45s |

**`wake_body` is the only single-family phase in the product.** If no
`activate` module fits its allocation, the phase cannot be filled and the whole
session fails. There is no fallback family.

`arrive` here is allocated **21 seconds** at five minutes — the tightest
`orient` slot anywhere, and the number every reusable `orient` module must fit.

---

## 4. Modules required for this tranche

### The seven that make the pathway work

| Module | Family | Intended role | Max (this recipe) | Max if reusable | Covered earlier? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---:|---|---|---|---|---|
| `fg_arrive` | `orient` | Land, from flatness | **≤21s** | **≤21s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_wake_body` | **`activate` only** | Get the body moving | ≤48s | **≤45s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_raise_energy` | `activate` or `regulate` | Bring energy up | ≤51s | **≤45s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_find_direction` | `reframe` or `focus` | Work out what to aim at | ≤49s | **≤40s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_first_move` | `focus` or `prepare` | Pick the first thing | ≤48s | **≤40s** / **≤45s** | yes — T1/T3 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_momentum` | `activate` or `prepare` | Keep going | ≤68s | **≤45s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `fg_close` | `close` | End, and let them go | ≤15s | **≤11s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

### The depth this recipe actually requires — the real work

Because `activate` serves three phases and `prepare` two, and no module repeats,
**both families need two SHORT modules, not one.** This is the fix for the
failure described at the top.

| Module | Family | Serves | Target length | Why it exists | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---|---|---|---|---|
| `activate_45` | `activate` | `wake_body`, `raise_energy` | ~45s | the ordinary short `activate` | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `activate_65` | `activate` | `build_momentum` at 5 min | ~65s | **added to stop 300s failing** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `activate_mid` | `activate` | `raise_energy`, `build_momentum` | ~85s | depth | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `activate_long` | `activate` | `build_momentum` | ~130s | depth | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `activate_xlong` | `activate` | `build_momentum` at 15–20 min | ~185s | depth | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `prepare_45` | `prepare` | `choose_first_move` | ~45s | the ordinary short `prepare` | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `prepare_65` | `prepare` | `build_momentum` at 5 min | ~65s | **added to stop 300s failing** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

`activate_65` and `prepare_65` exist for one reason: so that when the short
module has already been used by an earlier phase, something short enough
remains for `build_momentum`. **Writing either at 70s reintroduces the failure.**

### Values this brief cannot supply

`technique_key` — **TO DECIDE, clinical.**
`intensity` — **TO DECIDE, clinical.** 1–10 accepted; no scale defined. This is
the pathway where an intensity scale would matter most, since it is the only
one that raises activation.
`requires_headphones` — **TO DECIDE per module**, content.

---

## 5. Authoring sheet for each module

Copy one block per module. **Fields marked REQUIRED are deliberately empty.**

---

### MODULE: `activate_65`  ← exists to prevent a known failure
```
FAMILY:                 activate
TARGET DURATION:        65s
MAXIMUM DURATION:       68s. Above this the five-minute session breaks.
USED IN:                flat_go → build_momentum
                        Also eligible in wake_body and raise_energy
PURPOSE:                Keep momentum going once started, in a five-minute
                        session where the shorter activate module has already
                        been used by an earlier phase.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED. Note: this module exists because without a
                        second short activate, five-minute sessions in this
                        recipe fail to compose. Its length is load-bearing.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        activate_65.m4a
```

---

### MODULE: `prepare_65`  ← exists to prevent a known failure
```
FAMILY:                 prepare
TARGET DURATION:        65s
MAXIMUM DURATION:       68s. Above this the five-minute session breaks.
USED IN:                flat_go → build_momentum
                        Also eligible in choose_first_move
PURPOSE:                The same role as activate_65, from the prepare family,
                        so build_momentum has two ways to be filled.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — as above, the length is load-bearing.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        prepare_65.m4a
```

---

### MODULE: `activate_45`
```
FAMILY:                 activate
TARGET DURATION:        45s or under
MAXIMUM DURATION:       48s (wake_body at 5 min)
USED IN:                flat_go → wake_body
                        flat_go → raise_energy
                        Also eligible in nervous_ready → build_readiness and
                        scattered_focused → build_momentum
                        (MAY PLAY TWICE in one session)
PURPOSE:                Get the body moving at all.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in more than one phase, and must
                        not sound odd if heard twice in a session.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        activate_45.m4a
```

---

### MODULE: `activate_mid`
```
FAMILY:                 activate
TARGET DURATION:        REQUIRED — around 85s
MAXIMUM DURATION:       162s (build_momentum at 10 min)
USED IN:                flat_go → raise_energy, build_momentum
PURPOSE:                Depth, so longer sessions are not silence.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        activate_mid.m4a
```

---

### MODULE: `activate_long`
```
FAMILY:                 activate
TARGET DURATION:        REQUIRED — around 130s
MAXIMUM DURATION:       256s (build_momentum at 15 min)
USED IN:                flat_go → build_momentum
PURPOSE:                Depth for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        activate_long.m4a
```

---

### MODULE: `activate_xlong`
```
FAMILY:                 activate
TARGET DURATION:        REQUIRED — around 185s
MAXIMUM DURATION:       350s (build_momentum at 20 min)
USED IN:                flat_go → build_momentum at 15 and 20 minutes
PURPOSE:                Sustained momentum for the longest sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        activate_xlong.m4a
```

---

### MODULE: `prepare_45`
```
FAMILY:                 prepare
TARGET DURATION:        45s or under
MAXIMUM DURATION:       48s (choose_first_move at 5 min)
USED IN:                flat_go → choose_first_move, build_momentum
                        Also eligible in nervous_ready and scattered_focused
                        (MAY PLAY TWICE in one session)
PURPOSE:                Pick the one thing to do first.
NOTE:                   May already be covered by the Tranche 1 prepare module.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        prepare_45.m4a
```

---

### MODULE: `fg_arrive`
```
FAMILY:                 orient
TARGET DURATION:        21s or under
MAXIMUM DURATION:       21s — the tightest orient slot in the product
USED IN:                flat_go → arrive
NOTE:                   NOT REQUIRED if the Tranche 1 orient module is authored
                        at 21s or under. This recipe is the reason that ceiling
                        is 21 and not 22.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        fg_arrive.m4a
```

---

### MODULE: `fg_find_direction`
```
FAMILY:                 reframe  OR  focus  — REQUIRED, choose one
TARGET DURATION:        40s or under
MAXIMUM DURATION:       49s in this recipe
USED IN:                flat_go → find_direction
PURPOSE:                Work out what to aim at.
NOTE:                   May already be covered by Tranche 1 reframe or the
                        Tranche 3 focus modules.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        fg_find_direction.m4a
```

---

### MODULE: `fg_close`
```
FAMILY:                 close
TARGET DURATION:        11s or under
MAXIMUM DURATION:       15s in this recipe / 11s if reusable
USED IN:                flat_go → close
PURPOSE:                End, and let them go and do the thing.
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
FINAL FILE NAME:        fg_close.m4a
```

---

## 6. Duration is a hard constraint

A module longer than its slot is not shortened — **it is skipped**, silently.

### What each phase actually gets

| Phase | 5 min | 10 min | 15 min | 20 min |
|---|---:|---:|---:|---:|
| `arrive` | **21s** | 31s | 42s | 52s |
| `wake_body` | **48s** | 83s | 118s | 154s |
| `raise_energy` | **51s** | 117s | 184s | 250s |
| `find_direction` | **49s** | 100s | 151s | 202s |
| `choose_first_move` | **48s** | 83s | 118s | 154s |
| `build_momentum` | **68s** | 162s | 256s | 350s |
| `close` | **15s** | 24s | 31s | 38s |

**The five-minute column is the hard ceiling on every short module.**

### This recipe sets two product-wide ceilings

- **`orient` must be ≤21s.** This recipe's `arrive` is the tightest anywhere. A
  22-second `orient` module works in all four other recipes and fails here.
- **`activate` and `prepare` need TWO short modules each**, roughly 45s and
  65s. One is not enough — see the failure at the top of this brief.

### Seven phases means less time each

At five minutes this recipe divides 300 seconds across **seven** phases rather
than six. Every slot is correspondingly tighter, which is why `build_momentum`
gets only 68s here despite having the largest ceiling of any phase in the
recipe.

---

## 7. The `activate` three-phase trap

**Read this before writing any `activate` or `prepare` module.**

`activate` is eligible in `wake_body`, `raise_energy` and `build_momentum`. No
module plays twice in one session. And `wake_body` accepts no other family.

So the composer must fill `wake_body` from `activate`, and then has one fewer
`activate` module available for the two later phases that also want one.

**This is not hypothetical.** The first proposed inventory failed exactly here,
at five minutes only: `wake_body` took the single short `activate`,
`choose_first_move` took the single short `prepare`, and `build_momentum` — 68
seconds — had nothing left that fit. The session did not compose.

Three consequences for authoring:

1. **Two short modules are required in each of `activate` and `prepare`**, at
   roughly 45s and 65s. Not one at each length — two, at different lengths.
2. **Neither may exceed 68 seconds**, or `build_momentum` starves again at five
   minutes.
3. **An `activate` module may land in any of three quite different phases** —
   waking the body, raising energy, or sustaining momentum. Related jobs, not
   the same job, and a module must not assume which one it is doing.

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

**Name each delivered file `<module_key>.m4a`** — e.g. `activate_65.m4a`.

**The loudness target is not negotiable upward for this recipe.** It is
tempting to record activating content hotter. Do not: −16 LUFS applies to
everything, the true peak ceiling of −1 dBTP is absolute, and a module louder
than its neighbours produces a jump at every boundary. Energy comes from
delivery, not from level.

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

The import validates first and refuses on any failure. Audio uploads before
rows are written.

> Loudness checks need `ffmpeg` on the machine running the validator. Without
> it those checks report as **skipped**, never as passed.

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
| `activate_45` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `activate_65` **load-bearing** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `activate_mid` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `activate_long` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `activate_xlong` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `prepare_45` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `prepare_65` **load-bearing** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_arrive` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_raise_energy` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_find_direction` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_first_move` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_momentum` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `fg_close` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

**`activate_65` and `prepare_65` are the gating modules.** Without both, the
five-minute session in this recipe does not compose.

---

## 13. Open decisions

### CONTENT DECISION

1. **Technique, wording and delivery** for every module in §5.
2. **The register for this pathway.** It is the only one that raises
   activation, and someone who is flat may not meet enthusiasm well. Not a
   decision this brief makes.
3. **Which family fills the either/or slots** — `fg_raise_energy`,
   `fg_find_direction`, `fg_first_move`, `fg_momentum`.
4. **The two short `activate` and `prepare` lengths.** Roughly 45s and 65s is
   what the plan assumes; both must stay at or under 68s.
5. **`requires_headphones`** per module.

### CLINICAL / APPROVAL DECISION

6. **Every `technique_key`.**
7. **The `intensity` scale.** Still undefined, and this is the pathway where it
   matters most — it is the only one that increases activation, and "how
   strongly" has no agreed meaning.
8. **Approval of each module.**
9. **Confirmation of the seven phase bands**, all still provisional. This is
   the only seven-phase recipe.

### PRODUCT DECISION

10. **Acceptable silence** — still no threshold anywhere in the repository.
11. **Whether `activate` warrants more than five modules**, given it is the
    only family for `wake_body` and is eligible in three phases. Five is what
    makes composition succeed; it is not a judgement about how varied the
    pathway should feel.
12. **Final module identifiers.** The `fg_*`, `activate_*` and `prepare_*`
    names are proposals.

---

## Appendix — the complete series

| | T1 `nervous_ready` | T2 `wound_up_home` | T3 `scattered_focused` | T4 `wired_sleep` | T5 `flat_go` |
|---|---|---|---|---|---|
| Phases | 6 | 6 | 6 | 6 | **7** |
| New families | 8 | 3 | 0 | 1 (`sleep`) | **0** |
| Distinctive issue | tightest `close` at 16s | cross-phase repetition | one family, three phases | 11s close, 7/30 variety | **single-family phase** |
| Real work | the whole core | `transition` + `settle` | `focus` depth | the `sleep` family | **two short `activate`/`prepare`** |

**All twelve families are introduced across Tranches 1, 2 and 4.** Tranches 3
and 5 introduce none — their work is depth in families that already exist.

### The product-wide ceilings, in one place

Any module intended to serve every recipe must fit the tightest slot anywhere:

| Family | Ceiling | Set by |
|---|---:|---|
| `close` / `sleep` | **11s** | `wired_sleep.close` |
| `orient` | **21s** | `flat_go.arrive` |
| `ground`, `reframe`, `focus`, `settle` | **40s** | various |
| `regulate`, `release`, `activate`, `prepare` | **45s** | various |
| `transition` | **55s** | `wound_up_home.leave_work_behind` |

Author to these and one recording serves the whole product. Author to a single
recipe's looser limit and the module works there and nowhere else.
