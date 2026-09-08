# ELSEA — handover

ELSEA™ by ALIGNEX. A consumer iOS-first state-transition app: someone says what
is going on, and gets an audio session composed to move them from where they
are to where they need to be.

**This is the living record of what exists.** Update it when something is built,
decided, or found to be wrong. A stale claim here is worse than no claim, so
prefer deleting a line to leaving it out of date.

Companions: [`session-engine.md`](./session-engine.md) is the architecture of
record for composition, cost and playback; [`module-library.md`](./module-library.md)
is the brief for the intervention library. This file is the inventory and the
state of play.

Last updated: 2026-09-08.

---

## 1. Status at a glance

| | |
|---|---|
| Branch | `main` |
| Tests | 130 passing across 7 suites |
| TypeScript | clean |
| Lint | 1 pre-existing error in `src/hooks/use-color-scheme.web.ts` (Expo starter, web-only, untouched) |
| Migrations | 7 written, **all applied** |
| Edge functions | `interpret` and `compose` both **deployed** |
| Audio content | **none exists** |
| Blocking | the intervention-module library |

**The product runs end to end today** on the catalogue path, as a correctly
timed session with no sound. The whole flow — safety gate, interpretation,
target and time, playback, pause, early exit, outcome — is genuinely
exercisable.

---

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

Catalogue era: `transitions`, `sessions_catalogue`, `session_segments`,
`safety_events`, `user_sessions`, `session_outcomes`.

Session engine: `intervention_modules`, `recipe_phases`,
`recipe_phase_families`, `module_effectiveness`, `generated_segments`,
`session_manifests`, `manifest_segments`.

Cost: `provider_pricing` (append-only, trigger-enforced), `session_costs`.

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

## 7. Known gaps

Stated plainly so none is mistaken for finished work.

- **No audio content.** `intervention_modules` is empty. Every session runs
  silent, which the UI states.
- **Edge Functions are not typechecked.** `tsconfig.json` excludes `supabase/`
  and nothing under `src/` imports a function, so tsc never sees one. This is
  not theoretical: an import of a name that did not exist deployed
  successfully and returned BOOT_ERROR to every caller, and the CLI still said
  "Deployed Functions." A test now resolves every relative named import in the
  functions tree against the target's real exports, which catches that class of
  error, but it is not a typechecker. Deno type errors still reach production.
- **Manifest persistence is written and deployed but has never run.** The
  composer records a manifest and links it to the run, completing
  `session_costs -> session_manifests -> user_sessions -> session_outcomes`.
  The code sits downstream of a successful composition, which needs approved
  modules, so with an empty library it is unreachable and untested in
  execution. It will first run when real modules land, and should be watched
  the first time it does.
- **Nothing writes `session_costs` yet.** The manifest link exists; the cost
  row does not. That needs the generation path, which needs a TTS provider.
- **No TTS provider, and no dynamic speech.** Sessions bill nothing. This gates
  only the small dynamic-speech layer — recipes, modules, manifests,
  effectiveness and static audio all progress without it.
- **Edge fades, not crossfades.** A true crossfade overlaps cues, so playback
  would finish before the composed duration and drift from the progress bar.
  Real crossfade needs composition to model the overlap.
- **`FADE_SECONDS`, `BED_GAIN`, `BED_GAIN_DUCKED` are engineering defaults**,
  not approved production values.
- **`assets/images/elsea-transition-hero.png`** is committed but unreferenced.
- **Cost retention is undecided.** Cost rows cascade from the user, so deleting
  an account erases its cost history.

---

## 8. What is needed next, and from whom

The architecture phase is **closed**. Migrations applied, composer deployed,
lockdown verified.

**Two product questions the device walk surfaced.** Neither is a defect;
both are decisions.

1. A state pill alone routes to the correction screen rather than into a
   session, because a shortcut is not an interpretation. Correct by design, but
   it costs two extra taps on what is likely the most common quick path.
2. Availability gating is strict: someone arriving `tired_wired` sees one
   enabled target and five dimmed cards. Right per the taxonomy; whether five
   dimmed cards is the right presentation is a design call.

Also outstanding and purely cosmetic: the target and time screen still shows
"STATE TRANSITION INTELLIGENCE", which the entry redesign removed from Screens
1 and 2 but which was out of scope for that work.

**The real work now: the intervention-module library.** Nothing composes until
approved modules exist. The engineering constraints are computed and written up
in [`module-library.md`](./module-library.md) — including two that would
otherwise be discovered after recording: `close` needs a module of 10 seconds
or less and `orient` one of 20 seconds or less, or no five-minute session can
be composed at all. A small, exceptional set beats hundreds of mediocre
ones. This is content and clinical work, not architecture — and it is where the
experience the person actually hears gets made.

**Engineering, once modules exist:** persist manifests and link `manifest_id`;
walk the session screen on device; then the dynamic-speech layer, which is when
the TTS provider decision finally matters.

---

## 9. Working on it

```bash
npx expo start                          # dev server
npx tsc --noEmit                        # types
npx expo lint                           # lint
npx jest                                # tests
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
- **The allocator has one home:** `supabase/functions/_shared/allocate.ts`.
  Keep it dependency-free — no React, Expo, Supabase client, Deno or Node
  globals — or the app and the Edge Function can no longer share it.
- Windows: use `adb pull` for screenshots — PowerShell redirection corrupts
  binaries. Prefix remote paths with `MSYS_NO_PATHCONV=1` in Git Bash.
