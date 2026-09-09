# ELSEA — V1 intervention inventory

The consolidated module plan for all five recipes. **47 modules.**

Not a target that was aimed at. The number is what the constraints produced:
every module below exists because removing it breaks at least one of the twenty
recipe/duration cases, or because the library would otherwise be so thin that
the same handful played every session.

**No intervention content is proposed here.** Family, duration and key only.
Every slot is **CONTENT AUTHORING REQUIRED**, and nothing is composable until
`approved = true`.

Proven by `src/__tests__/composition-proof.test.ts`, which runs the real
allocator over all twenty cases. That test is the evidence for this document
and the regression guard on it.

---

## 1. How the numbers were arrived at

Four constraints, in priority order:

1. **Composability.** All 5 recipes × 4 durations must produce a valid manifest.
2. **No repetition.** No module plays twice in a session (locked decision).
3. **Low silence.** A module is only selectable if it fits the remaining slot,
   so a family needs a spread of durations, not an average one.
4. **Variety.** A frequent user should not meet the same few modules every time.

Sizing is driven by the **tightest slot any recipe gives that family** — not the
tightest in the recipe a module was written for. A `close` module sized 16s for
`nervous_ready` is unselectable in `wired_sleep`, whose `close` is allocated
11s, and that recipe then has no five-minute session at all.

## 2. The inventory

| Family | Count | Durations (s) | Tightest slot it must fit | Serves |
|---|---:|---|---:|---|
| `orient` | 3 | 20, 30, 45 | **21** (`flat_go.arrive`) | all five `arrive` |
| `close` | 3 | 10, 16, 25 | **11** (`wired_sleep.close`) | all five `close` |
| `regulate` | 4 | 45, 90, 140, 200 | 45 | 4 phases |
| `ground` | 4 | 40, 85, 130, 190 | 40 | 5 phases |
| `release` | 4 | 45, 95, 145, 200 | 45 | 4 phases |
| `reframe` | 4 | 40, 85, 130, 180 | 40 | 5 phases |
| `focus` | 4 | 40, 80, 130, 190 | 40 | 6 phases |
| `activate` | 5 | 45, 65, 85, 130, 185 | 45 | 4 phases, 3 in `flat_go` |
| `prepare` | 5 | 45, 65, 85, 130, 185 | 45 | 4 phases |
| `transition` | 3 | 55, 100, 150 | 55 | 2 phases |
| `settle` | 4 | 40, 85, 130, 190 | 40 | 5 phases |
| `sleep` | 4 | 10, 90, 150, 200 | **11** (`wired_sleep.close`) | 2 phases |
| **Total** | **47** | | | |

### Why two families carry five

`activate` and `prepare` each need **two short variants**. `flat_go` makes
`activate` eligible in three phases and the sole family for `wake_body`; under
no-repeat the first short module is consumed there, and `build_momentum` starves
at 300s. This was an observed failure in the first proposed inventory, not a
prediction — one of the twenty cases went red and stayed red until a second
short variant was added.

### Why `close` and `sleep` carry a 10-second module

`wired_sleep.close` is allocated 11 seconds at five minutes, the tightest slot
anywhere in the product. Both families are eligible there, so at least one of
them must have something that fits.

## 3. Global reuse

Every module is **globally reusable**: eligibility is family-level, so a module
serves any phase of any recipe that accepts its family and gives it room. No
recipe-specific variants are required.

That is the economic point. 47 masters, each produced once, compose all twenty
recipe/duration combinations — and far more once effectiveness data starts
varying the selection per person.

## 4. Measured result

Silence as a share of session, and modules used, with this inventory:

| Recipe | 300s | 600s | 900s | 1200s |
|---|---|---|---|---|
| `nervous_ready` | 23% / 6 | 12% / 6 | 8% / 7 | 8% / 10 |
| `wound_up_home` | 28% / 6 | 11% / 6 | 7% / 8 | 3% / 11 |
| `scattered_focused` | 10% / 6 | 17% / 6 | 10% / 8 | 8% / 9 |
| `wired_sleep` | 30% / 7 | 13% / 7 | 12% / 8 | 8% / 11 |
| `flat_go` | 10% / 7 | 17% / 7 | 17% / 8 | 9% / 10 |

**Zero failures. Zero repeated modules. Every phase inside its approved band.**

Silence is worst at 300 seconds, where slots are small and coarse. Reducing it
further means more short modules — a content decision about whether 20–30%
silence in a five-minute session is acceptable, not an engineering one.

> **PRODUCT DECISION REQUIRED — acceptable silence at 300s.** Still open. The
> figures above are what 47 modules produce; they are not a claim that they are
> right.

## 5. What each module needs before it can be used

| Field | Who decides |
|---|---|
| `module_key` | product |
| `family` | fixed by this document |
| `duration_seconds` | content, within the ceiling above |
| `technique_key` | **clinical** — naming it names a technique |
| `intensity` | **clinical** — 1–10, no scale defined anywhere |
| `requires_headphones` | content |
| `storage_path` | engineering, once audio exists |
| `approved` | **clinical** — false until review passes |

Audio goes in the private `intervention-audio` bucket. It is not enumerable:
anon cannot list it, read it, or see that it exists.

> **PRODUCT DECISION REQUIRED — audio format.** No codec, sample rate,
> bitrate, channel count or loudness target is documented anywhere in the
> repository.

## 6. Nothing is seeded

`intervention_modules` is empty and no migration inserts into it.
`technique_key` and `storage_path` are both `NOT NULL`, and neither can be
filled without naming a technique or pointing at audio that does not exist. A
row with `approved = false` would be correctly filtered out by the composer,
but would still sit in the production database looking like real intervention
content.

The inventory lives in the proof test as metadata, where it is executable and
harmless, until real content replaces it.
