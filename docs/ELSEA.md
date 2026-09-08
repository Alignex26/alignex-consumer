# ELSEA — handover

ELSEA™ by ALIGNEX. A consumer iOS-first state-transition app: someone says what
is going on, and gets an audio session composed to move them from where they
are to where they need to be.

**This is the living record of what exists.** Update it when something is built,
decided, or found to be wrong. If a claim here is out of date it is worse than
no claim at all, so prefer deleting a line to leaving it stale.

Companion document: [`session-engine.md`](./session-engine.md) is the
architecture of record for composition, cost and playback. This file is the
inventory and the state of play.

Last updated: 2026-09-08.

---

## 1. Status at a glance

| | |
|---|---|
| Branch | `main`, synced with `origin` |
| Tests | 100 passing across 6 suites |
| TypeScript | clean |
| Lint | 1 pre-existing error in `src/hooks/use-color-scheme.web.ts` (Expo starter, web-only, untouched) |
| Database | 5 migrations applied to the live Supabase project |
| Audio content | **none exists** |
| Blocking | the five recipe phase structures, module content, TTS provider |

**The product runs end to end today** on the catalogue path, as a correctly
timed session with no sound. Everything about the flow — safety gate,
interpretation, target and time, playback, pause, early exit, outcome — is
genuinely exercisable.

---

## 2. Hard constraints

These are not preferences. Breaking any of them is a defect, and most are
enforced by tests rather than by memory.

- **Raw free text never reaches interpretation or selection without passing the
  server-side safety gate.** If the gate fails technically, **fail closed**.
- **No raw user text reaches TTS, a cache key, or analytics.** Dynamic copy is
  built from structured state only. `SpeechContext` has no field for what the
  person wrote and no way to add one.
- **Never** `console.log` raw user free text, send it to PostHog, or put it in a
  generic analytics property.
- **No service-role Supabase key client-side. No provider key bundled
  client-side. No server secret in an `EXPO_PUBLIC_` variable.**
- **Do not weaken RLS for development convenience.**
- **Dynamic TTS ≤30s per session, hard ceiling 45s.** Enforced at composition,
  before any provider call. Over-budget is rejected, never trimmed.
- **Duration is a runtime parameter, not the identity of an intervention** (P4).
  Do not hard-code 5/10/15/20 into the composition engine because they appear
  in a design.
- **Canonical values are never renamed to match display labels.**

---

## 3. Decisions already locked

Recorded so they are not relitigated. Codes are the original decision labels.

### Product

- **P1** — synthesised voice is in scope for V1, bounded.
- **P4** — five canonical intervention recipes. Duration is a runtime
  composition parameter.
- **P19** — phase structures drafted for all five recipes (drafted in
  conversation; **not yet in the repo** — see §7).
- **Target cards** — six, an exhaustive 1:1 mapping onto the approved canonical
  targets: `focused → Focused`, `activated → Energised`, `home → Calmer`,
  `sleep → Rested`, `ready → Confident`, `settled → Settled`. "Happier" is
  deliberately absent: no approved canonical target.
- **Durations** — exact values, not spans: 5 / 10 / 15 / 20+ minutes mapping to
  300 / 600 / 900 / 1200 seconds. `unsure` resolves to the shortest.
- **Bottom navigation** (Home / Talk / Progress / You) — deferred, not built.

### Safety and clinical

- **S3** — contextual information may influence personalised voice; raw user
  text must never be passed into speech or echoed without an approved
  transformation boundary.
- **S13** — boundaries plus expansion rules approved.
- **S14** — drafted duration floors are **provisional pending clinical review**.
  `recipe_phases.is_provisional` carries this in the data.
- **S15** — silence rules drafted. Silence is composed, never baked into a file.
- **S16** — **any phase or planner change requires re-approval.**
- **S4** — clinical technique content is authored and approved outside
  engineering. The engine defines taxonomy slots only.

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

## 4. What is built

### Application — Expo SDK 57, expo-router, React Compiler enabled

24 routes under `src/app`. The entry flow:

```
index (Screen 1, welcome)
  -> whats-going-on (Screen 2, free text + state pills)
  -> understanding  (runs the server-side safety gate)
  -> time           (target + available time)
  -> audio-prep -> session-opening -> session
  -> outcome -> outcome-detail -> learning
```

Diversions: `support` (safety), `correction`, `error`, `offline`, `paywall`,
`free-limit`, `sign-in`, `account`.

Screens 1 and 2 are built to the locked dark visual direction, using the
approved `elsea-orb.png` and `elsea-wordmark-light.png`. Both assets are sized
by **visible ink width**, measured from the files, because each carries a
different amount of transparent padding — see `ElseaMarkAsset`.

### Flow and safety

| File | Role |
|---|---|
| `src/flow/product-flow.ts` | The phase graph. Every legal transition. |
| `src/flow/use-flow-guard.ts` | Stops a screen being reached out of order. |
| `supabase/functions/interpret` | Safety gate + interpretation. Server-side. |
| `src/lib/interpret-service.ts` | Client side of the above. |

The flow test asserts a **graph invariant**, not a list: every edge into an
interpretation-bearing phase must come from the gate or from another such
phase. Moving the confirm step cannot quietly open a path around the gate.

### Session engine

| File | Role |
|---|---|
| `src/lib/compose.ts` | Decision → manifest. Pure. |
| `src/lib/composition.ts` | Loads recipe, modules, effectiveness; calls compose. |
| `src/lib/voice/budget.ts` | TTS budget and derived cache keys. |
| `src/lib/voice/provider.ts` | Provider adapter boundary. No vendor wired. |
| `src/lib/cost/rate-card.ts` | Versioned rates. No price in code. |
| `src/lib/cost/session-cost.ts` | Prices a session from recorded quantities. |
| `src/types/session-engine.ts` | Domain types. |

### Audio

| File | Role |
|---|---|
| `src/audio/timeline.ts` | Manifest → validated, absolute-timed cues. Pure. |
| `src/audio/use-manifest-player.ts` | Multi-segment player: two alternating players, bed, ducking, edge fades, composed silence. |
| `src/audio/use-session-composition.ts` | Attempts composition once per session. |
| `src/audio/use-session-audio.ts` | Legacy single-segment catalogue engine. Still the live path. |

`session.tsx` runs both behind one shape. The catalogue is in front; the
composition engine takes over **only when it can produce a complete manifest**.
Today it never can, so every session falls back and nothing changes. It starts
serving real sessions when recipes and modules land, with no code change.

### Database — 5 migrations, all applied

Catalogue era: `transitions`, `sessions_catalogue`, `session_segments`,
`safety_events`, `user_sessions`, `session_outcomes`.

Session engine: `intervention_modules`, `module_affinities`, `recipe_phases`,
`module_effectiveness`, `generated_segments`, `session_manifests`,
`manifest_segments`.

Cost: `provider_pricing` (append-only, trigger-enforced), `session_costs`.

RLS is on everywhere. Library and recipe tables are readable by anon;
per-person tables are own-rows-only; **`provider_pricing` and `session_costs`
have no client policies at all** and are service-role only — rate cards are
commercially sensitive and a client must never be the source of truth for cost.

### Tests — 100 across 6 suites

| Suite | Covers |
|---|---|
| `safety.test.ts` | The gate. |
| `flow.test.ts` | Flow graph invariant, target-card mapping, analytics shape. |
| `selection.test.ts` | Catalogue selection, exact durations. |
| `session-engine.test.ts` | The eight rules as executable invariants, phase allocation. |
| `session-cost.test.ts` | Cost arithmetic, pricing-version integrity. |
| `timeline.test.ts` | Playable timeline, malformed manifests, edge fades. |

---

## 5. Verified against the live system

Not assumed — probed:

- **RLS enforces on writes.** Anon inserts into `session_costs`,
  `provider_pricing` and `intervention_modules` all return `42501`, rejected
  *before* the FK and CHECK constraints fire. That ordering is only possible
  with RLS active.
- **The PostgREST embed resolves.** `module_affinities?select=phase,intervention_modules(*)`
  returns `[]` rather than a relationship error, so the engine will see content
  when it lands. Had it errored, the catch would have swallowed it into
  `library_empty` and the engine would never have activated, silently.
- **Catalogue path intact.** `transitions` 5 rows, `sessions_catalogue` 16,
  `session_segments` 16 visible to anon.
- **Screens 1 and 2** measured across seven frames, 320×568 to 430×950.

---

## 6. Known gaps

Stated plainly so none is mistaken for finished work.

- **No audio content.** `intervention_modules` is empty. Every session runs
  silent, which the UI states.
- **`recipe_phases` is empty.** The P19 drafts were never written to the repo.
- **The player is wired but never activates**, because there is no manifest to
  produce.
- **Manifests are not persisted.** `session_manifests` is unused and
  `user_sessions.manifest_id` stays null, so `cost_per_successful_transition`
  is reachable by join but has no data.
- **No TTS provider.** `src/lib/voice` is a boundary with nothing behind it.
- **No dynamic speech is composed.** `loadComposition` passes an empty speech
  list, so sessions bill nothing.
- **Edge fades, not crossfades.** A true crossfade overlaps cues, so playback
  would finish before the composed duration and drift from the progress bar.
  Real crossfade requires composition to model the overlap — a manifest change.
- **`FADE_SECONDS`, `BED_GAIN`, `BED_GAIN_DUCKED` are engineering defaults**,
  not approved production values.
- **The session screen is unproven at runtime.** It compiles and its queries are
  verified, but the full flow has not been walked on a device since wiring.
- **`assets/images/elsea-transition-hero.png`** is committed but unreferenced —
  the orb replaced it.
- **Cost retention is undecided.** Cost rows cascade from the user, so deleting
  an account erases its cost history. Whether aggregate cost should outlive an
  account is a data-retention decision.

---

## 7. What is needed next, and from whom

**From product / clinical — this is the blocker.**

The five recipes are the first piece of proprietary IP. Per transition
(`wound_up_home`, `scattered_focused`, `nervous_ready`, `wired_sleep`,
`flat_go`):

1. the ordered phase list;
2. a min/max seconds band per phase;
3. which module families are eligible in each phase.

That seeds `recipe_phases` and `module_affinities`, with floors flagged
`is_provisional` per S14. Everything downstream unblocks at once.

Also needed: module taxonomy content (S4), and a TTS provider decision.

**Engineering, once unblocked:** persist manifests and link `manifest_id`;
generate speech server-side; walk the session screen on device.

---

## 8. Working on it

```bash
npx expo start          # dev server
npx tsc --noEmit        # types
npx expo lint           # lint
npx jest                # tests
npx supabase migration list
npx supabase db push    # apply pending migrations
```

Notes for whoever picks this up:

- **Read the versioned Expo docs** at `https://docs.expo.dev/versions/v57.0.0/`
  before writing code. The APIs have changed.
- **React Compiler is enabled.** Do not read refs during render, and do not
  mutate values returned by hooks. Both are lint errors, and both are real.
- **Never edit an applied migration.** Add a new one.
- Windows: use `adb pull` for screenshots — PowerShell redirection corrupts
  binaries. Prefix remote paths with `MSYS_NO_PATHCONV=1` in Git Bash.
