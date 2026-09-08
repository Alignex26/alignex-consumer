# ELSEA — the intervention module library

The brief for the first library. **Engineering constraints only.** What a
person actually hears — the technique, the words, the delivery — is authored
and approved outside engineering (S4), and nothing in this document proposes
any of it.

Every number here was computed with the real allocator against the recipes
seeded in `20260908150000`. If the recipes change, recompute; do not trust
these numbers afterwards.

---

## 1. Two hard constraints

Miss either and sessions cannot be built at all.

**`close` needs a module of 10 seconds or less.** At a five-minute session the
`close` phase is allocated 11 seconds in `wired_sleep` and 15–18 elsewhere. A
module is only selectable if it is no longer than its allocation, so with
nothing under 11s **every five-minute session fails to compose**. This was
observed, not predicted: a trial library whose shortest module was 20s produced
`phase_unfilled` for all five recipes at 300s.

**`orient` needs a module of 20 seconds or less**, for the same reason —
`arrive` is allocated 21–23s at five minutes.

Both families are the *only* family eligible for their phase, so there is no
fallback. Two others are also sole-eligible and worth noting: `activate` must
have something ≤48s (`flat_go.wake_body`) and `reframe` something ≤54s
(`nervous_ready.reframe_energy`).

## 2. What each family has to cover

Tightest slot is at 300 seconds; largest at 1200.

| Family | Tightest | Largest | Phases served |
|---|---:|---:|---:|
| `orient` | 21s | 58s | 1 |
| `close` | 11s | 44s | 1 |
| `sleep` | 11s | 369s | 2 |
| `focus` | 41s | 402s | 6 |
| `reframe` | 41s | 233s | 5 |
| `ground` | 47s | 402s | 5 |
| `settle` | 47s | 369s | 5 |
| `activate` | 48s | 400s | 4 |
| `prepare` | 48s | 400s | 4 |
| `regulate` | 51s | 290s | 4 |
| `release` | 57s | 290s | 4 |
| `transition` | 61s | 346s | 2 |

## 3. Why phases chain, and what that costs

A phase now plays **several modules in sequence** rather than one. Before that
change a 402-second slot filled by a 120-second module left 282 seconds of
silence, and a twenty-minute session came out roughly a third to a half silent.
The alternative was commissioning 400-second recordings, which is expensive and
makes each recording far less reusable — the opposite of the economics the
whole architecture exists for.

**A module never repeats within a phase.** Hearing the same technique twice in
a row is a content judgement, not an engineering one, so the conservative
choice is taken and the remainder becomes silence.

That rule is what limits long sessions: a phase can never be filled beyond the
combined duration of its eligible modules. It is the single biggest lever on
how a twenty-minute session feels, and **whether repetition is acceptable is a
product and clinical decision, not one to make here.**

## 4. A validated starting shape

Not approved, and not a proposal about content. This is one inventory of 30
that provably composes every recipe at every approved duration, offered so the
shape can be argued with using real numbers.

| Family | Count | Durations |
|---|---:|---|
| `orient` | 2 | 20s, 45s |
| `regulate` | 3 | 45s, 90s, 150s |
| `ground` | 3 | 40s, 90s, 150s |
| `release` | 2 | 50s, 120s |
| `reframe` | 3 | 40s, 90s, 150s |
| `focus` | 3 | 40s, 90s, 150s |
| `activate` | 3 | 45s, 90s, 150s |
| `prepare` | 2 | 45s, 120s |
| `transition` | 2 | 55s, 120s |
| `settle` | 3 | 45s, 90s, 150s |
| `sleep` | 2 | 10s, 150s |
| `close` | 2 | 10s, 30s |
| **Total** | **30** | |

Measured result — silence as a share of the session:

| Recipe | 300s | 600s | 900s | 1200s |
|---|---:|---:|---:|---:|
| `wound_up_home` | 22% | 15% | 9% | 8% |
| `scattered_focused` | 15% | 17% | 10% | 3% |
| `nervous_ready` | 32% | 13% | 10% | 7% |
| `wired_sleep` | 23% | 17% | 12% | 9% |
| `flat_go` | 17% | 25% | 14% | 7% |

No failures at any duration.

**A smaller-grained library is not simply better.** A variant skewed shorter
(15–90s) was tested and came out *worse* at twenty minutes — up to 19% silence
against 3–9% — because the no-repeat rule exhausts the pool before a
400-second slot is full. Small modules stack; they do not stretch.

Short sessions are where the remaining silence sits, and the lever there is
more short modules rather than fewer long ones.

## 5. What is needed per module

For each of the 30, engineering needs only these. They become one row in
`intervention_modules`.

| Field | Notes |
|---|---|
| `module_key` | stable, human-readable, quoted in support tickets |
| `family` | one of the twelve, lower case |
| `technique_key` | the taxonomy slot it fills |
| `duration_seconds` | must satisfy §1 and §2 |
| `intensity` | 1–10 |
| `requires_headphones` | boolean |
| `is_bed` | a bed is a layer, not a step; it still takes a family |
| `approved` | false until clinical review passes |

**The audio and the words are not engineering's.** Nothing is composed from a
module until `approved` is true.

## 6. Open decisions

1. **May a module repeat within a phase?** The single biggest lever on how a
   long session feels. Currently no.
2. **Is the residual silence at 300 seconds acceptable**, or should the library
   carry more short modules?
3. **Where does master audio live?** Not an enumerable public bucket — see the
   storage constraint in `ELSEA.md`. Manifests must resolve private assets
   through short-lived signed URLs. Not implemented.
