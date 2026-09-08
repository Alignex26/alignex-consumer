# ELSEA — second intervention tranche: WOUND UP → HOME

The exact content required to make one more recipe composable, stated so that a
content or clinical author can supply it without reading any code.

**Nothing here proposes intervention content.** Every slot says what functional
job the composer needs filled and nothing about how to fill it. The technique,
the words and the delivery are authored and approved outside engineering (S4).

Scope: `wound_up_home` only. Companion to
[`tranche-nervous-ready.md`](./tranche-nervous-ready.md); the shared
constraints live in [`module-library.md`](./module-library.md).

Every figure was computed with the deployed allocator against the applied P19
migration. If either changes, recompute.

---

## 1. The recipe, as the database holds it

Approved and unchangeable here (S16).

| # | Phase | Provisional | Min | Max | Eligible families |
|---:|---|---|---:|---:|---|
| 0 | `arrive` | yes | 20s | 60s | `orient` |
| 1 | `downshift_arousal` | yes | 60s | 300s | `regulate`, `release` |
| 2 | `leave_work_behind` | yes | 45s | 240s | `reframe`, `transition` |
| 3 | `reconnect_to_now` | yes | 45s | 360s | `ground`, `transition`, `settle` |
| 4 | `settle` | yes | 30s | 240s | `settle`, `ground` |
| 5 | `close` | yes | 15s | 45s | `close` |

All six floors are `is_provisional = true` (S14).

## 2. What the allocator gives each phase

A module is selectable only if it is **no longer than its allocation**.

| Phase | 300s | 600s | 900s | 1200s |
|---|---:|---:|---:|---:|
| `arrive` | **23** | 35 | 47 | 58 |
| `downshift_arousal` | **80** | 150 | 220 | 290 |
| `leave_work_behind` | **61** | 118 | 175 | 231 |
| `reconnect_to_now` | **71** | 163 | 254 | 346 |
| `settle` | **47** | 108 | 170 | 231 |
| `close` | **18** | 26 | 34 | 44 |

The 300s column is the hard ceiling on every short module.

## 3. Family overlap — different from `nervous_ready`

This recipe reuses families across phases far more, which changes what a
minimum inventory looks like.

| Family | Phases served |
|---|---|
| `transition` | `leave_work_behind`, `reconnect_to_now` |
| `ground` | `reconnect_to_now`, `settle` |
| `settle` | `reconnect_to_now`, `settle` |
| `orient` | `arrive` only |
| `regulate` | `downshift_arousal` only |
| `release` | `downshift_arousal` only |
| `reframe` | `leave_work_behind` only |
| `close` | `close` only |

Three of the middle phases can be covered by two modules rather than three,
because `transition` reaches two of them and `ground`/`settle` reach two.

**The consequence to be aware of:** the same module then plays more than once
in a single session. See §7.

## 4. The minimum that composes

Five modules. Verified by dropping each in turn — **removing any one fails
300s with `phase_unfilled`.** All five load-bearing.

| Slot | Family | Serves | Max duration |
|---|---|---|---:|
| A | `orient` | `arrive` | ≤23s |
| B | `regulate` *or* `release` | `downshift_arousal` | ≤80s |
| C | `transition` | `leave_work_behind` **and** `reconnect_to_now` | ≤61s |
| D | `settle` *or* `ground` | `settle` | ≤47s |
| E | `close` | `close` | ≤18s |

Slot C is sized to the **tighter** of the two phases it serves (61s, not 71s),
or it becomes unselectable in `leave_work_behind` at five minutes.

Measured silence with the minimum set:

| Duration | Silence |
|---|---:|
| 300s | 3% |
| 600s | **44%** |
| 900s | **63%** |
| 1200s | **72%** |

Adding depth (11 modules) gives 3% / 25% / 12% / 15%.

> **PRODUCT DECISION REQUIRED — acceptable silence.** Unchanged from
> `nervous_ready`: no threshold exists in the repository, so "the smallest
> sensible inventory" cannot be answered. Five is the smallest that *composes*.

Note the 11-module figures are not monotonic — 25% at 600s against 12% at 900s.
That is an artefact of which durations happen to fit which slots, not a rule.
Inventory duration choice matters more than inventory size.

## 5. The slots to author

Content briefs, not rows. Nothing is in the database — see §6.

| Key | Family | Phase(s) | Max | Functional job |
|---|---|---|---:|---|
| `wuh_arrive_short` | `orient` | `arrive` | 23s | Approved `orient`-family content required here. |
| `wuh_downshift_short` | `regulate` | `downshift_arousal` | 80s | Approved `regulate`-family content required here. |
| `wuh_transition_short` | `transition` | `leave_work_behind`, `reconnect_to_now` | 61s | Approved `transition`-family content required here. |
| `wuh_settle_short` | `settle` | `settle` | 47s | Approved `settle`-family content required here. |
| `wuh_close_short` | `close` | `close` | 18s | Approved `close`-family content required here. |

Depth slots, if the silence in §4 is judged unacceptable. Durations are upper
bounds at 1200s, not targets:

| Key | Family | Phase | Max | Functional job |
|---|---|---|---:|---|
| `wuh_release_mid` | `release` | `downshift_arousal` | 290s | Approved `release`-family content required here. |
| `wuh_regulate_long` | `regulate` | `downshift_arousal` | 290s | Approved `regulate`-family content required here. |
| `wuh_reframe_mid` | `reframe` | `leave_work_behind` | 231s | Approved `reframe`-family content required here. |
| `wuh_transition_long` | `transition` | `leave_work_behind`, `reconnect_to_now` | 231s | Approved `transition`-family content required here. |
| `wuh_ground_mid` | `ground` | `reconnect_to_now`, `settle` | 231s | Approved `ground`-family content required here. |
| `wuh_settle_mid` | `settle` | `reconnect_to_now`, `settle` | 231s | Approved `settle`-family content required here. |

Module keys are **proposed identifiers only**. Renaming is free until rows
exist.

## 6. Why nothing has been inserted

Unchanged from the first tranche: `technique_key` and `storage_path` are both
`NOT NULL`, and neither can be filled without inventing content or pointing at
audio that does not exist. A row with `approved = false` would be correctly
filtered out by the composer, but would still sit in the production database
carrying an invented technique name and a false path.

## 7. Cross-phase repetition is more pronounced here

With the minimum inventory this recipe produces **6 module segments at 300s and
7 at longer durations, from 5 distinct modules**. One or two modules play twice
in the same session.

That is a consequence of the family overlap in §3 and of how the engine works:
`fillPhase` builds its no-repeat set per phase, so a module eligible in two
phases can be selected in both. `wound_up_home` has three families spanning two
phases each, against one in `nervous_ready`, so it happens more often.

> **PRODUCT DECISION REQUIRED — cross-phase repetition.** Whether a person may
> hear the same technique twice in one session, and whether it matters more
> when the two occurrences are adjacent phases. This is not a defect and is not
> being changed here; it is a content judgement with an engineering
> consequence. Also recorded in `ELSEA.md`.

## 8. What the author must supply

Identical to the first tranche — see
[`tranche-nervous-ready.md` §5](./tranche-nervous-ready.md). The open
questions there apply unchanged: `technique_key` and `intensity` semantics are
clinical, and no audio format is documented anywhere in the repository.
