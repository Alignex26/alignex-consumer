# ELSEA — handover

ELSEA™ by ALIGNEX. A consumer iOS-first state-transition app: someone says what
is going on, and gets an audio session composed to move them from where they
are to where they need to be.

**This is the living record of what exists.** Update it when something is built,
decided, or found to be wrong. A stale claim here is worse than no claim, so
prefer deleting a line to leaving it out of date.

Companions:

- [`session-engine.md`](./session-engine.md) — architecture of record for
  composition, cost and playback.
  - [`module-library.md`](./module-library.md) — constraints the intervention
    library has to satisfy, computed from the allocator.
  - [`tranche-nervous-ready.md`](./tranche-nervous-ready.md) and
    [`tranche-wound-up-home.md`](./tranche-wound-up-home.md) — the content briefs
    for the first two recipes, written for an author who does not read code.

This file is the inventory and the state of play.

Last updated: 2026-09-09.

---

## 1. Status at a glance

| | |
|---|---|
| Branch | `main` |
| Tests | 221 passing across 10 suites |
| TypeScript | clean |
| Lint | 1 pre-existing error in `src/hooks/use-color-scheme.web.ts` (Expo starter, web-only, untouched) |
| Migrations | 8 written, **all applied** |
| Edge functions | `interpret` and `compose` deployed and current (`npm run deploy:check`) |
| Audio content | **none exists** |
| Blocking | approved intervention content and audio. All 5 recipes specified. |

**The product runs end to end today** on the catalogue path, as a correctly
timed session with no sound. The whole flow — safety gate, interpretation,
target and time, playback, pause, early exit, outcome — is genuinely
exercisable.

---

## 1b. Checkpoint — where the code actually is

**The completion pass is not on `main`.** It sits on a pushed branch, approved
but not integrated.

| | |
|---|---|
| Branch | `elsea-v1-completion`, pushed, tracking `origin/elsea-v1-completion` |
| Commits ahead of `main` | 3 |
| `main` tip | `ef68ac8` — does **not** contain the completion pass |
| Divergence | none; `main` is an ancestor, so integration is a fast-forward |

```
b74b5f9  Exclude the deploy marker from its own staleness check
36173c6  Record the deployed commit for the parity check
2d9fc85  V1 functional completion pass
```

**Read `main` and this branch differently.** Everything else in this document —
221 tests, 8 migrations, 47-module inventory, private audio, no-repeat — is
true of `elsea-v1-completion`. A checkout of `main` has none of it, and its
tests, docs and function sources are three commits behind.

The database and the deployed functions, however, are **already at the branch
state**: migrations were applied and both functions deployed during the pass.
So `main` is currently the odd one out — the repository lags the running
system, rather than the other way round. That is the reverse of the usual
drift and worth holding in mind: a `main` checkout will not match production.

Integration, when wanted, is a fast-forward:

```bash
git checkout main
git merge --ff-only elsea-v1-completion
git push origin main
```

Nothing else is required — no rebase, no conflict resolution — because the
branch was cut from the current `main` and `main` has not moved since.

## 2. Hard constraints

Not preferences. Breaking any is a defect, and most are enforced by tests.

- **Raw free text never reaches interpretation or selection without passing the
  server-side safety gate.** If the gate fails technically, **fail closed**.
  - **No raw user text reaches TTS, a cache key, or analytics.** Dynamic copy is
    built from structured state only. `SpeechContext` has no field for what the
    person wrote and no way to add one.
  - **Never** `console.log` raw user free text, send it to PostHog, or put it in
    a generic analytics property.
  - **The recipes are private.** `recipe_phases`, `recipe_phase_families` and
    `intervention_modules` are service-role only and must never be given an anon
    policy.
  - **The decision engine never ships to a device.** Nothing under `src/` may
    import `supabase/functions/_shared/` at runtime; type-only imports are fine
    because they are erased. Enforced by test.
  - **Approved intervention audio must not sit in an enumerable public bucket.**
    Master module recordings are the same class of IP as the recipes. Production
    manifests must resolve private assets through short-lived signed URLs. This
    will not stop a determined capture, but it prevents trivial catalogue
    scraping. *Not yet implemented — no storage system and no audio exists.*
  - **No service-role Supabase key client-side. No provider key bundled
    client-side. No server secret in an `EXPO_PUBLIC_` variable.**
  - **Do not weaken RLS for development convenience.**
  - **Dynamic TTS ≤30s per session, hard ceiling 45s**, enforced server-side
    where the paid provider can actually be called. Never trust a client-supplied
    budget. Over-budget is rejected, never trimmed.
  - **Duration is a runtime parameter, not the identity of an intervention** (P4).
    No 5/10/15/20-minute variants of anything, ever.
  - **Canonical values are never renamed to match UI language.**

---

## 3. Decisions already locked

Recorded so they are not relitigated.

### Product

- **P1** — synthesised voice in scope for V1, bounded.
  - **P4** — five canonical recipes; duration is a runtime composition parameter.
  - **P19** — the five recipe phase structures, **approved as a product draft**.
    Seeded in migration `20260908150000`. See §5.
  - **Module families** — twelve product-level taxonomy slots. Canonical form is
    **lower case**: `orient`, `regulate`, `ground`, `release`, `reframe`,
    `focus`, `activate`, `prepare`, `transition`, `settle`, `sleep`, `close`.
    Upper case is a display treatment only and never reaches the database, the
    API or the domain model. Slots only — the technique that fills one is
    authored and approved outside engineering.
  - **Eligibility is family-level.** `recipe_phase_families` is the only V1
    mechanism. `module_affinities` was removed rather than left as a second,
    vaguer answer to the same question. A per-module clinical override, if ever
    needed, will be an explicit construct decided at the time.
  - **Target cards** — six, exhaustive 1:1 onto the canonical targets:
    `focused → Focused`, `activated → Energised`, `home → Calmer`,
    `sleep → Rested`, `ready → Confident`, `settled → Settled`. "Happier" is
    deliberately absent: it has no approved canonical target.
  - **Durations** — exact values: 300 / 600 / 900 / 1200 seconds. `unsure`
    resolves to the shortest.
  - **Bottom navigation** — deferred, not built.

### Safety and clinical

- **S3** — context may influence personalised voice; raw user text must never
  be passed into speech or echoed without an approved transformation boundary.
  - **S13** — boundaries and expansion rules approved.
  - **S14** — all duration floors **provisional pending clinical review**.
    `recipe_phases.is_provisional` carries this in the data.
  - **S15** — silence is composed, never baked into a file.
  - **S16** — **any phase or planner change requires re-approval.** Granted once
    since: a phase now chains several modules rather than playing one and padding
    the rest with silence. See `module-library.md` §3.
  - **S4** — clinical technique content is authored and approved outside
    engineering. `intervention_modules.approved` gates it.

### Commercial — the eight profitability rules

> ELSEA generates the **decision**, not the **session**.

1. Unlimited sessions for the customer.
   2. Sessions are composed, never wholly generated or stored whole.
   3. AI interpretation produces structured state, not freeform therapy.
   4. Dynamic TTS normally ≤30s per session; ceiling 45s.
   5. Reusable audio served from storage/CDN, produced once.
   6. Client-side composition from a manifest.
   7. Voice provider abstracted, never hard-wired.
   8. Personalisation from effectiveness data, not bigger prompts.

---

## 4. Where the boundary sits

```
user input
  -> safety gate + interpretation      server-side  (functions/interpret)
  -> structured decision
  -> SERVER-SIDE COMPOSER              server-side  (functions/compose)
       recipes, family eligibility, module selection,
       effectiveness, budget
  -> SessionManifest, with resolved storage paths
  -> app
  -> client-side timeline and playback  sequencing, bed, ducking, fades, silence
```

Rule 6 is intact: **playback** composition is client-side. It is the
**decision** that is server-side. The client receives what to play and never
learns how it was chosen.

**Nothing of the decision engine ships to the device.** The allocator, the
selection rules, the recipe vocabulary and the speech budget all live under
`supabase/functions/_shared/` and are server-side only. The app holds the
transport, the timeline and the player, and nothing else. Verified by grepping
a real Metro bundle, not by reading imports — see §6.

The client re-exports the engine's types, but as **types only**: `export type`
is erased by babel, so no runtime module follows them into the bundle. A value
re-export would silently drag the whole engine across, so
`recipes.test.ts` fails if any file under `src/` imports `_shared` at runtime.

Two reasons the decision has to be server-side:

1. **The recipes are the IP.** While those tables were anon-readable, anyone
   who pulled the public key out of the app bundle could enumerate them.
   2. **The composer is the only thing that can call a paid TTS provider**, so it
      is the only place the dynamic-speech budget can be enforced. A ceiling
      checked only on a client is not a ceiling.

---

## 5. What is built

### Application — Expo SDK 57, expo-router, React Compiler enabled

24 routes under `src/app`. The entry flow:

```
index (welcome) -> whats-going-on -> understanding (safety gate)
  -> time (target + duration) -> audio-prep -> session-opening -> session
  -> outcome -> outcome-detail -> learning
```

Diversions: `support` (safety), `correction`, `error`, `offline`, `paywall`,
`free-limit`, `sign-in`, `account`.

Screens 1 and 2 follow the locked dark direction, using the approved
`elsea-orb.png` and `elsea-wordmark-light.png`. Both are sized by **visible ink
width**, measured from the files, because each carries a different amount of
transparent padding — see `ElseaMarkAsset`.

### Flow and safety

| File | Role |
|---|---|
| `src/flow/product-flow.ts` | The phase graph. |
| `src/flow/use-flow-guard.ts` | Stops a screen being reached out of order. |
| `supabase/functions/interpret` | Safety gate + interpretation. Deployed. |
| `src/lib/interpret-service.ts` | Client side of the above. |

The flow test asserts a **graph invariant**: every edge into an
interpretation-bearing phase must come from the gate or another such phase.
Moving the confirm step cannot quietly open a path around the gate.

### Session engine

| File | Role |
|---|---|
| `supabase/functions/_shared/types.ts` | Domain types. Owned server-side; the client re-exports them as types only. |
| `supabase/functions/_shared/allocate.ts` | Allocation and selection. **Server-side only.** |
| `supabase/functions/_shared/compose.ts` | Decision to manifest. **Server-side only.** |
| `supabase/functions/_shared/speech.ts` | TTS budget and derived cache keys. **Server-side only.** |
| `supabase/functions/_shared/provider.ts` | Provider adapter boundary. No vendor wired. |
| `supabase/functions/compose` | **The server-side composer.** Deployed. Calls `_shared/compose.ts`; it does not assemble manifests itself. |
| `src/lib/composition.ts` | Transport to the composer. No product logic. |
| `src/lib/composition.ts` | Calls the composer. Transport only, no product logic. |
| `src/lib/cost/rate-card.ts` | Versioned rates. No price in code. |
| `src/lib/cost/session-cost.ts` | Prices a session from recorded quantities. |
| `src/types/session-engine.ts` | Domain types. |

### Audio

| File | Role |
|---|---|
| `src/audio/timeline.ts` | Manifest → validated, absolute-timed cues. Pure. |
| `src/audio/use-manifest-player.ts` | Multi-segment player: two alternating players, bed, ducking, edge fades, composed silence. |
| `src/audio/use-session-composition.ts` | Asks the composer, once per session. |
| `src/audio/use-session-audio.ts` | Legacy single-segment catalogue engine. Still the live path. |

`session.tsx` runs both behind one shape. The catalogue is in front; the
composer takes over **only when it returns a complete manifest**. Today it
never does, because no modules exist, so every session falls back. It switches
over on its own when approved content lands.

### Database — 7 migrations, all applied

| Migration | Applied |
|---|---|
| `20260906131226_initial_schema` | yes |
| `20260906132729_seed_transitions_and_catalogue` | yes |
| `20260907090000_core_schema` | yes |
| `20260908120000_session_engine` | yes |
| `20260908130000_session_cost_telemetry` | yes |
| `20260908150000_protect_recipes_and_seed_p19` | yes |
| `20260908160000_drop_module_affinities` | yes |
| `20260909100000_private_intervention_audio` | yes |

Catalogue era: `transitions`, `sessions_catalogue`, `session_segments`,
`safety_events`, `user_sessions`, `session_outcomes`.

Session engine: `intervention_modules`, `recipe_phases`,
`recipe_phase_families`, `module_effectiveness`, `generated_segments`,
`session_manifests`, `manifest_segments`.

Cost: `provider_pricing` (append-only, trigger-enforced), `session_costs`.

**Private audio.** Approved masters live in the `intervention-audio` bucket,
which is private with no client policy. Verified against the live system: anon
write returns `403` RLS violation, a public read returns `400`, and reading the
bucket's metadata returns `404 Bucket not found` — anon cannot see that it
exists. The composer signs per-segment URLs with a 2-hour expiry; the client
never receives a storage path and never touches the bucket.

**RLS posture.** Service-role only, no client policy at all: `recipe_phases`,
`recipe_phase_families`, `intervention_modules`, `provider_pricing`,
`session_costs`. Own-rows-only: `user_sessions`,
`session_outcomes`, `module_effectiveness`, `session_manifests`,
`manifest_segments`. Anon-readable: `transitions`, `sessions_catalogue`,
`session_segments` — no IP, and they serve the live catalogue path.

> The lockdown is live and verified — see §6.

### The five recipes (P19, provisional)

31 phase rows and 53 family-eligibility rows, in the pending migration. Five
pathways, not five scripts — the allocator fills the bottom of each band for a
short session and distributes surplus within the ceilings as time allows.

| Recipe | Phases | Floor | Ceiling |
|---|---|---:|---:|
| `wound_up_home` | arrive, downshift_arousal, leave_work_behind, reconnect_to_now, settle, close | 215s | 1245s |
| `scattered_focused` | arrive, reduce_noise, choose_direction, stabilise_attention, build_momentum, close | 215s | 1425s |
| `nervous_ready` | arrive, regulate_arousal, reframe_energy, build_readiness, direct_attention_forward, close | 245s | 1425s |
| `wired_sleep` | arrive, settle_body, slow_system, release_thoughts, allow_sleep, close | 240s | 1545s |
| `flat_go` | arrive, wake_body, raise_energy, find_direction, choose_first_move, build_momentum, close | 275s | 1425s |

All five span 300 / 600 / 900 / 1200 seconds, asserted in `recipes.test.ts`.

### Tests — 116 across 7 suites

| Suite | Covers |
|---|---|
| `safety.test.ts` | The gate. |
| `flow.test.ts` | Flow graph invariant, target-card mapping, analytics shape. |
| `selection.test.ts` | Catalogue selection, exact durations. |
| `session-engine.test.ts` | The eight rules as executable invariants, phase allocation. |
| `session-cost.test.ts` | Cost arithmetic, pricing-version integrity. |
| `timeline.test.ts` | Playable timeline, malformed manifests, edge fades. |
| `recipes.test.ts` | The seeded recipes, family eligibility, and that no client code queries a proprietary table. |

---

## 6. Verified against the live system

Probed, not assumed:

- **RLS enforces on writes.** Anon inserts into `session_costs`,
  `provider_pricing` and `intervention_modules` return `42501`, rejected
  *before* the FK and CHECK constraints fire. That ordering is only possible
  with RLS active.
  - **Catalogue path intact.** `transitions` 5 rows, `sessions_catalogue` 16,
    `session_segments` 16 visible to anon.
  - **Screens 1 and 2** measured across seven frames, 320×568 to 430×950.
  - **One allocator, and it does not ship.** The composer and the tests share
    `supabase/functions/_shared/allocate.ts`; the app imports none of it. The 47
    engine and timeline tests passed unchanged across the refactor, which is the
    parity evidence — same inputs, same manifests, one implementation. Absence
    from the client was confirmed by grepping a real Metro bundle rather than by
    reading imports, because `tsc` and jest run through babel and would not
    catch a bundler difference.

  - **The recipe lockdown is live.** Against the deployed database, anon reading
    `recipe_phases` gets `200 []` while the table holds 31 rows, and
    `recipe_phase_families` the same against 53. RLS is hiding real data, not an
    empty table — which is a far stronger result than probing empty tables was.
    `module_affinities` returns `404 PGRST205`; it is gone.

    The rows are proven present by `compose` itself: it answers `library_empty`,
    a failure reached only AFTER the recipe lookup succeeds. Had the recipes been
    missing it would have said `no_recipe`.
  - **Deno resolves the shared engine.** The deploy uploads
    `_shared/compose.ts`, `allocate.ts`, `speech.ts` and `types.ts` alongside the
    function, following the import chain. This could not be checked locally —
    no `deno` binary, no Docker — and the deploy settled it.
  - **The composer behaves.** `library_empty` for a valid transition with no
    modules, `bad_duration` for 99999 seconds, `unknown_transition` for an
    unknown or absent key.
  - **The whole flow was walked on a device**, welcome through to the outcome
    question. The session screen logged
    `[ELSEA] Session engine unavailable (library_empty)` — which is the chain
    proving itself end to end: the app called the deployed composer, the composer
    read the seeded recipes with the service role, found no modules, and the app
    fell back to the catalogue path and ran a correctly timed silent session.
    Pause was verified by holding the clock at 0:37 across five seconds rather
    than by assuming. Availability gating showed correctly: from `tired_wired`
    the only target offered was Sleep, and only "Rested" was enabled.

---

## 6b. Content coverage — all five specified

Every recipe now has a content specification, and the consolidated plan is
[`module-inventory-v1.md`](./module-inventory-v1.md): **47 modules**.

The number was not chosen. Each module exists because removing it breaks one of
the twenty recipe/duration cases, or because the library would otherwise be so
thin that the same few played every session.

| | |
|---|---|
| Recipes specified | 5 of 5 |
| Proposed modules | 47, across 12 families |
| Composition cases proven | 20 of 20 |
| Repeated modules in any manifest | 0 |
| Silence range | 3–30%, worst at 300s |

Proven by `src/__tests__/composition-proof.test.ts`, which runs the real
allocator over every case. It is both the evidence and the regression guard: a
change to the allocator, the recipes or the inventory that breaks any of the
twenty fails there.

**The binding constraint is duration, not family.** A module is sized to the
tightest slot in ANY recipe that uses it, not the recipe it was written for. A
`close` module sized 16s for `nervous_ready` is unselectable in `wired_sleep`,
whose `close` gets 11s — and that recipe then has no five-minute session at
all. Family coverage looks like composability and is not.

## 7. Known gaps

Stated plainly so none is mistaken for finished work.

- **No audio content and no approved modules.** `intervention_modules` is
  empty. Every session runs on the catalogue fallback, silent, which the UI
  states. This is the blocker.
- **Manifest persistence is verified in structure, not in execution.** The rows
  it would write are checked against the real schema constraints, and the
  rollback path is pinned, but no INSERT has run — that needs an approved
  module with real audio, and inventing one is precisely what must not happen.
  Watch it the first time real content lands.
- **Nothing writes `session_costs`.** The manifest link and every column exist;
  the row does not, because there is no generation to cost. Needs a TTS
  provider.
- **No TTS provider, no dynamic speech.** Deliberately deferred. Sessions bill
  nothing. `_shared/provider.ts` is the adapter boundary; `speech.ts` holds the
  budget. Both server-side.
- **Edge Function typechecking is real but partial.** `npm run
  typecheck:functions` checks the functions' own logic — imports resolve, names
  exist, types line up — using hand-written ambient stubs in
  `supabase/functions/deno-ambient.d.ts`. It does NOT verify calls against the
  real supabase-js signatures, because there is no `deno` here and tsc cannot
  resolve a `jsr:` specifier. Do not read a clean run as full Deno type safety.
- **Edge fades, not crossfades.** A true crossfade overlaps cues and would make
  playback finish before the composed duration. Deferred to the design pass.
- **`FADE_SECONDS`, `BED_GAIN`, `BED_GAIN_DUCKED` are engineering defaults**,
  not approved production values.

## 8. What is needed next, and from whom

Engineering has taken this as far as it legitimately can without content.

**From content and clinical — the blocker:**

1. The 47 modules in [`module-inventory-v1.md`](./module-inventory-v1.md):
   technique, wording, delivery, and a `technique_key` per module.
2. `intensity` semantics — the column is 1–10 and read by nothing; what a 3
   means versus an 8 is undefined.
3. Audio format — no codec, sample rate, bitrate, channel count or loudness
   target is documented anywhere.
4. Whether 20–30% silence in a five-minute session is acceptable. If not, the
   answer is more short modules.

**From design:** the screen pass. Two questions from the device walk are still
open — a state pill routes to the correction screen rather than into a session,
and someone arriving `tired_wired` sees one enabled target card and five
dimmed.

**From engineering, once content exists:** upload masters to the private
bucket, set `approved`, watch manifest persistence execute for the first time,
then the dynamic speech layer when a provider is chosen.

## 9. Working on it

```bash
npm run verify                          # types + function types + lint + tests
npm run typecheck                       # client types
npm run typecheck:functions             # Edge Function types (see gaps)
npm run deploy:check                    # are deployed functions current?
npx expo start                          # dev server
npx supabase migration list             # what is applied
npx supabase db push                    # apply pending migrations
npx supabase functions deploy compose   # deploy the composer
```

Notes for whoever picks this up:

- **Read the versioned Expo docs** at `https://docs.expo.dev/versions/v57.0.0/`
  before writing code. The APIs have changed.
  - **React Compiler is enabled.** Do not read refs during render, and do not
    mutate values returned by hooks. Both are lint errors, and both are real.
  - **Never edit an applied migration.** Add a new one.
  - **Redeploy after touching `supabase/functions/`, including `_shared/`.**
    A change to shared code is a change to every function that imports it, and
    nothing will tell you the deployed copy is stale.
  - **The allocator has one home:** `supabase/functions/_shared/allocate.ts`.
    Keep it dependency-free — no React, Expo, Supabase client, Deno or Node
    globals — or the app and the Edge Function can no longer share it.
  - Windows: use `adb pull` for screenshots — PowerShell redirection corrupts
    binaries. Prefix remote paths with `MSYS_NO_PATHCONV=1` in Git Bash.
