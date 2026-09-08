# ELSEA Session Engine — architecture of record

Status: **locked**. Supersedes the composition parts of the earlier catalogue
model. Changes to anything in "The eight rules" require explicit re-approval
(S16), and `src/__tests__/session-engine.test.ts` fails if code drifts from them.

## The fundamental rule

> ELSEA generates the **decision**, not the **session**.

AI works out what someone needs. ELSEA assembles the experience from a library.
Only a small, bounded part is uniquely generated for that person at that moment.

## The eight rules

1. Unlimited sessions for the customer.
2. Sessions are dynamically **composed**, never wholly generated or stored whole.
3. AI interpretation produces **structured state**, not freeform therapy.
4. Dynamic TTS normally **≤30s per session**; hard ceiling 45s.
5. Reusable audio assets served from storage/CDN, generated or produced once.
6. Client-side composition from a **manifest**.
7. Voice provider abstracted; never hard-wired to one vendor.
8. Personalisation comes primarily from **effectiveness data**, not bigger prompts.

## Why this is the economic heart

Marginal cost per session is dominated by dynamic TTS. Everything else —
library audio, interpretation, CDN — is either a one-off or rounding.

At a 400-character dynamic budget (~30s of calm delivery at ~130wpm), a
90-session month costs roughly $0.5–$1.9 in TTS depending on provider, against
~$0.01 of interpretation and ~$0.04 of egress. So:

- Rule 4 is the highest-leverage control in the product. It is enforced in code
  and tested, not left to prompt discipline.
- Rule 7 matters because TTS is ~97% of marginal cost, so a provider switch is
  the largest single lever available.
- **Regeneration is the hidden cost.** TTS bills on characters *submitted*,
  including output later discarded. A retried session that re-generates its
  opening pays twice. The cache is therefore write-through and keyed
  deterministically *before* playback, so retries and replays are free.

Vendor prices in any planning document go stale. The engine records
`character_count` and `provider` on every generated segment so actual spend is
measurable from data rather than estimated from a spreadsheet.

## The pipeline

```
free text / shortcut
  -> SAFETY GATE            server-side, fail closed   (functions/interpret)
  -> INTERPRETATION         structured state only
  -> DECISION ENGINE        five canonical recipes     (functions/compose)
  -> PERSONALISATION        effectiveness data
  -> BUDGET                 enforced where the provider can be called
  -> SESSION MANIFEST       references + resolved paths + budget audit
  -> CLIENT PLAYS           sequencing, beds, ducking, fades, silence
```

## Data model

| Table | Purpose |
|---|---|
| `intervention_modules` | The library. Reusable, owned by no session. |
| `recipe_phase_families` | Which module families a phase accepts. The V1 eligibility mechanism. |
| `recipe_phases` | Phase structure per transition, with duration floors. |
| `module_effectiveness` | Per-person, per-module outcome tally (Rule 8). |
| `generated_segments` | Three-level cache of dynamic speech (Rule 9). |
| `session_manifests` | What was composed, for whom, with a budget audit. |
| `manifest_segments` | Ordered references, with layer and offset. |

A module belongs to **no session**. That is the structural difference from
`session_segments`, whose rows are cascade-owned by one `sessions_catalogue`
row and therefore cannot be shared.

## Cost telemetry

Actual variable cost per session, recorded rather than estimated afterwards.

| Table | Purpose |
|---|---|
| `provider_pricing` | Versioned rate cards. Append-only, enforced by trigger. |
| `session_costs` | One priced row per manifest, with quantities and a cost snapshot. |

Three decisions hold this together:

- **No vendor price appears in domain logic.** Rates are configuration, loaded
  by `pricingVersion`. A rate compiled into the product silently rewrites every
  historical cost the day the vendor changes it.
- **Rate cards are append-only.** A price change publishes a new version; an
  existing one is never edited. `provider_pricing` raises on UPDATE or DELETE,
  so this survives someone in a hurry with a SQL console.
- **Money is integer micros**, never a float. A session's speech costs a
  fraction of a penny, so cents are too coarse, and floats drift once summed
  over millions of rows.

Quantities and cost are both stored. The quantities are durable facts that do
not change when a vendor reprices; the cost is a snapshot under a named
version, auditable by recomputation and never silently rewritten.

`reuseRatio()` is the number to watch: the share of a session's segments that
cost nothing to serve again. The architecture's promise is that it stays high
as usage grows. If it falls, more usage has started to mean more spend.

**Cost per successful transition** is reachable by joining
`session_costs -> session_manifests -> user_sessions -> session_outcomes`,
which is why `user_sessions.manifest_id` was added.

Both tables have RLS enabled and **no client policies at all**, so they are
readable only by the service role. That is deliberate: rate cards are
commercially sensitive and a client must never be the source of truth for what
a session cost.

**Open decision — retention.** Cost rows cascade from the manifest, which
cascades from the user, so deleting an account erases its cost history.
Whether anonymised or aggregate cost should outlive an account is a
data-retention decision and has not been made here.

## Hard invariants

These are properties of the system, enforced in code and covered by tests.

- **No raw user text reaches TTS or a cache key.** Dynamic copy is built from
  structured state (`state_current`, `state_target`, `context_tag`,
  `intensity`) only. This carries S3 forward and keeps the situation cache from
  becoming a store of user writing.
- **Cache keys are derived, never user-supplied**, for the same reason.
- **The dynamic budget is enforced at composition**, before any provider call.
  A manifest that exceeds the ceiling is rejected, not trimmed silently.
- **A manifest never contains a whole pre-rendered session.** Rule 2.
- **The safety gate stays upstream of everything here.** Nothing in this engine
  may be reached from raw input without passing it.
- **The decision engine is server-side only.** Nothing under `src/` imports
  `supabase/functions/_shared/` at runtime. The device holds the transport, the
  timeline and the player; it never holds the allocator, the selection rules,
  the recipe vocabulary or the budget.
- **Approved intervention audio must not be publicly enumerable.** Master
  recordings are IP on the same footing as the recipes, so production manifests
  must resolve private assets through short-lived signed URLs rather than
  permanent public bucket paths. Not yet implemented.

## Reconciliation with earlier locked decisions

- **P4** (five canonical recipes; duration is a runtime parameter, not the
  identity of an intervention) — unchanged and now structurally true: duration
  is an input to composition rather than a column in a catalogue key.
- **P19** phase structures — persisted here as `recipe_phases` rather than
  living only in conversation.
- **S14** duration floors are **provisional pending clinical review**. The
  `recipe_phases.is_provisional` flag carries that forward so provisional
  numbers cannot quietly harden into settled ones.
- **S15** silence rules — represented as `kind = 'silence'` manifest segments,
  so silence is composed rather than baked into an audio file.
- **S13 / S16** — boundaries and re-approval unchanged.
- **S4** — clinical technique **content** remains out of scope for engineering.
  This engine defines the taxonomy slots; what goes in them is authored and
  approved elsewhere. `intervention_modules.approved` gates that.

## What this does NOT yet do

Stated plainly so it is not mistaken for finished work.

- **No audio content exists.** The library is a schema with no rows.
- **The player is wired but never activates.** `session.tsx` runs both engines
  behind one shape: the composer takes over only when it returns a complete
  manifest, and it cannot, because `intervention_modules` is empty. Every
  session falls back to `use-session-audio.ts` and the catalogue path. The
  recipes ARE seeded — that half is done — so modules are the only thing left
  in the way.
- **Edge fades, not crossfades.** Cues ramp in and out inside their own
  duration. A true crossfade overlaps neighbours, which would make playback
  finish earlier than the composed duration and drift out of step with the
  progress bar. A real crossfade requires composition to model the overlap —
  a manifest change, not a player change.
- **No TTS provider is wired.** `supabase/functions/_shared/provider.ts`
  defines the adapter boundary and `speech.ts` the budget; no vendor is called.
  Both are server-side: no key is bundled client-side, and a budget the client
  could skip would not be a budget.
- **`sessions_catalogue` remains the live path**, because retiring it before
  the library has content would leave no playable session at all. There is no
  feature flag: a flag would gate a path that cannot yet produce a manifest.
  The switch happens on its own when approved modules land.
- **A phase chains modules** rather than playing one and padding the rest with
  silence (S16 re-approved). A module never repeats within a phase, which is
  what limits how full a twenty-minute session can be. See
  [`module-library.md`](./module-library.md).
