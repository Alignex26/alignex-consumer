# ELSEA — content authoring brief, Tranche 3: SCATTERED → FOCUSED

**For the content author, clinical reviewer and voice producer.**
No knowledge of the codebase is needed to work from this document.

Prepared: 2026-09-09. Third in the series, after
[Tranche 1](./content-authoring-brief-tranche-1.md) and
[Tranche 2](./content-authoring-brief-tranche-2.md). Every number was read out
of the running system.

**This document contains no intervention content and proposes none.**

---

## Read this first — no new families, but real new depth

`scattered_focused` uses eight families. **Every one of them is already covered
by Tranches 1 and 2.** No new family is introduced here at all.

| Family | Needed here | Covered by |
|---|---|---|
| `orient` | `arrive` | Tranche 1 |
| `release` | `reduce_noise` | Tranche 2 |
| `ground` | `reduce_noise`, `stabilise_attention` | Tranche 1 |
| `focus` | `choose_direction`, `stabilise_attention`, `build_momentum` | Tranche 1 |
| `reframe` | `choose_direction` | Tranche 1 |
| `activate` | `build_momentum` | Tranche 1 |
| `prepare` | `build_momentum` | Tranche 1 |
| `close` | `close` | Tranche 1 |

**But that does not make this tranche free.** This recipe needs *more modules
in one family* than any other, for a reason explained in §7:

> **`focus` is eligible in three of the six phases.** No module plays twice in
> a session, so a single session here can consume **three distinct `focus`
> modules**. One `focus` module is not enough, and neither is two.

That is the work in this tranche: `focus` depth, at durations that fit three
quite different slots.

---

## 1. Purpose of this tranche

### What `scattered_focused` is for

Someone has things to do and cannot get hold of their own attention. Too many
tabs, mental and literal. They are not distressed — they are fragmented, and
the day is getting away from them.

This is the pathway that ends in work getting started, not in calm for its own
sake.

### Where someone starts

`scattered` or `overwhelmed`. Canonical system values, not words on screen.

### Where they are meant to arrive

`focused` — labelled **Focused**. The canonical value is never renamed to match
the label.

### Responsibilities

**Author:** the technique in each module and its name (`technique_key`); the
wording; delivery, pacing and tone; whether headphones are needed; intensity;
and approval.

**Engineering:** which modules play and in what order; silence; timing, fades,
pause and resume; secure storage and delivery; and never letting unapproved
content into a session.

**Engineering will not write, edit, shorten or approve any content.**

---

## 2. The user journey

```
the person describes how they feel, in their own words
        ↓
a safety check runs on the server        ← their words go here and nowhere else
        ↓
ELSEA interprets a starting state         (e.g. scattered)
        ↓
they choose where they want to get to     (Focused)
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

---

## 3. The locked recipe structure

Six phases, in this order, every time. **Fixed.** All bands provisional pending
clinical review, used as settled because nothing else exists.

| # | Phase | What this phase is for, in plain English | Eligible families | Min | Max |
|---:|---|---|---|---:|---:|
| 0 | `arrive` | Land, out of the scatter. | `orient` | 20s | 60s |
| 1 | `reduce_noise` | Turn down the competing demands. | `release`, `ground` | 45s | 240s |
| 2 | `choose_direction` | Pick one thing. | `focus`, `reframe` | 30s | 180s |
| 3 | `stabilise_attention` | Hold attention on it. | `focus`, `ground` | 60s | 480s |
| 4 | `build_momentum` | Get moving on it. | `activate`, `prepare`, `focus` | 45s | 420s |
| 5 | `close` | End, and let them start. | `close` | 15s | 45s |

Two structural features matter for authoring:

- **`focus` spans three phases** (2, 3 and 4) — see §7.
- **`stabilise_attention` reaches 402 seconds**, the largest single slot
  anywhere in the product. A module can be nearly seven minutes long here.

---

## 4. Modules required for this tranche

### The six that make the pathway work

| Module | Family | Intended role | Max (this recipe) | Max if reusable | Covered by an earlier tranche? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---:|---|---|---|---|---|
| `sf_arrive` | `orient` | Land, out of the scatter | ≤23s | **≤21s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sf_reduce_noise` | `release` or `ground` | Turn the noise down | ≤59s | **≤40s** (`ground`) / **≤45s** (`release`) | yes — T1/T2 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sf_direction` | `focus` or `reframe` | Pick one thing | **≤41s** | **≤40s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sf_stabilise` | `focus` or `ground` | Hold attention | ≤90s | ≤40s if also short-slot | partly | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sf_momentum` | `activate`, `prepare` or `focus` | Get moving | ≤71s | **≤45s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `sf_close` | `close` | End cleanly | ≤16s | **≤11s** | yes — T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

### The `focus` depth this recipe actually requires — the real work

Because `focus` is eligible in three phases and no module repeats, the composer
can need three distinct `focus` modules in one session. The consolidated plan
allows **four** `focus` modules across the product, at roughly 40s, 80s, 130s
and 190s.

| Module | Family | Serves | Target length | New? | Authoring | technique_key | Approval | Audio |
|---|---|---|---:|---|---|---|---|---|
| `focus_short` | `focus` | `choose_direction` (≤41s) | ~40s | shared with T1 | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `focus_mid` | `focus` | `stabilise_attention`, `build_momentum` | ~80s | **NEW depth** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `focus_long` | `focus` | `stabilise_attention` | ~130s | **NEW depth** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |
| `focus_xlong` | `focus` | `stabilise_attention` at 15–20 min | ~190s | **NEW depth** | TO AUTHOR | TO DECIDE | TO APPROVE | TO RECORD |

The three marked NEW are the substance of this tranche. Naming them without a
recipe prefix is deliberate: they serve six phases across the product, and a
`sf_` prefix would misdescribe them.

### Values this brief cannot supply

`technique_key` — **TO DECIDE, clinical.**
`intensity` — **TO DECIDE, clinical.** 1–10 accepted; no scale defined.
`requires_headphones` — **TO DECIDE per module**, content.

---

## 5. Authoring sheet for each module

Copy one block per module. **Fields marked REQUIRED are deliberately empty.**

---

### MODULE: `focus_mid`  ← new depth, highest priority
```
FAMILY:                 focus
TARGET DURATION:        REQUIRED — around 80s
MAXIMUM DURATION:       194s (stabilise_attention at 10 min)
USED IN:                scattered_focused → stabilise_attention
                        scattered_focused → build_momentum
                        Also eligible in nervous_ready → direct_attention_forward
                        and flat_go → find_direction / choose_first_move
                        (MAY PLAY TWICE in one session — see §7)
PURPOSE:                Hold attention on the chosen thing.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — must work in more than one phase, and must
                        not sound odd if heard twice in a session. Read §7.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        focus_mid.m4a
```

---

### MODULE: `focus_long`  ← new depth
```
FAMILY:                 focus
TARGET DURATION:        REQUIRED — around 130s
MAXIMUM DURATION:       298s (stabilise_attention at 15 min)
USED IN:                scattered_focused → stabilise_attention
PURPOSE:                A longer attention-holding option for longer sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        focus_long.m4a
```

---

### MODULE: `focus_xlong`  ← new depth
```
FAMILY:                 focus
TARGET DURATION:        REQUIRED — around 190s
MAXIMUM DURATION:       402s — the largest slot in the product
USED IN:                scattered_focused → stabilise_attention, at 15 and
                        20 minutes
PURPOSE:                Sustained attention for the long sessions.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED — this is among the longest single pieces of
                        continuous content in the product.
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        focus_xlong.m4a
```

---

### MODULE: `sf_reduce_noise`
```
FAMILY:                 release  OR  ground  — REQUIRED, choose one
TARGET DURATION:        40s or under (ground) / 45s or under (release)
MAXIMUM DURATION:       59s in this recipe
USED IN:                scattered_focused → reduce_noise
PURPOSE:                Turn down the competing demands on attention.
NOTE:                   May already be covered by the Tranche 1 ground module
                        or the Tranche 2 release module, if either is authored
                        short enough.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sf_reduce_noise.m4a
```

---

### MODULE: `sf_arrive`
```
FAMILY:                 orient
TARGET DURATION:        21s or under
MAXIMUM DURATION:       23s in this recipe / 21s if reusable
USED IN:                scattered_focused → arrive
NOTE:                   NOT REQUIRED if the Tranche 1 orient module is
                        authored at 21s or under.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sf_arrive.m4a
```

---

### MODULE: `sf_direction`
```
FAMILY:                 focus  OR  reframe  — REQUIRED, choose one
TARGET DURATION:        40s or under
MAXIMUM DURATION:       41s in this recipe
USED IN:                scattered_focused → choose_direction
PURPOSE:                Pick one thing to do.
NOTE:                   If authored as focus, this is the focus_short module
                        and is shared with Tranche 1.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sf_direction.m4a
```

---

### MODULE: `sf_momentum`
```
FAMILY:                 activate  OR  prepare  OR  focus  — REQUIRED, choose one
TARGET DURATION:        45s or under
MAXIMUM DURATION:       71s in this recipe
USED IN:                scattered_focused → build_momentum
PURPOSE:                Get moving on the thing that was chosen.
NOTE:                   May already be covered by the Tranche 1 prepare or
                        activate module.
INTENDED EFFECT:        REQUIRED
CONTENT TO AUTHOR:      REQUIRED
DELIVERY NOTES:         REQUIRED
TECHNIQUE_KEY:          REQUIRED — clinical
INTENSITY:              REQUIRED — clinical
REQUIRES HEADPHONES:    REQUIRED
CLINICAL/CONTENT APPROVAL: NOT APPROVED
AUDIO RECORDED:         NO
FINAL FILE NAME:        sf_momentum.m4a
```

---

### MODULE: `sf_close`
```
FAMILY:                 close
TARGET DURATION:        11s or under
MAXIMUM DURATION:       16s in this recipe / 11s if reusable
USED IN:                scattered_focused → close
PURPOSE:                End, and let them start work.
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
FINAL FILE NAME:        sf_close.m4a
```

---

## 6. Duration is a hard constraint

A module longer than its slot is not shortened — **it is skipped**, silently.

### What each phase actually gets

| Phase | 5 min | 10 min | 15 min | 20 min |
|---|---:|---:|---:|---:|
| `arrive` | **23s** | 33s | 43s | 53s |
| `reduce_noise` | **59s** | 107s | 155s | 204s |
| `choose_direction` | **41s** | 78s | 115s | 152s |
| `stabilise_attention` | **90s** | 194s | 298s | **402s** |
| `build_momentum` | **71s** | 164s | 257s | 350s |
| `close` | **16s** | 24s | 32s | 39s |

**The five-minute column is the hard ceiling on every short module.**

### The three `focus` modules must be different lengths

This is not a stylistic preference. `stabilise_attention` grows from 90s to
402s across the four session lengths. If all three `focus` modules are written
at similar lengths, the long sessions fill with silence, because there is
nothing long enough to put in the biggest slot in the product.

Roughly 40 / 80 / 130 / 190 seconds is the shape the consolidated plan assumes.
**Spread them.**

### Cross-recipe ceilings still apply

`focus` is eligible in six phases across the product; its tightest is 40s. An
`orient` module must be ≤21s and a `close` ≤11s to serve everywhere. Author to
the cross-recipe ceiling unless a deliberate decision says otherwise.

---

## 7. The `focus` three-phase problem

**Read this before writing any `focus` module.**

`focus` is eligible in `choose_direction`, `stabilise_attention` **and**
`build_momentum`. No module plays twice in one session. So the composer can
select a different `focus` module for each of those three phases — consuming
three distinct `focus` modules in a single session.

Three consequences:

1. **One `focus` module is not enough**, and two is thin. This recipe drives
   `focus` depth harder than any other pathway.
2. **Each `focus` module may land in any of the three phases** — choosing a
   direction, holding attention, or building momentum. They are related jobs
   but not the same job, and a module must not assume which one it is doing.
3. **A `focus` module may be heard alongside two of its siblings** in the same
   session. Three modules from the same family, back to back across phases,
   should not feel like three takes of the same recording.

The alternative is to author more `focus` modules so the composer has room to
vary. That is the product decision in §13.

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

**Name each delivered file `<module_key>.m4a`** — e.g. `focus_mid.m4a`. Lower
case letters, digits and underscores only.

Trim leading and trailing silence to ≤100ms — silence inside a file is
invisible to the engine and makes session timing drift. Do not apply fades; the
player applies its own 250ms ramp at every boundary.

**Loudness consistency matters especially here.** Three modules from the same
family may play in one session, and a level mismatch between siblings is far
more noticeable than between unrelated content.

Voice, delivery, pacing, tone and headphone requirements are not specified
anywhere, and are yours.

---

## 9. Manifest handoff

One data file describing every module, plus one folder of audio named
`<module_key>.m4a`.

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
| `version` | Optional, defaults to 1; raise only when replacing audio | product |
| `storage_path` | `modules/<family>/<module_key>.m4a` | engineering |

Illustrative shape only — **not content** — is in
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

Unchanged across all tranches. Done only when all fourteen are true: wording
authored; technique identified; `technique_key` supplied; `intensity` supplied;
content approved; duration within its limit **and its cross-recipe limit if it
is to be reusable**; audio recorded; audio passes technical validation;
manifest entry valid; imported; uploaded to private storage; `approved` true in
production; selectable by the composer; and **successfully played in a real
composed session on a real device**.

No module in any tranche has reached item 14.

---

## 12. Tranche completion checklist

Honest current status. **Nothing in this tranche has been started.**

| Module | Authored | Approved | Recorded | Audio valid | Manifest valid | Imported | Live | Device proven |
|---|---|---|---|---|---|---|---|---|
| `focus_mid` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `focus_long` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `focus_xlong` **NEW** | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_reduce_noise` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_arrive` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_direction` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_stabilise` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_momentum` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sf_close` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

**The milestone is the three `focus` modules.** With Tranches 1 and 2 complete,
they are the substance of what this recipe still needs.

---

## 13. Open decisions

### CONTENT DECISION

1. **Technique, wording and delivery** for every module in §5.
2. **Which family fills the either/or slots** — `sf_reduce_noise` (`release` or
   `ground`), `sf_direction` (`focus` or `reframe`), `sf_momentum` (`activate`,
   `prepare` or `focus`).
3. **Whether three `focus` modules in one session is acceptable**, given they
   may be heard consecutively across phases. See §7.
4. **The four `focus` durations.** Roughly 40 / 80 / 130 / 190s is the assumed
   shape; the actual numbers are a content decision, and §6 explains why they
   must be spread rather than clustered.
5. **`requires_headphones`** per module.

### CLINICAL / APPROVAL DECISION

6. **Every `technique_key`.**
7. **The `intensity` scale** — unchanged and still undefined.
8. **Approval of each module.**
9. **Confirmation of the six phase bands**, all still provisional.

### PRODUCT DECISION

10. **Whether to author more than four `focus` modules**, to reduce how often
    the same one is reached for across three phases.
11. **Acceptable silence** — still no threshold anywhere.
12. **Whether `sf_stabilise` and the `focus` depth modules are the same
    work.** They overlap heavily; treating them as one set of four `focus`
    modules is the reading this brief assumes, but that has not been decided.
13. **Final module identifiers.** The `sf_*` and `focus_*` names are proposals.

---

## Appendix — where this sits in the series

| | T1 `nervous_ready` | T2 `wound_up_home` | T3 `scattered_focused` |
|---|---|---|---|
| New families | 8 | 3 | **0** |
| Distinctive issue | tightest `close` in the product | cross-phase repetition | one family across three phases |
| Largest slot | 400s | 346s | **402s** |
| Real work | the whole core | `transition` + `settle` | **`focus` depth** |

The pattern holds: each tranche introduces fewer new families and more depth in
existing ones. **After this one, only a single new family remains anywhere in
the product** — `sleep`, which appears only in `wired_sleep`.
