# ELSEA — first intervention tranche: NERVOUS → READY

The exact content required to make one recipe composable, stated so that a
content or clinical author can supply it without reading any code.

**Nothing here proposes intervention content.** Every slot below says what
functional job the composer needs filled and nothing about how to fill it. The
technique, the words and the delivery are authored and approved outside
engineering (S4).

Scope: `nervous_ready` only. The other four recipes are untouched.

Every figure was computed with the deployed allocator against the applied P19
migration. If either changes, recompute.

---

## 1. The recipe, as the database holds it

Phase order, bands and eligibility are **approved and unchangeable here** (S16).

| # | Phase | Provisional | Min | Max | Eligible families |
|---:|---|---|---:|---:|---|
| 0 | `arrive` | yes | 20s | 60s | `orient` |
| 1 | `regulate_arousal` | yes | 60s | 300s | `regulate`, `ground` |
| 2 | `reframe_energy` | yes | 45s | 240s | `reframe` |
| 3 | `build_readiness` | yes | 60s | 480s | `prepare`, `activate` |
| 4 | `direct_attention_forward` | yes | 45s | 300s | `focus`, `prepare` |
| 5 | `close` | yes | 15s | 45s | `close` |

Every floor is `is_provisional = true` — provisional pending clinical review
(S14). They are being used as though settled because nothing else exists yet.

## 2. What the allocator gives each phase

The composer hands each phase a number of seconds, and **a module is only
selectable if it is no longer than that**. This is the binding constraint on
duration.

| Phase | 300s | 600s | 900s | 1200s |
|---|---:|---:|---:|---:|
| `arrive` | 22 | 32 | 42 | 52 |
| `regulate_arousal` | 71 | 132 | 193 | 254 |
| `reframe_energy` | 54 | 104 | 153 | 203 |
| `build_readiness` | 80 | 186 | 293 | 400 |
| `direct_attention_forward` | 57 | 122 | 187 | 251 |
| `close` | 16 | 24 | 32 | 40 |

**The 300s column is the hard ceiling on every "short" module.** Nothing longer
than 22s can ever fill `arrive`; nothing longer than 16s can fill `close`.

## 3. The minimum that composes

Five modules make all four durations produce valid manifests. Verified by
dropping each in turn: **removing any one of the five makes 300s fail with
`phase_unfilled`.** All five are load-bearing.

| Slot | Family | Serves | Max duration |
|---|---|---|---:|
| A | `orient` | `arrive` | ≤22s |
| B | `regulate` *or* `ground` | `regulate_arousal` | ≤71s |
| C | `reframe` | `reframe_energy` | ≤54s |
| D | `prepare` | `build_readiness` **and** `direct_attention_forward` | ≤57s |
| E | `close` | `close` | ≤16s |

**But five is not usable.** Measured silence with the minimum set:

| Duration | Silence |
|---|---:|
| 300s | 8% |
| 600s | **54%** |
| 900s | **69%** |
| 1200s | **77%** |

A twenty-minute session would be three-quarters silence. Adding depth in the
large slots (11 modules) brings it to 8% / 12% / 14% / 20%.

> **PRODUCT DECISION REQUIRED — acceptable silence.** There is no approved
> threshold in the repository. Until one exists, "the smallest sensible
> inventory" cannot be answered: five is the smallest that *composes*, and
> anything beyond that is a judgement about how a session should feel.

## 4. The slots to author

Content briefs, not rows. Nothing is in the database — see §6.

Duration is a **maximum**, set by the 300s allocation. A shorter module always
works; a longer one is silently unselectable at short durations.

| Key | Family | Phase(s) | Max | Functional job | Reusable |
|---|---|---|---:|---|---|
| `nr_arrive_short` | `orient` | `arrive` | 22s | Approved `orient`-family content required here. | yes |
| `nr_regulate_short` | `regulate` | `regulate_arousal` | 71s | Approved `regulate`-family content required here. | yes |
| `nr_reframe_short` | `reframe` | `reframe_energy` | 54s | Approved `reframe`-family content required here. | yes |
| `nr_prepare_short` | `prepare` | `build_readiness`, `direct_attention_forward` | 57s | Approved `prepare`-family content required here. | yes |
| `nr_close_short` | `close` | `close` | 16s | Approved `close`-family content required here. | yes |

Depth slots, if the silence figures in §3 are judged unacceptable. Durations
here are upper bounds at 1200s, not targets:

| Key | Family | Phase | Max | Functional job |
|---|---|---|---:|---|
| `nr_regulate_long` | `regulate` | `regulate_arousal` | 254s | Approved `regulate`-family content required here. |
| `nr_ground_mid` | `ground` | `regulate_arousal` | 254s | Approved `ground`-family content required here. |
| `nr_reframe_long` | `reframe` | `reframe_energy` | 203s | Approved `reframe`-family content required here. |
| `nr_prepare_long` | `prepare` | `build_readiness` | 400s | Approved `prepare`-family content required here. |
| `nr_activate_mid` | `activate` | `build_readiness` | 400s | Approved `activate`-family content required here. |
| `nr_focus_mid` | `focus` | `direct_attention_forward` | 251s | Approved `focus`-family content required here. |

Module keys above are **proposed identifiers only**, chosen to be stable and
readable. Renaming them is free until rows exist.

## 5. What the author must supply per module

These become one row in `intervention_modules`.

| Field | Who decides | Notes |
|---|---|---|
| `module_key` | product | stable, unique, quoted in support tickets |
| `family` | fixed above | one of the twelve, lower case |
| `technique_key` | **clinical** | the taxonomy slot. **Not decidable by engineering.** |
| `duration_seconds` | content | must not exceed the max in §4 |
| `intensity` | **clinical** | 1–10. No scale is defined in the repo. |
| `requires_headphones` | content | shown to the person before the session starts |
| `is_bed` | product | false for all of the above; a bed is a layer, not a step |
| `approved` | **clinical** | false until review passes. Nothing else gates selection. |
| `storage_path` | engineering | once audio exists |

> **PRODUCT DECISION REQUIRED — audio format.** The repository documents no
> codec, sample rate, bitrate, channel count or loudness target. The only
> precedent is the seeded catalogue's `.m4a` paths, which is a filename, not a
> specification. `expo-audio` on iOS will accept several formats; nothing has
> been chosen.

> **PRODUCT DECISION REQUIRED — intensity scale.** `intensity` is constrained
> to 1–10 and is currently read by nothing. What a 3 means versus an 8 is
> undefined.

## 6. Why nothing has been inserted

**Two NOT NULL columns cannot be filled without inventing content.**

- `technique_key text not null` — the clinical slot name. Writing one means
  naming a technique.
- `storage_path text not null` — no audio exists, and a placeholder path would
  point at nothing.

A row could be created with `approved = false`, which the composer does filter
out. But it would still carry an invented technique name and a false path,
sitting in the production database looking like real intervention content. The
brief stays documentation until the content exists.

## 7. Approval enforcement — verified

Traced in the deployed composer, not assumed from the schema.

`supabase/functions/compose/index.ts` queries:

```
.from("intervention_modules")
.eq("is_active", true)
.eq("approved", true)
```

Unapproved rows never reach the allocator. With none approved the list is
empty and the composer returns `library_empty`, and the app falls back to the
catalogue path. There is no client-side path to `intervention_modules` at all:
the table has no anon policy and the app queries it nowhere.

**This is a single point of enforcement.** One `.eq()` in one query is the
whole gate. It is correct today and covered by a test, but it is thin — worth
knowing before the table holds unapproved drafts.
