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
  - [`module-inventory-v1.md`](./module-inventory-v1.md) — the consolidated
    47-module plan.
  - [`audio-production-spec.md`](./audio-production-spec.md) — codec, loudness
    and delivery requirements for recorded masters.
  - [`tranche-nervous-ready.md`](./tranche-nervous-ready.md),
    [`tranche-wound-up-home.md`](./tranche-wound-up-home.md) and
    [`tranche-remaining-three.md`](./tranche-remaining-three.md) — the
    engineering-side computations behind the content briefs.
  - **`content-authoring-brief-tranche-1.md` … `-5.md`** — the five briefs a
    writer, clinical reviewer and voice producer actually work from. These
    are the handable documents; the `tranche-*.md` files above are their
    source workings.
  - **`nervous-ready-production-pack.md`** — the first pack: five draft
    scripts with proposed technique keys, awaiting content and clinical
    review. Its manifest is `content/nervous-ready-tranche-1.draft.json`.

This file is the inventory and the state of play.

Last updated: 2026-09-09.

---

## 1. Status at a glance

| | |
|---|---|
| Branch | `main` |
| Tests | 585 passing across 19 suites |
| TypeScript | clean |
| Lint | clean |
| Migrations | 15 written, **all applied** |
| Edge functions | `interpret`, `compose`, `voice-check`, `generate-master` deployed and current |
| Deployment parity | current — marker `14b7dc42`; `generate-master` deployed 2026-09-10 |
| Audio content | **none exists** |
| Languages | English content-ready. `es` `de` `fr` `pt-BR` planned, **no translated content exists** |
| Voices | `warm` and `clear` active; `bright` exists but is **not mapped or selectable** |
| Blocking | recorded voice masters. Scripts approved; provider wired but never called live. |

**The product runs end to end today** on the catalogue path, as a correctly
timed session with no sound. The whole flow — safety gate, interpretation,
target and time, playback, pause, early exit, outcome — is genuinely
exercisable.

---

## 1b. Checkpoint — where the code actually is

**Everything described in this document is on `main`.** There are no other
branches, local or remote.

| | |
|---|---|
| Branch | `main`, pushed, matches `origin/main` |
| Tip | `923fa02` |
| Other branches | none — `elsea-v1-completion` and `elsea-content-pipeline` were merged and deleted |
| Deployed functions | current with `main`, verified by `npm run deploy:check` |
| Database | all 15 migrations applied |

The repository, the database and the deployed functions are in agreement for
the first time since the completion pass. An earlier version of this section
warned that `main` lagged production; that is no longer true, and the warning
has been removed rather than left to mislead.

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
    scraping. *Implemented and verified live — see §5 and §6. No audio exists
    to put in the bucket yet.*
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
  - **S4** — intervention content is authored and approved outside engineering.
    `intervention_modules.approved` gates it.

    > **S4 amended 2026-09-09, by the product owner.** The original read:
    > *"clinical technique content is authored and approved outside
    > engineering."* It required clinical review for all intervention content,
    > which left no route to approve general wellbeing material.
    >
    > **What the amendment allows.** Content offered as **general wellbeing
    > content** may be approved by the **product owner / content owner**, where
    > that person holds relevant wellbeing or mindfulness training. That
    > approval covers product intent, wording, tone, delivery direction, and use
    > within ELSEA. It is a real approval and sufficient for that class of
    > content.
    >
    > **What the amendment does not touch.** Content that is presented as
    > clinical or therapeutic, that names a clinical technique as such, that
    > claims to treat or diagnose, or that addresses a person in crisis, still
    > requires clinical review. So does anything reached through the safety
    > diversion. S3, S13, S14, S15 and S16 are unchanged.
    >
    > **The approving capacity must be recorded** alongside the content, so that
    > "approved" is never an undifferentiated flag with no author. See
    > `nervous-ready-production-pack.md` for the shape of that record.
    >
    > **No code changed.** `intervention_modules.approved` remains the gate; the
    > validator still rejects an approved module with no audio; and nothing in
    > the schema or the composer knows who approved anything — that was true
    > before this amendment and is true after it.

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
| `supabase/functions/_shared/provider.ts` | Provider adapter boundary. |
| `supabase/functions/_shared/elevenlabs.ts` | ElevenLabs behind that boundary. **Never called live.** See §6h. |
| `supabase/functions/_shared/novelty.ts` | Manifest fingerprint and recency scoring. **Server-side only. Not yet called by the composer.** |
| `supabase/functions/_shared/replay.ts` | Exact replay and reuse-intent. **Server-side only. Not yet called by the composer.** |
| `supabase/functions/_shared/cost.ts` | Cost rows from a manifest. Dormant — nothing generates yet. |
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

### Content ingestion

| File | Role |
|---|---|
| `scripts/modules-validate.mjs` | Validates a module manifest before anything touches the database. Rejects unknown families, malformed storage paths, duplicates, placeholder `technique_key`s, non-boolean approval and bad versions, and checks the audio itself against the production spec. Three-valued exit: `0` verified, `1` invalid, `2` records valid but audio unverified. A skipped check is never reported as a pass. |
| `scripts/modules-import.mjs` | Imports validated modules and writes their immutable version rows. **Dry run by default** — a real write needs `--commit`. Refuses to commit audio the validator could not verify, unless `--allow-unverified-audio` is passed deliberately. |
| `src/__fixtures__/modules.example.json` | The shape an author's manifest must take. Example data, clearly marked; not production content. |

Nothing here invents content. The validator's job is to refuse a manifest that
would put unapproved or placeholder material in front of a person.

### Database — 15 migrations, all applied

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
| `20260909140000_ingestion_and_atomic_manifest` | yes |
| `20260909160000_novelty_and_saved_sessions` | yes |
| `20260909180000_persist_fingerprint` | yes |
| `20260910100000_voice_profiles_and_renditions` | yes |
| `20260910140000_locales_and_provider_voices` | yes |
| `20260910150000_bright_inactive_until_mapped` | yes |
| `20260910170000_approved_script_text` | yes |

Catalogue era: `transitions`, `sessions_catalogue`, `session_segments`,
`safety_events`, `user_sessions`, `session_outcomes`.

Session engine: `intervention_modules`, `recipe_phases`,
`recipe_phase_families`, `module_effectiveness`, `generated_segments`,
`session_manifests`, `manifest_segments`.

Cost: `provider_pricing` (append-only, trigger-enforced), `session_costs`.

Novelty and replay: `intervention_module_versions` (append-only, withdrawal
the one permitted change), `saved_sessions` (own-row RLS), and
`session_manifests.fingerprint`.

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

31 phase rows and 53 family-eligibility rows, applied. Five
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

### Tests — 585 across 19 suites

| Suite | Covers |
|---|---|
| `safety.test.ts` | The gate. |
| `flow.test.ts` | Flow graph invariant, target-card mapping, analytics shape. |
| `selection.test.ts` | Catalogue selection, exact durations. |
| `session-engine.test.ts` | The eight rules as executable invariants, phase allocation. |
| `session-cost.test.ts` | Cost arithmetic, pricing-version integrity. |
| `timeline.test.ts` | Playable timeline, malformed manifests, edge fades. |
| `recipes.test.ts` | The seeded recipes, family eligibility, and that no client code queries a proprietary table. |
| `composition-proof.test.ts` | The real allocator over all 20 recipe/duration cases. |
| `approval-gate.test.ts` | Only approved, active modules are selectable. |
| `manifest-persistence.test.ts` | Persistence rows against real schema constraints; rollback path. |
| `ingestion.test.ts` | The content ingestion contract, validator and importer. |
| `novelty-replay.test.ts` | Fingerprints, recency bounds, exact replay, withdrawal handling, cross-user isolation. |
| `novelty-simulation.test.ts` | 30 repeated sessions per recipe; reports freshness, asserts no target. |
| `schema-reachability.test.ts` | That every schema object has a writer, or is recorded as deliberately unwritten. |
| `spatial-audio.test.ts` | The sound layer: duration is untouchable, every layer stops together, absent assets degrade to voice-only, and no claim is made. |

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
  - **Novelty and replay tables are locked.** Anon insert into `saved_sessions`
    and `intervention_module_versions` both return `42501`, and both read `[]`.
  - **Deployment parity holds.** After the novelty pass, `compose` was
    redeployed and the marker recorded. The upload list carried six assets and
    neither `novelty.ts` nor `replay.ts` among them — independent confirmation,
    from the bundler rather than from reading imports, that the new modules are
    not yet reachable from the composer. Live behaviour was byte-identical on
    all three failure paths before and after, and the function booted clean.
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

## 6c. The content authoring programme — all five briefs written

Every recipe now has a brief a writer, clinical reviewer and voice producer can
work from without reading any code:
`content-authoring-brief-tranche-1.md` through `-5.md`.

They contain no intervention content and propose none. Every content, clinical
and approval field is left empty and marked REQUIRED.

### The shape of the programme

Writing all five together showed something none of them shows alone: **families
are introduced in Tranches 1, 2 and 4 only.**

| Tranche | Recipe | New families | The real work |
|---|---|---:|---|
| 1 | `nervous_ready` | 8 | the whole core |
| 2 | `wound_up_home` | 3 (`release`, `transition`, `settle`) | 2 new core modules, if T1 is authored to cross-recipe limits |
| 3 | `scattered_focused` | **0** | `focus` depth — it spans three phases |
| 4 | `wired_sleep` | 1 (`sleep`, the twelfth and last) | the `sleep` family, and the 11s close |
| 5 | `flat_go` | **0** | two short `activate` and `prepare` variants |

Tranches 3 and 5 introduce no families at all; their work is depth in families
that already exist. Each tranche should therefore cost less than the one before
— **but only if modules are authored to their cross-recipe ceilings**, which is
still an open decision from Tranche 1 and is the one worth settling before any
recording begins.

### Tranche 1 module status — the commissioning list

Every module `nervous_ready` needs, with the durations to author to. Taken from
[`content-authoring-brief-tranche-1.md`](./content-authoring-brief-tranche-1.md),
which carries the full authoring sheets, content rules and open decisions.

**Drafted, not approved.** All five load-bearing modules now have author-draft
wording and proposed technique keys in
[`nervous-ready-production-pack.md`](./nervous-ready-production-pack.md).
None is approved, none is recorded, and nothing has been imported. The six
depth modules have not been started.

| Module | Family | Target duration | Cross-recipe ceiling | Used by other recipes | Status |
|---|---|---|---|---|---|
| `nr_arrive_short` | `orient` | 20s or under | **≤21s** | yes — all five recipes open with `orient` | **DRAFTED** · key proposed · NOT APPROVED · not recorded |
| `nr_regulate_short` | `regulate` | 45s or under | **≤45s** | yes — 4 phases across recipes | **DRAFTED** · key proposed · NOT APPROVED · not recorded |
| `nr_reframe_short` | `reframe` | 40s or under | **≤40s** | yes — 5 phases | **DRAFTED** · key proposed · NOT APPROVED · not recorded |
| `nr_prepare_short` | `prepare` | 45s or under | **≤45s** | yes — 4 phases | **DRAFTED** · key proposed · NOT APPROVED · not recorded |
| `nr_close_short` | `close` | 11s or under | **≤11s** | yes — all five recipes close | **DRAFTED** · key proposed · NOT APPROVED · not recorded |
| `nr_regulate_long` | `regulate` | up to 254s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |
| `nr_ground_mid` | `ground` | up to 254s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |
| `nr_reframe_long` | `reframe` | up to 203s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |
| `nr_prepare_long` | `prepare` | up to 400s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |
| `nr_activate_mid` | `activate` | up to 400s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |
| `nr_focus_mid` | `focus` | up to 251s — REQUIRED | not stated for depth modules | yes | TO AUTHOR · TO DECIDE · NOT APPROVED · TO RECORD |

**The first five are the milestone.** Approved, recorded and imported, they make
`nervous_ready` compose and play at all four durations — ELSEA's first real
session. The other six change how a session feels, not whether it exists.

The cross-recipe ceilings are the durations to author to if one recording is to
serve every recipe. Authored instead to `nervous_ready`'s own looser limits
(22 / 71 / 54 / 57 / 16s) each module works in this recipe alone, and the other
four tranches need their own. **That is open decision 10 in the brief and it is
the one worth settling before recording starts**, because it cannot be corrected
afterwards without re-recording.

### The product-wide duration ceilings

Set by four different recipes, and not previously written down together. A
module intended to serve every recipe must fit the tightest slot anywhere:

| Family | Ceiling | Set by |
|---|---:|---|
| `close` / `sleep` | **11s** | `wired_sleep.close` |
| `orient` | **21s** | `flat_go.arrive` |
| `ground`, `reframe`, `focus`, `settle` | **40s** | various |
| `regulate`, `release`, `activate`, `prepare` | **45s** | various |
| `transition` | **55s** | `wound_up_home.leave_work_behind` |

A module written to a single recipe's looser limit works there and nowhere
else. It fails silently — nothing errors, it is simply never selected.

### Constraints each brief had to carry

- **`wired_sleep`** allocates its `close` phase **11 seconds**. Without a module
  that fits, the recipe has no five-minute session at all. The measured
  consequence: 7 distinct sessions in 30 simulated repeats, one module in every
  single one. Recorded as a content decision with the three supported options
  and no recommendation, because no approved freshness threshold exists.
- **`flat_go`** has the only single-family phase in the product (`wake_body`,
  `activate` only), and `activate` is eligible in three phases. That
  combination already broke composition at 300s once; the fix was a second
  short variant in `activate` and `prepare`, and both are marked load-bearing.
- **`scattered_focused`** can consume three distinct `focus` modules in one
  session, and holds the largest slot anywhere at 402s.

## 6d. The import pipeline, exercised

Run end to end on 2026-09-09 with a scratchpad fixture — synthetic test tones,
never in the repository, never written to production. It found two defects, one
of them serious.

### What it proved works

| Step | Result |
|---|---|
| Structural validation | 8 malformed manifests, all correctly rejected |
| Audio technical validation | 6 non-conforming files, all correctly rejected |
| Dry run | wrote nothing |
| `--commit` with no service-role key | refused, exit 2 |
| Invalid manifest | refused before touching anything |
| Library after all of it | still empty; `compose` still answers `library_empty` |

The eight structural cases: placeholder `technique_key`, unknown family, URL as
storage path, path under the wrong family, duplicate key, missing approval, bad
version, and an approved module with no audio file.

The six audio cases: stereo, 48kHz, −8.9 LUFS, −23.9 LUFS, 33kbps, and a
30-second file declared as 21.

### Defect 1 — a skipped check was reported as import-ready

Without `ffprobe`, the only thing known about a file is that it exists and is
not empty: **a text file renamed `.m4a` passed**, and the validator printed
"PASS — nothing blocking import". That contradicted its own principle that a
skipped check is never a pass.

The validator's exit code is now three-valued — `0` records valid and audio
either verified or never claimed, `1` records invalid, `2` records valid but
audio **not** verified — and the importer refuses `--commit` on `2` unless
`--allow-unverified-audio` is passed deliberately. A dry run still proceeds,
because it writes nothing.

### Defect 2 — the loudness check had never executed

Serious, and only findable by installing ffmpeg. Two bugs stacked:

1. `loudness()` read ffmpeg's stderr only inside a `catch`, but
   `ffmpeg -f null -` **succeeds** — so the success path returned null
   unconditionally and the catch never ran.
2. After fixing that it still failed: the parser sliced from the opening brace
   to the end of stderr, and ffmpeg writes progress lines after the JSON
   summary, so `JSON.parse` threw — swallowed by the same catch and surfaced as
   "could not be measured", indistinguishable from ffmpeg being absent.

**Consequence: the −16 LUFS and −1 dBTP limits had never been enforced on
anything and could not have been.** Every other audio check was working.

It failed honestly rather than silently — the validator always said *skipped*,
never *passed* — which is the only reason it was survivable. Had it claimed a
pass, a tranche could have been recorded at the wrong level and the fault found
only on a device, after the studio time was spent.

### Still unexercised

Upload to the private bucket, the module row insert, version-row writing,
composer selection with approved content, and manifest persistence. **All five
need a service-role key, which is not available on this machine.** They remain
the untested part of the path.

### Environment requirement

**`ffmpeg` is now required to import.** Installed here on 2026-09-09 (Gyan
build 9.0.1, via winget). It is on the user PATH but a shell must be restarted
to see it. Without it the importer refuses to commit.

## 6e. The V1 sound layer

Three reusable stereo assets that sit around the spoken modules: an ambient
bed, one spatial movement, one centred resolve. Prototype sound design, not
intervention content.

### The three assets

| Asset | Length | What it does |
|---|---:|---|
| `nervous_ready_bed_v1.m4a` | 20s | Ambient bed. Loops under the whole session. |
| `spatial_sweep_soft_v1.m4a` | 4s | Moves LEFT → CENTRE → RIGHT → CENTRE → LEFT. |
| `centre_resolve_soft_v1.m4a` | 2s | Centred, does not move. Plays as the session ends. |

All three: AAC, 44.1 kHz, **stereo**, ~64 kbps, mastered to **−26 LUFS** — ten
decibels under the voice reference of −16, so the layer is present without
competing. Measured, not assumed: the generator prints codec, rate, channels,
bitrate, loudness and true peak for each, and reports any check it could not
run as SKIPPED rather than folding it into a pass.

Movement verified by measuring the two channels separately across the sweep:
**+20 dB left-biased** at 0.4s, crossing centre near 1.7s, **−39 dB** (right)
at 2.8s, returning. The resolve measures **0.00 dB** difference between
channels — centred by construction.

### How they are produced

`node scripts/generate-sound-assets.mjs [--force]`, deterministically, from
ffmpeg synthesis primitives. There is no master to lose and no DAW in the loop:
delete the files and run it again.

They live in **`assets/audio/sound-design/`** and are bundled with the app.

### Why the movement is baked in

There is no runtime panning anywhere in this project and none was added. That
would mean a DSP layer, a native dependency and a per-frame budget in the
middle of a session. The pan is rendered into a stereo file offline; the device
starts a file and stops a file.

### Overlay, never timeline

**The sound layer cannot change what a session is.** `buildTimeline` takes a
manifest and nothing else — the layer is not one of its inputs and cannot
become one. Sweeps and the resolve play on their own player, fire-and-forget,
and nothing reads back from it: not `elapsed`, not `cueIndex`, not completion.
A sweep still sounding when the session ends is cut with it, exactly as the bed
is.

All twenty recipe/duration cases still finish at exactly 300 / 600 / 900 /
1200 seconds, asserted with the layer in place.

### Where sweeps fall

At **most two per session**, on phase boundaries only: the first boundary
(leaving `arrive`) and the middle one. Never the last — movement immediately
before a centred resolve reads as a mistake rather than an ending. A sweep at
every boundary would be six in a long session, which stops being a transition
and becomes a mannerism.

That placement is a **two-line rule, not a sequencing engine**, and it is an
engineering default: which boundaries are *right* is a sound-design judgement
nobody has made.

### Fallback

Each layer is independently optional and separately guarded:

```
voice + bed + spatial  →  voice + bed  →  voice only
```

A missing or failing asset resolves to null and is skipped. **A sound-design
failure never sends a session back to the silent catalogue** — that fallback
turns on the composition failing, which is a different thing entirely. The
session screen has no knowledge of the sound layer and cannot fall back because
of one.

A bed carried by an approved manifest outranks the bundled one; the bundled bed
is the fallback for a recipe that has none, which today is every recipe.

### Headphones

Not required and not detected. Stereo is naturally stronger on headphones and
the session remains usable on a speaker.

### No claims

The carrier tones are **engineering parameters**: 110 Hz and its octave for the
bed, chosen because they are low, unobtrusive and divide exactly into 20
seconds so the loop has no seam. Nothing here treats, entrains or affects
anyone, and nothing in the product may say otherwise. A test forbids the
tokens that could only appear as a claim.

### The boundary against intervention content

The layer has three URI fields and nothing else — no `technique_key`, no
approval flag, no clinical meaning, and no field for anything a person typed.
It never enters the intervention module table or the private bucket, and the
importer and composer have no knowledge of it.

> The existing client-source guard in `approval-gate.test.ts` forbids the
> private bucket's literal name anywhere under `src/`, comments included. That
> guard caught this work during the pass — a disclaimer in `sound-layer.ts`
> named the bucket in order to say it was not used. The comment was reworded
> rather than the guard weakened.

### What is proven, and what is not

**Proven:** the assets exist, regenerate deterministically, and measure as
specified; the pan is real and measured; duration is unaffected across all
twenty cases; every layer stops together on pause, unmount and early exit;
absent assets degrade to voice-only. 73 tests.

**NOT proven — and cannot be yet.** The sound layer lives in
`use-manifest-player.ts`, which runs only when a manifest exists. The composer
returns `library_empty`, so `session.tsx` passes it null and the catalogue path
plays instead. **The sound layer has never been heard in the app, on any
device, and cannot be until approved content lands.** An emulator is attached
but is not a surface on which stereo movement through headphones can be
demonstrated.

Prototype, not production-ready: `SWEEP_GAIN`, `RESOLVE_GAIN`, the −26 LUFS
target, the carrier tones and the two-sweep placement are all engineering
defaults awaiting a sound-design judgement.

## 6f. The first production content pack

The five load-bearing `nervous_ready` modules have author-draft wording.
[`nervous-ready-production-pack.md`](./nervous-ready-production-pack.md) carries
the scripts, delivery directions and per-module status;
`content/nervous-ready-tranche-1.draft.json` is the manifest in the exact schema
the validator and importer expect.

| | |
|---|---|
| Modules | 5 |
| Author status | DRAFT COMPLETE |
| Product + content approval | **APPROVED** — product owner / content owner, 2026-09-09, as general wellbeing content |
| Clinical review | **NOT CLAIMED** — not required for this content class under S4 as amended |
| `technique_key` | **proposed**, five of five — none clinically confirmed |
| Recording | **NOT RECORDED** |
| `approved` | **false**, five of five — the flag gates playback, not review; it flips at import once audio exists |
| Structural validation | PASS (records only — no audio to check) |
| Import | dry run only; nothing written, nothing uploaded |

### The duration finding, and two cuts

Estimating speaking time against each ceiling caught one script that could not
be delivered: `nr_regulate_short` asked for **three extended-exhale cycles**,
and those cycles are the technique — each needs roughly eight seconds of real
silence, not merely words spoken.

| | Words | Cycles | @130wpm | @110wpm | |
|---|---:|---:|---:|---:|---|
| As first drafted | 70 | 3 | 56.3s | 62.2s | over |
| After cutting the third cycle | 67 | 2 | 46.9s | 52.5s | still over |
| After cutting the closing sentences | 44 | 2 | **36.3s** | **40.0s** | fits |

Both cuts were content decisions, made by the user and applied here.

It took two because they remove different things: a breath cycle is eight
seconds of silence but only three words, while the closing sentences are 23
words and no silence. The first cut took out the larger single component and
still left the module over, because the words were the rest of it.

**All five scripts now fit.** `nr_close_short` fits at 8–10s against 11, with
under three seconds of headroom — worth timing in the booth.

These are estimates at 130 and 110 words per minute, not measurements. The real
number comes from recording, and `duration_seconds` must be updated to it.

### Two fields deliberately not filled

**`intensity`** is omitted from the manifest: it is clinical, the scale is
undefined anywhere in the system, and inventing a number would fabricate a
clinical value. **The importer defaults an absent value to `5`**, which would
land in the database looking like a judgement — so either supply real values
before import or defer deliberately, knowing what gets written.

**`duration_seconds`** currently holds each module's *ceiling* rather than a
measured length. It is the only honest value available before recording and is
wrong the moment audio exists; the validator's 0.25s tolerance will reject it,
which is the correct outcome.

## 6g. Narration voices

> Written when there were two. There are now **three** product profiles —
> `warm`, `clear` and `bright` — of which `bright` is inactive until it has a
> provider binding. See §6i for the multilingual pass that added it.

V1 offers a person a choice of two voices, `warm` and `clear`. Internal product
labels, not descriptions of a person and not gender classifications; the display
label is all anyone sees.

### The shape

    module  +  version  +  voice profile  =  one audio rendition

A module's identity is its technique, its wording and its approval. None of that
changes because a different person read it aloud, so **a second voice must not
create a second module** — that would fork effectiveness data, double the
library, and leave two rows to keep in step by hand.

`module_renditions` carries only what is true of a particular recording: its
storage path, its length and whether that take is approved.
`intervention_modules.storage_path` is deprecated by the migration and made
nullable; nothing reads it. Nothing was migrated because the library is empty.

### Both approvals must hold

The module's `approved` says the content is approved. The rendition's says this
recording of it is. A bad take of approved wording is not playable, and
approving a module does not bless every future recording of it.

### Selection is unchanged

The composer chooses modules **first**, on their own merits, and only then picks
which recording of each to play. It plans with the module's canonical duration,
so the same techniques are chosen whichever voice is playing — the voice changes
how a session sounds, never what it contains.

Falls back **per module** to the default voice, so a library where only some
modules exist in `clear` still composes: those play warm rather than dropping
out. A module with no approved rendition in either voice is removed before
selection, never substituted.

### The preference

`user_preferences`, own-row RLS, defaulting to `warm`. A saved preference beats
whatever the client sends — a stale client must not override what somebody
chose. Nothing joins to it except audio resolution, so changing voice cannot
disturb session history, module identity, effectiveness or recipe selection.

Chosen on the existing Audio preferences screen, which was built as a routed
shell for exactly this. Functional only; no design pass.

### RLS

`voice_profiles` is readable — two labels, visible in the app the moment the
picker opens. `module_renditions` is service-role only, because storage paths
are the same class of IP as the recipes. Verified live: anon reads renditions as
`[]`, and an anon write to `user_preferences` returns 401.

### Recording

Two folders, `audio-source/warm/` and `audio-source/clear/`, the same five
approved scripts in each, and `prepare-voice-masters.mjs --voice <id>`. The
audio specification and the duration ceilings are unchanged and identical
across voices.

**Not proven on device**, like everything downstream of the composer: no
renditions exist, so nothing has ever resolved one.

## 6h. ElevenLabs, behind the provider boundary

Wired as the first TTS provider. **Not proven live yet** — see below.

| | |
|---|---|
| Adapter | `_shared/elevenlabs.ts`, implements the existing `VoiceProvider` |
| Provider abstraction | **intact** — no parallel system was created |
| Configuration | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, Edge Function secrets only |
| Model source | the configured secret; no model id appears in code |
| Live generation | **NOT RUN** — needs the service-role key |
| Cache | uses the existing `generated_segments` model; nothing new invented |
| Storage | private bucket, path derived from the cache key |
| Budget | unchanged, enforced before any provider call |
| Cost telemetry | usage quantities recorded; **CURRENT PRICING ENTRY REQUIRED** |

### The boundary held

Everything vendor-specific — endpoint, header, request body, audio format,
failure mapping — is confined to the adapter. `compose.ts`, `speech.ts`,
`allocate.ts` and the composer contain no reference to ElevenLabs, asserted by
test. So does the client bundle.

Configuration comes only from the environment. A model id in code would make
changing model a code change and would put a vendor's vocabulary into ELSEA's
domain.

### Raw text still cannot reach a provider

Structurally, not by convention. `SynthesisRequest` has no field for user text
and the cache key is built entirely from structured state — `speechCacheKey`
throws on an unsafe context tag rather than sanitising it, so a malformed tag
fails closed instead of producing a key.

The storage path is derived from that cache key, so nothing typed can reach a
path either. And **the adapter never reads the provider's error body**: a real
TTS error can quote the submitted text back, which would put speech content in
a log by accident. Only the status is used.

### The budget is still the gate

Unchanged: 30s normal, 45s ceiling, checked before a paid call. A test drives
an over-ceiling verdict and asserts **the provider was never called** — the
failure mode that matters is an invoice, not an exception.

### The integration check

`functions/voice-check` proves the chain end to end and is deliberately hard to
abuse: it **takes no input** (the phrase is compiled in), requires the **service
role key**, writes to a separate `checks/` prefix, and signs for five minutes.
Verified live: the anon key gets `forbidden`, a GET gets `method_not_allowed`.

It writes no `generated_segments` row. That table is keyed on structured state
and an engineering phrase has none; inventing a context so a test could be
cached would put a test string in the cache real sessions read from.

### What is still outstanding

**The one live generation has not run.** It needs the service-role key, which is
not available in this environment. Everything either side of the call is
deployed and verified.

**Pricing is unconfigured.** `provider_pricing` has no ElevenLabs row, so
monetary cost cannot be computed. Usage quantities — characters, cache
hit/miss, segment count, model — are recorded regardless. **CURRENT PRICING
ENTRY REQUIRED.** No price was invented.

## 6i. Multilingual-ready, and a third voice

**MULTILINGUAL-READY, NOT MULTILINGUAL.** The model can hold more than one
language. **No translated content exists**, none was created, and English is the
only content-ready locale. A schema that can represent a language is not a
language the product supports.

### The four things that are not the same thing

    module identity     the intervention concept. One row, forever.
    localised content   the approved wording in one language, versioned.
    voice profile       a presentation choice.
    audio rendition     one recording of one localised version in one voice.

    module + locale + version            = one approved localised script
    that + voice profile                 = one audio rendition

`intervention_module_versions` already **was** the content artifact — immutable,
versioned, approvable, withdrawable. It needed a locale, not a competing system
beside it. That is why no second version model exists.

### Languages

| Locale | Label | Enabled | Content-ready |
|---|---|---|---|
| `en` | English | yes | **yes** |
| `es` | Español | no | no |
| `de` | Deutsch | no | no |
| `fr` | Français | no | no |
| `pt-BR` | Português (Brasil) | no | no |

Two flags, deliberately separate: `is_enabled` is product intention,
`is_content_ready` is whether a complete approved library actually exists.
Conflating them is how a language gets offered before it can be delivered. Only
a content-ready locale can be composed from.

### Voice falls back. Language never does.

A missing rendition in the requested voice resolves to the default voice
**within the same language**. A missing language resolves to nothing:
`compose` returns **`locale_unavailable`**, a distinct failure from
`library_empty`, so the caller learns the language is unavailable rather than
that ELSEA is broken.

Enforced three ways, because a mixed-language session would be a worse failure
than no session and nobody would report it as a bug: the locale is resolved
before any rendition is read; the rendition query filters on it; and the result
is filtered again in memory so a future refactor of that query cannot break it.

Verified live: `es` returns `locale_unavailable`, not English.

### The third voice

`bright` exists as a product profile and is **not active**. It has no provider
binding, and a voice offered before it can resolve to audio produces a session
somebody cannot hear. `warm` and `clear` are unchanged.

Activating it is a **data action, not a migration**: map a provider voice, add
renditions, then set `is_active`.

### Provider mapping

`provider_voice_mappings` (voice profile × locale × provider) replaces
`ELEVENLABS_VOICE_ID` as the architecture — a single environment variable can
bootstrap one voice but cannot express three profiles across five languages.
**Service-role only, no policy**: a provider's voice id is commercial
information the client has no reason to hold.

A person's saved preference is an ELSEA profile such as `warm`. The provider is
resolved server-side, so switching vendor is a data change.

`available_voices` is a readable view exposing labels only — no provider name,
no voice id. It is currently empty, because nothing is mapped.

### What did not change

Module identity does not fork by language or by voice. Effectiveness is not
split by either — doing so would fragment a person's history the first time
they changed one. Recipes, canonical targets, families, duration ceilings and
the audio production specification are untouched. Fingerprints carry module and
version, never a voice or a provider.

## 6j. Master generation — the operator path

Producing a reusable intervention master from approved content, with the
ElevenLabs key never leaving Supabase. **No master has been generated.**

### It is two halves, and the split is where the constraint is

`functions/generate-master` holds the provider key and produces raw audio into
`staging/`. `scripts/finalise-master.mjs` converts it to specification, measures
it and writes the rendition.

The split is not a preference. Meeting the audio specification means measuring
and re-encoding, which means **ffmpeg — which cannot run in a Deno Edge
Function.** So each half does the part only it can: the function does what
requires the key, the script does what requires ffmpeg. **The finalise step
needs no ElevenLabs key**, which is the property that motivated building this.

The alternative was storing an unconverted MP3 and calling it a master. It
would have failed the validator later, or passed on a machine without ffmpeg
and shipped.

### Arbitrary text cannot be spoken

The request carries **identifiers only** — module key, locale, voice profile,
optional version. There is no `text` parameter and nowhere to put one. The
server fetches the approved wording from the database.

> **A gap this exposed.** The approved wording was not stored anywhere — it
> existed only in a markdown pack. Survivable while a person reads from the
> pack; not survivable once a server generates the audio, because an endpoint
> that accepts text and speaks it can say anything.
> `intervention_module_versions.script_text` now holds it, on the row that
> already carried every other fact about approved localised content. Nullable
> rather than backfilled, because inventing approved content is the one thing
> that must not happen.

### Everything fails closed

Unknown or inactive module · unknown, withdrawn or unapproved version · locale
mismatch · locale not content-ready · unknown or inactive voice profile ·
**missing provider mapping**. An unmapped voice is never rendered in another
one — there is no fallback voice list in this function at all.

Approval is checked **before** the provider is reached, and again by the
finalise step, because content can be withdrawn between rendering and
publishing.

### Voice resolution

The operator names an ELSEA profile — `warm`, `clear`, `bright`. A provider
voice id is never sent in a request, never copied into a command, and never
returned. `provider_voice_mappings` resolves it server-side.
`ELEVENLABS_VOICE_ID` remains only the bootstrap setting for `voice-check`.

### Synthesis is not approval

The function writes **no rendition**. The finalise step writes one with
`approved = false` and says so out loud. A successful render is not a decision
that the recording is good enough for somebody to hear.

### Not session TTS

A master is produced once and reused by everyone. It writes no
`generated_segments` row, attaches to no user or session, and **does not touch
the 30s/45s dynamic budget** — that governs speech generated *during* a
session. The dynamic path is untouched.

### The operator workflow

One module, one locale, one voice. Bulk generation is deliberately not offered:
it is much easier to spend money by accident with a loop.

```bash
# 1. render  (key stays in Supabase)
curl -X POST "$SUPABASE_URL/functions/v1/generate-master"   -H "Authorization: Bearer $SERVICE_ROLE_KEY"   -H "Content-Type: application/json"   -d '{"module_key":"nr_arrive_short","locale":"en","voice_profile":"warm"}'

# 2. convert, measure, publish  (needs ffmpeg, not the provider key)
SUPABASE_SERVICE_ROLE_KEY=... node scripts/finalise-master.mjs   --module nr_arrive_short --locale en --voice warm --commit

# 3. listen, then approve the rendition by hand
```

Verified live: the anon key gets `forbidden`, a GET gets
`method_not_allowed`.

### The order this has to happen in

Not obvious, and easy to get wrong — mapping the voices first looks like the
natural first step and would fail immediately.

| # | Step | Blocked on | Fails with if skipped |
|---:|---|---|---|
| 1 | ~~Load the scripts into `script_text`~~ **done** | — | — |
| 2 | ~~Import the five modules + `en` versions~~ **reported done, unverified** — see §6k | — | — |

**Step 2 is READY TO COMMIT.** Integrity checked programmatically on
2026-09-10 — all five `script_text` values match the approved pack exactly, by
SHA-256, at 190 / 248 / 335 / 381 / 99 characters. Records-only validation
passes and the dry run plans exactly 5 module rows, 5 `en` version rows and
**0 renditions**. Only the service-role key is missing.

Step 2 writes module rows and version rows carrying the approved scripts, and
**no renditions** — a rendition is a recording, and none exists yet. That also
keeps "which modules have been recorded?" answerable, which placeholder rows
would have destroyed.

| 3 | ~~Map three ElevenLabs voices~~ **decided 2026-09-10; write unconfirmed** — §6l | — | — |
| 4 | Generate one master | steps 1–3 | — |
| 5 | Finalise: convert, measure, publish unapproved | ffmpeg locally | — |
| 6 | Listen, then approve the rendition | a human | rendition never plays |
| 7 | Approve the module for playback | a human | `library_empty` |

**Steps 1 and 2 come before 3.** The generator resolves a module before it
resolves a voice, so an unmapped voice is not even the first thing that fails
today — `unknown_module` is, because nothing has been imported.

**Step 1 is done.** The five approved scripts now live in
`content/nervous-ready-tranche-1.draft.json` as `script_text`, and the importer
writes them onto the version rows. They were extracted from the production pack
programmatically rather than retyped — a transcription slip in approved content
would be silent, and the character counts (190, 248, 335, 381, 99) independently
match what the ElevenLabs generator computes from its own copy.

The validator now **requires** `script_text` and rejects a placeholder, so a
manifest cannot be imported with wording missing. The importer refuses to write
a version row with no script: a version nothing can speak would sit in the
database looking approved.

### Status

**No masters generated. No provider called.** The path is deployed and
unit-proven, and blocked on one thing: **no provider voice mappings exist**, so
every generation would fail `no_provider_mapping`. Choosing the three ElevenLabs
voices is a casting decision.

## 6k. The content import — reported done, not verified here

The five `nervous_ready` modules were imported by the product owner on
2026-09-10, run locally with a service-role key.

**This session could not verify it, and did not.** The content tables are
service-role only and the key is deliberately absent from this environment, so
anon reads return `[]` — which is what they return whether the import wrote five
rows or none. Reporting that as the live state would be reporting a permission
denial as data.

Verification output was requested twice and lost in transit both times. It is
outstanding.

### What was checked before the import, and passed

- **Script integrity, by SHA-256.** All five `script_text` values matched the
  approved production pack exactly, at 190 / 248 / 335 / 381 / 99 characters.
  Programmatic, because a transcription slip in approved content is silent.
- **Records-only validation** — exit 0, with audio checks not run and not
  claimed.
- **Dry run** — 5 module rows, 5 `en` version rows, **0 renditions**, 0 approved.

### What is known from outside the boundary

`compose` returns **`library_empty`** at 300 / 600 / 1200 seconds. That proves
**no module passes `approved = true AND is_active = true`** — which is correct
at this stage, content being approved and audio not existing.

It does **not** confirm the row count: an empty table and five unapproved rows
produce the identical answer. So the import is recorded here as *reported
complete*, not as verified.

### To close it

Run the read-only block against the live database with the key set, and check:
five module keys with `approved false` / `is_active true`; five `en` versions
with `approved_at` set and `withdrawn_at` null; `script_chars` of
190 / 248 / 335 / 381 / 99; zero renditions; zero provider mappings.

## 6l. Voice casting — decided, mapping pending confirmation

**The casting decision was made by the product owner on 2026-09-10.** Three
ElevenLabs voices were chosen and supplied for `warm`, `clear` and `bright`, all
`locale = en`, `provider = elevenlabs`.

### The voice ids are deliberately not in this repository

They were supplied for direct insertion into `provider_voice_mappings` and are
**not recorded here, not in a migration, and not in any committed file**. A
migration would have been the obvious place and would have put them in source
control, which is the one thing the instruction ruled out. They live in the
database and nowhere else.

They are provider identifiers rather than API secrets, but the reasoning that
made the mapping table service-role only applies to them too: publishing which
vendor ELSEA uses and which of their voices is commercial information with no
product reason to be public.

### What was done, and what was not

An operator PowerShell block was written to upsert the three rows against the
applied schema — `voice_profile`, `locale`, `provider`, `provider_voice_id`,
`is_active`, with the composite primary key `(voice_profile, locale, provider)`
as the conflict target, so a re-run updates rather than duplicating.

**Execution is unconfirmed.** The service-role key is deliberately absent from
the assistant's environment, so the write could not be performed or verified
here. As with §6k, this is recorded as decided-and-issued rather than done.

### `bright` is mapped and still not selectable

This is the intended behaviour and it needed no change. `available_voices`
requires the profile to be `is_active`, and `bright` is `false` until a
recording exists. **A provider mapping alone does not make a voice offerable** —
mapping says a vendor voice can render it; `is_active` says a person may choose
it. Nothing in the block touches `voice_profiles.is_active`.

Activating it later remains a data action:

```sql
update voice_profiles set is_active = true where id = 'bright';
```

after renditions exist and have been approved.

### Unchanged by this step

No renditions created. No audio generated. No ElevenLabs call made. No content
approved or activated. `ELEVENLABS_API_KEY` and `ELEVENLABS_MODEL_ID` untouched.
Nothing added to `user_preferences`, which holds an ELSEA profile and never a
provider identity.

## 7. Known gaps

Stated plainly so none is mistaken for finished work.

- **No audio content and no approved modules.** `intervention_modules` is
  empty. Every session runs on the catalogue fallback, silent, which the UI
  states. This is the blocker.
- **Manifest persistence is atomic but still unexercised.** It now writes
  through a `security definer` RPC so a manifest and its segments land
  together or not at all. The rows are checked against the real schema
  constraints and the rollback path is pinned, but **no INSERT has ever
  run** — that needs an approved module with real audio, and inventing one
  is precisely what must not happen. Watch it the first time content lands.
- **Nothing writes `session_costs`.** The manifest link and every column exist;
  the row does not, because there is no generation to cost. Needs a TTS
  provider.
- **ElevenLabs is wired but has never been called live.** The adapter exists
  behind the provider boundary and is unit-proven; no real request has been
  made, because `voice-check` requires the service-role key. No dynamic speech
  is generated in a session, so sessions still bill nothing. See §6h.
- **Edge Function typechecking is real but partial.** `npm run
  typecheck:functions` checks the functions' own logic — imports resolve, names
  exist, types line up — using hand-written ambient stubs in
  `supabase/functions/deno-ambient.d.ts`. It does NOT verify calls against the
  real supabase-js signatures, because there is no `deno` here and tsc cannot
  resolve a `jsr:` specifier. Do not read a clean run as full Deno type safety.
- **Novelty records but does not act.** The composer now computes a manifest
  fingerprint and persists it, so a freshness policy will have a history to
  read when one is decided. It applies **no** recency: it imports no policy
  constant, reads no prior fingerprints, and deprioritises nothing, and
  `schema-reachability.test.ts` asserts each of those. Activating it is
  blocked on two product decisions — the recency window, and how novelty
  weighs against measured effectiveness.
- **`_shared/replay.ts` is unreachable from the product.** Exact replay and
  reuse-intent are written and tested, but nothing saves a session, so there
  is nothing to replay. `saved_sessions` has no writer for the same reason.
  Whether the saved/replay journey is in V1 is a scope decision that has not
  been made, and a writer was not invented for it.
- **`wired_sleep` has a content variety problem, not a code problem.** Over 30
  simulated repeat sessions it produced 7 distinct compositions, and
  `sleep_10s` appeared in **all 30**, because it is the only module short
  enough for that recipe's 11-second `close`. No novelty weighting can vary a
  slot with one candidate. Flagged as **CONTENT INVENTORY EXPANSION DECISION
  REQUIRED**; modules were deliberately not invented to improve the number.
  For comparison: `nervous_ready` produced 30 distinct compositions from 30.
- **Edge fades, not crossfades.** A true crossfade overlaps cues and would make
  playback finish before the composed duration. Deferred to the design pass.
- **`FADE_SECONDS`, `BED_GAIN`, `BED_GAIN_DUCKED` are engineering defaults**,
  not approved production values.

## 8. What is needed next, and from whom

Engineering has taken this as far as it legitimately can without content.

**From content and clinical — the blocker:**

1. **The five load-bearing `nervous_ready` modules first** — not all 47. They
   are what makes a real session exist at all; see §8c. The full 47 are in
   [`module-inventory-v1.md`](./module-inventory-v1.md), and each needs
   technique, wording, delivery and a `technique_key`.
2. `intensity` semantics — the column is 1–10 and read by nothing; what a 3
   means versus an 8 is undefined.
3. ~~Audio format~~ — **resolved.** Specified in
   [`audio-production-spec.md`](./audio-production-spec.md) and enforced by
   the validator: AAC-LC in `.m4a`, 44.1kHz mono, 96kbps, −16 LUFS ±1,
   −1 dBTP, ≤100ms head and tail silence, no baked-in fades.
4. Whether 20–30% silence in a five-minute session is acceptable. If not, the
   answer is more short modules.
5. Whether `wired_sleep` gets more short `close` modules, or whether one
   repeated closing module is acceptable there.

**From product — blocking the novelty wiring:**

1. How many sessions, or how long, counts as "recent".
2. How novelty should weigh against measured effectiveness. The current
   defaults are placeholders chosen so the mechanism could be simulated; they
   are not findings, and `novelty-simulation.test.ts` exists so the call can be
   made from evidence.
3. Whether the freshness in §7 is acceptable for someone using this daily.

**From design:** the screen pass. The two questions from the device walk were
examined during the functional completion pass and **neither is a defect**:

- A chip on its own routes to the correction screen because a chip carries no
  free text for the safety gate to read, so there is nothing to interpret and
  the person picks instead. The journey completes; `/time` guards on the
  interpretation, not on the safety flag, so there is no dead end. Whether
  that screen should be *presented* as a correction is a design question.
- Someone arriving `tired_wired` sees one enabled target because the approved
  transition map contains exactly one route from that state. Showing five
  dimmed cards is a presentation choice, not a functional fault.

**From engineering, once content exists:** validate and import the manifest,
upload masters to the private bucket, set `approved`, watch manifest
persistence execute for the first time, wire novelty into the composer once
the weightings above are decided, then the dynamic speech layer when a
provider is chosen.

**Two environment prerequisites, neither of them optional:**

- **`ffmpeg` and `ffprobe` on the importing machine.** Installed here on
  2026-09-09 (Gyan 9.0.1, via winget), but on the user PATH — a shell must be
  restarted to see it. Without them the importer refuses to commit.
- **A service-role key**, supplied in the environment for that one command
  and never added to `.env`. Not available on this machine, which is why
  upload, insert, version rows, composer selection and persistence are still
  unexercised.

## 8b. Functional completion status

**NOT FUNCTIONALLY COMPLETE.** One thing prevents it, and it is not code.

The definition agreed for this pass requires a real person to reach a real
composed session and **hear approved audio**. `intervention_modules` is empty,
so the composer returns `library_empty` and every session falls back to the
silent catalogue path. A silent fallback does not count, a test fixture is not
production content, and neither is treated as though it were.

**Has the real session engine ever played an approved audio composition
on-device? No.** It has never played any audio at all, because none exists.

### What is genuinely working

Verified by execution, not by the presence of code: the safety gate and its
fail-closed behaviour; the flow graph and its route guards; the deployed
composer's three failure paths; the recipe and module lockdown under RLS; the
private audio bucket; the catalogue fallback end to end on a device, including
pause; and the twenty recipe/duration composition cases through the real
allocator.

### What is built but unexercised

Manifest persistence has never executed — it needs an approved module. The
multi-segment player has never played a real manifest, for the same reason.
The importer has never run against real content. The fingerprint path is
deployed and its migration applied, but no fingerprint has been written yet:
that needs a manifest, which needs an approved module.

### The engine/audio distinction

**ENGINE PROVEN** — all 20 recipe/duration cases compose through the real
allocator, with no repeated module in any manifest.

**REAL AUDIO PLAYBACK PROVEN** — no. Cannot be marked until approved content
exists. These two are tracked separately on purpose: the first is an
engineering result and is finished; the second is a content result and has not
started.

## 8c. The critical path — the single next action

Everything else in §8 is real, but only one thing moves ELSEA toward a playable
session. Stated here so it is not lost among the rest.

> **Get the five drafted `nervous_ready` scripts through content and clinical
> review, then recorded.**
>
> Drafting is done — see §6f. What stands between here and a real session is
> now review, approval and a recording session, none of which is engineering.

| Module | Family | Duration | Why this length |
|---|---|---:|---|
| `nr_arrive_short` | `orient` | **≤21s** | tightest `arrive` slot in the product (`flat_go`) |
| `nr_regulate_short` | `regulate` | **≤45s** | tightest `regulate` slot anywhere |
| `nr_reframe_short` | `reframe` | **≤40s** | tightest `reframe` slot anywhere |
| `nr_prepare_short` | `prepare` | **≤45s** | tightest `prepare` slot anywhere |
| `nr_close_short` | `close` | **≤11s** | `wired_sleep.close` — the hardest constraint in the product |

Each still needs a **confirmed** `technique_key` from clinical (five are
proposed, none confirmed), an explicit `approved: true`, and audio to the spec
in §5, delivered as `<module_key>.m4a`. All five drafts fit these ceilings on
estimate; the measured lengths replace `duration_seconds` at import.

**Why five and not eleven, or forty-seven.** Removing any one of these five
makes a five-minute session fail with `phase_unfilled` — all five are
load-bearing. The other six in the tranche change how a session *feels*, not
whether it exists. Five is the smallest package that produces a real playable
session.

**Why the cross-recipe durations.** Shorter always works; longer never does. At
21/45/40/45/11 these five serve **all five recipes**. At `nervous_ready`'s own
limits (22/71/54/57/16) they serve one, and the other four tranches each need
their own. Same recording session, roughly four times the coverage — and the
choice cannot be corrected afterwards without re-recording.

**The eleven-second close is the one to sanity-check before booking studio
time.** If a closing thought cannot land in 11 seconds, that is a genuine
finding to raise. It must not be solved by overrunning: a 12-second module
silently removes the five-minute session from `wired_sleep`.

### Then, in order

1. ~~Content review, clinical review~~ — **done 2026-09-09.** Approved by the
   product owner as general wellbeing content under S4 as amended. Technique
   keys remain proposed and `intensity` is still open; neither blocks
   recording.
2. ~~Approval~~ — **granted.** The `approved` flag flips at import, once audio
   exists.
3. Record to the audio specification; update `duration_seconds` to the measured
   lengths and set `approved` true for what passed.
4. Validate the manifest with `--audio-dir` — `ffmpeg` required, see §8.
5. Dry-run the import, read the plan.
6. Commit the import with a service-role key: uploads audio, writes module rows
   and their immutable version rows.
7. **First real composition** — the composer selects approved modules for the
   first time.
8. **First manifest persisted** — never executed before.
9. **First real session played on-device**, and with it pause, resume, early
   exit, timing, outcome, and the sound layer, against real audio.
10. Resolve whatever that surfaces, then FUNCTIONALLY COMPLETE can be declared.

Steps 7 to 9 are the untested stretch. Everything before them has now been
exercised; see §6d. Step 9 is also the first time the sound layer will be heard
at all — it lives in the manifest player, which is dormant until a manifest
exists (§6e).

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
node scripts/modules-validate.mjs FILE  # check a content manifest
node scripts/modules-import.mjs FILE    # dry run; needs a flag to write
node scripts/generate-sound-assets.mjs  # rebuild the sound layer
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
