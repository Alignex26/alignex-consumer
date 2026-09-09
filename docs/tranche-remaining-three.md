# ELSEA — tranches 3–5: SCATTERED→FOCUSED, WIRED→SLEEP, FLAT→GO

Completes the set. Companion to
[`tranche-nervous-ready.md`](./tranche-nervous-ready.md) and
[`tranche-wound-up-home.md`](./tranche-wound-up-home.md); the consolidated
plan is [`module-inventory-v1.md`](./module-inventory-v1.md).

**No intervention content is proposed.** Every slot states the functional job
the composer needs filled and nothing about how to fill it. Technique, wording
and delivery are authored and approved outside engineering (S4). Where content
is absent it is marked **CONTENT AUTHORING REQUIRED**.

All figures computed with the deployed allocator against the applied P19
migration, under the locked no-repeat rule.

---

## SCATTERED → FOCUSED

| # | Phase | Min–Max | 300 | 600 | 900 | 1200 | Families |
|---:|---|---|---:|---:|---:|---:|---|
| 0 | `arrive` | 20–60 | **23** | 33 | 43 | 53 | `orient` |
| 1 | `reduce_noise` | 45–240 | **59** | 107 | 155 | 204 | `release`, `ground` |
| 2 | `choose_direction` | 30–180 | **41** | 78 | 115 | 152 | `focus`, `reframe` |
| 3 | `stabilise_attention` | 60–480 | **90** | 194 | 298 | 402 | `focus`, `ground` |
| 4 | `build_momentum` | 45–420 | **71** | 164 | 257 | 350 | `activate`, `prepare`, `focus` |
| 5 | `close` | 15–45 | **16** | 24 | 32 | 39 | `close` |

**Family reuse:** `focus` spans three phases, `ground` two.

`focus` across three phases is the pressure point: under no-repeat, three
distinct `focus` modules can be consumed in one session, so this recipe drives
`focus` depth more than any other.

`stabilise_attention` reaches **402s**, the largest single slot in any recipe.

| Slot | Family | Serves | Max |
|---|---|---|---:|
| `sf_arrive` | `orient` | `arrive` | ≤23s |
| `sf_reduce_noise` | `release` or `ground` | `reduce_noise` | ≤59s |
| `sf_direction` | `focus` or `reframe` | `choose_direction` | ≤41s |
| `sf_stabilise` | `focus` or `ground` | `stabilise_attention` | ≤90s |
| `sf_momentum` | `activate`, `prepare` or `focus` | `build_momentum` | ≤71s |
| `sf_close` | `close` | `close` | ≤16s |

CONTENT AUTHORING REQUIRED for every slot above.

---

## WIRED → SLEEP

| # | Phase | Min–Max | 300 | 600 | 900 | 1200 | Families |
|---:|---|---|---:|---:|---:|---:|---|
| 0 | `arrive` | 20–60 | **22** | 31 | 40 | 49 | `orient` |
| 1 | `settle_body` | 60–360 | **74** | 143 | 212 | 281 | `settle`, `release` |
| 2 | `slow_system` | 45–300 | **57** | 115 | 174 | 233 | `regulate`, `settle` |
| 3 | `release_thoughts` | 45–300 | **57** | 115 | 174 | 233 | `release`, `reframe` |
| 4 | `allow_sleep` | 60–480 | **79** | 176 | 272 | 369 | `sleep`, `settle` |
| 5 | `close` | **10**–45 | **11** | 20 | 28 | 35 | `close`, `sleep` |

**Family reuse:** `settle` spans three phases, `release` and `sleep` two each.

**This recipe sets the tightest constraint in the entire product.** Its `close`
phase floors at 10s and is allocated **11s** at five minutes. A `close` or
`sleep` module longer than 11s cannot fill it, and no five-minute
`wired_sleep` session composes without one. A `close` module sized for the
other four recipes — 15–18s — is too long here.

| Slot | Family | Serves | Max |
|---|---|---|---:|
| `ws_arrive` | `orient` | `arrive` | ≤22s |
| `ws_settle_body` | `settle` or `release` | `settle_body` | ≤74s |
| `ws_slow_system` | `regulate` or `settle` | `slow_system` | ≤57s |
| `ws_release_thoughts` | `release` or `reframe` | `release_thoughts` | ≤57s |
| `ws_allow_sleep` | `sleep` or `settle` | `allow_sleep` | ≤79s |
| `ws_close` | `close` or `sleep` | `close` | **≤11s** |

CONTENT AUTHORING REQUIRED for every slot above.

---

## FLAT → GO

Seven phases; the only recipe with more than six.

| # | Phase | Min–Max | 300 | 600 | 900 | 1200 | Families |
|---:|---|---|---:|---:|---:|---:|---|
| 0 | `arrive` | 20–60 | **21** | 31 | 42 | 52 | `orient` |
| 1 | `wake_body` | 45–180 | **48** | 83 | 118 | 154 | `activate` |
| 2 | `raise_energy` | 45–300 | **51** | 117 | 184 | 250 | `activate`, `regulate` |
| 3 | `find_direction` | 45–240 | **49** | 100 | 151 | 202 | `reframe`, `focus` |
| 4 | `choose_first_move` | 45–180 | **48** | 83 | 118 | 154 | `focus`, `prepare` |
| 5 | `build_momentum` | 60–420 | **68** | 162 | 256 | 350 | `activate`, `prepare` |
| 6 | `close` | 15–45 | **15** | 24 | 31 | 38 | `close` |

**Family reuse:** `activate` spans three phases, `focus` and `prepare` two each.

**This recipe drove a real inventory change.** `activate` is eligible in three
phases and is the *only* family for `wake_body`. Under no-repeat, a single
short `activate` module is consumed by `wake_body`, and `build_momentum` (68s)
then starves because the next `activate` is too long and `prepare` has already
gone to `choose_first_move`. The first proposed inventory failed exactly here,
at 300s only. Fixed by adding a second short variant in `activate` and
`prepare` — an inventory change, not a recipe change.

| Slot | Family | Serves | Max |
|---|---|---|---:|
| `fg_arrive` | `orient` | `arrive` | ≤21s |
| `fg_wake_body` | `activate` | `wake_body` | ≤48s |
| `fg_raise_energy` | `activate` or `regulate` | `raise_energy` | ≤51s |
| `fg_find_direction` | `reframe` or `focus` | `find_direction` | ≤49s |
| `fg_first_move` | `focus` or `prepare` | `choose_first_move` | ≤48s |
| `fg_momentum` | `activate` or `prepare` | `build_momentum` | ≤68s |
| `fg_close` | `close` | `close` | ≤15s |

CONTENT AUTHORING REQUIRED for every slot above.

---

## What the three add to the global picture

- `wired_sleep` sets the **11s ceiling** on any globally shared `close` or
  `sleep` module.
- `scattered_focused` sets the **largest slot** at 402s, and demands the most
  `focus` depth.
- `flat_go` demands two short `activate` and two short `prepare` variants,
  because of three-phase eligibility under no-repeat.

Consolidated in [`module-inventory-v1.md`](./module-inventory-v1.md).
