# ELSEA — commercial readiness

**Status: NOT release ready.** This document is written to be trusted, which
means it says what is missing at least as clearly as what is built.

The honest summary in one line: **one recipe composes a real session end to end,
four do not, and nobody has heard any of it.** Six modules are live with approved
audio in three voices; `nervous_ready` composes, persists and fingerprints
correctly. Four more modules make the remaining recipes composable. Nothing in
the commercial layer changes that, and no amount of it can.

Last updated 2026-09-14, after the launch-tranche production run. Live figures
read from `alignex-consumer-dev` with `npm run coverage` and `npm run recipes`.

---

## A. Build status

| | |
|---|---|
| Branch | `main` |
| Tests | 766 passing across 25 suites |
| TypeScript | clean (app and functions) |
| Migrations | 18 written, **all applied** |
| Live project | `alignex-consumer-dev` |
| Edge functions | all four deployed and current at `f5d489f` |

**Built and verified this pass**

- Entitlement schema: `entitlements`, `free_session_ledger`, and two
  `security definer` RPCs.
- Client entitlement boundary, replacing the placeholder that had carried three
  "PRODUCT DECISION REQUIRED" markers since it was written.
- Ten voice profiles as a catalogue, with a trigger preventing a voice becoming
  selectable without a provider mapping.
- `scripts/coverage-report.mjs` — the locale × voice × module matrix.
- `docs/commercial-configuration.md` — every store and RevenueCat action.

**Not built.** RevenueCat SDK, the entitlement webhook, the paywall UX, batch
production tooling, and the analytics expansion. See §R.

---

## B. Subscriptions

**Architecture complete. Integration absent.**

The schema, the RPCs and the client boundary exist and are tested. What does not
exist is anything that can take money: no SDK, no webhook, no purchase flow.

`entitlements` is therefore never written, so every account today is on the free
trial and the paywall appears after the third completed session. That is coherent
behaviour rather than a broken state — but no purchase can succeed, so the app
cannot ship.

Five customer states are modelled and tested: `active`, `grace`,
`billing_issue`, `cancelled`, `expired`. `grace`, `billing_issue` and `cancelled`
all retain access — somebody who cancels on day two of an annual subscription has
paid for the year.

---

## C. Free trial

**Complete and tested.** Three complete sessions, lifetime, per account.

The counting point is documented and enforced server-side: an allowance is
consumed when a run is marked completed, verified against `user_sessions` rather
than believed from the caller. `run_id` is unique, so a repeated report is a
no-op rather than a second charge.

Explicitly **not** consumed for safety diversion, `locale_unavailable`,
`library_empty`, any backend or provider failure, or any failure before playback
— none of those reaches a completed run.

The ledger is keyed to `auth.users`, so a reinstall does not reset it. Premium
consumes nothing, so a subscription starting mid-trial does not keep burning
allowances.

**Open product question:** the entitlement is per *account*, and accounts are
created by email OTP. Somebody who never signs in has no server-side identity, so
either the trial requires an account up front, or it is device-local and
resettable. That is a UX decision and is recorded in §Q, not decided here.

---

## D. Pricing

| | |
|---|---|
| Annual | USD 49.99 — primary |
| Monthly | USD 9.99 |
| Free | 3 complete sessions, lifetime |

No price appears anywhere in the app source, and a test enforces that. Displayed
prices come from the store, localised, at runtime; any annual-vs-monthly saving
is computed from the two live prices.

Product ids are fixed and documented: `elsea_premium_annual`,
`elsea_premium_monthly`, entitlement `premium`. **None has been created in either
store.**

---

## E. Voices — 10

| # | Profile | Label | Active | Mapped | Audio |
|---|---|---|---|---|---|
| 1 | `warm` | Warm | yes (default) | yes | 5 approved renditions |
| 2 | `clear` | Clear | yes | yes | 5 approved renditions |
| 3 | `bright` | Bright | yes | yes | 5 approved renditions |
| 4 | `grounded` | Grounded | no | no | none |
| 5 | `gentle` | Gentle | no | no | none |
| 6 | `direct` | Direct | no | no | none |
| 7 | `calm` | Calm | no | no | none |
| 8 | `confident` | Confident | no | no | none |
| 9 | `soft` | Soft | no | no | none |
| 10 | `deep` | Deep | no | no | none |

**Architecturally supported: 10/10. Provider-mapped: 3/10. Selectable: 3/10.**

The seven unmapped profiles are catalogue entries with no provider mapping and
`is_active = false`. Selecting the provider voices for them is a product decision
and has not been taken; **no provider voice id has been invented.**

A database trigger now refuses to activate any profile without an active provider
mapping, so none of the seven can become selectable by accident. That exact
mistake was made once before, when `bright` was inserted active before any
mapping existed.

**`bright` is approved and activated.** All five modules were produced in it at
0.92x, listened to, and approved on 2026-09-14; the database trigger permitted
activation, which confirms its provider mapping is live.

All three voices now have complete coverage of the launch tranche — 5/5 modules
each, zero missing.

---

## F. Languages — 5

| Locale | Label | Enabled | Content ready |
|---|---|---|---|
| `en` | English | yes | yes |
| `es` | Español | no | no |
| `de` | Deutsch | no | no |
| `fr` | Français | no | no |
| `pt-BR` | Português (Brasil) | no | no |

**Architecturally supported: 5/5. Content-ready: 1/5** — and see §G, because
`en` being flagged content-ready is generous: it has five modules, not
forty-seven.

`is_enabled` and `is_content_ready` remain separate concepts. Language never
falls back to another language; a missing locale returns `locale_unavailable`.
Voice may fall back within the same language only.

**Not built:** the translation workflow, the import/export tooling, and the
translation packs. Four locales have no translated content, and none may be
created or approved by me.

---

## G. Content coverage

| | |
|---|---|
| Planned | **47** |
| Authored (English) | **6** |
| Content-approved (English) | **6** |
| With any approved audio | **6** — all of them, in all three voices |
| Playable modules | **6** |
| **Recipes composable** | **1 of 5** — `nervous_ready` |

The five are the `nervous_ready` tranche: `nr_arrive_short`,
`nr_regulate_short`, `nr_reframe_short`, `nr_prepare_short`, `nr_close_short` —
one each in `orient`, `regulate`, `reframe`, `prepare`, `close`.

**Seven of the twelve families have nothing authored at all:** `ground`,
`release`, `focus`, `activate`, `transition`, `settle`, `sleep`.

**The release blocker is now precise: 4 of 5 recipes do not compose.** A module plays at
most once per session, so five modules cannot fill six or seven phases, and
several phases name families with nothing in them at all. `npm run recipes`
reports it per phase.

`focus_narrow_short` took it from 0/5 to 1/5 and halved two more gaps. Four
families remain empty: `activate` (unblocks `flat_go`), `ground` or `release`
(`scattered_focused`), `settle` and `sleep` (`wired_sleep`, `wound_up_home`).
**Four more modules at minimum.**

This is authoring and human wellbeing approval. I must not write them.

---

## H. Audio coverage

**Complete for the launch tranche.** All five modules have approved masters in
all three voices — 15 renditions, produced 2026-09-14 at 0.92x pace, every one
meeting specification and every one human-approved.

```
locale  voice   approved audio  missing
en      warm    5               0
en      clear   5               0
en      bright  5               0
```

The mastering ladder refused one take outright (`nr_regulate_short`/clear:
tightening the aim bought 0.21 dB of peak and cost 0.27 dB of loudness). A
regenerated take passed first attempt. See `docs/ELSEA.md` §6t.

**Four of the five load-bearing modules have no audio in any voice.** Removing any
one of those five makes a five-minute session fail with `phase_unfilled`, so the
minimum playable library is all five, in at least one voice.

The mastering pipeline is proven and closes the loop on the encoded AAC — see
`docs/ELSEA.md` §6p. The batch production tooling described in the spec is **not
built**: producing a tranche today still means hand-running commands per module
per voice.

---

## I. Session engine

Proven and green in tests: safety gate, structured interpretation, all five
recipes, all four durations, composition, novelty, replay, cost telemetry, atomic
manifest persistence.

**First live end-to-end attempt, 2026-09-14.** The safety gate and interpretation
worked against the real service: free text in, `nervous_ready` / 600s /
`pre_meeting` out, raw text never leaving the server.

**Composition, persistence and fingerprinting are now proven** (§6u). All four
durations compose for `nervous_ready`; a manifest and its twelve segments were
written atomically and read back intact, with a fingerprint carrying recipe plus
ordered module identities and versions.

**No audio has played on a device**, no outcome has been recorded, and novelty
and replay remain unexercised.

---

## J. Safety

Unchanged and not weakened. Raw free text hits the server-side gate first, never
reaches TTS, never enters a cache key, an analytics payload, a log or a storage
path. The gate fails closed on technical failure.

**Not built:** locale-specific crisis resources. Emergency numbers must be
verified per jurisdiction by a human and must not be translated or invented.

---

## K. Analytics

Exists in `src/lib/analytics.ts` (119 lines) and is privacy-safe by construction.
The commercial funnel events listed in the spec — paywall viewed, annual/monthly
selected, purchase started/completed/failed, restore, subscription state, free
session consumed — are **not implemented**, because nothing can yet emit them.

---

## L. Cost and profit guardrails

Preserved and unchanged:

- Reusable masters are static assets, generated once.
- Dynamic speech bounded at 30s normal, 45s hard ceiling, rejecting rather than
  exceeding.
- Raw text never reaches TTS; cache keys are deterministic and text-free.
- Private storage, short-lived signed URLs, no provider key client-side.

Per-session cost telemetry exists (`session_costs`, `provider_pricing`, versioned
and effective-dated). **No provider rate has been entered** — unknown rates
remain unknown rather than guessed, so cost figures are structurally correct and
currently empty.

Per-subscriber monthly aggregation is **not built**.

---

## M. App Store

**Unconfirmed and entirely outstanding.** Apple Developer membership status has
not been verified. Nothing exists: no app record, no subscription group, no
products, no privacy answers, no sandbox testers.

The Paid Applications Agreement in particular must be active before any product
can be created or tested. Full checklist in `docs/commercial-configuration.md`.

---

## N. Google Play

Developer account approved. Everything else outstanding: app record,
subscription with two base plans, licence testers, internal testing track, data
safety form, content rating.

---

## O. Test results

`npm run verify`, `npm run typecheck`, `npm run typecheck:functions` — see the
session log for the run accompanying this document. `npm run deploy:check`
reports deployment parity.

The ffmpeg-backed mastering tests skip where `ffmpeg` is absent, and a run
reporting skips still exits 0 — see `docs/ELSEA.md` §6p before trusting a green
result for audio behaviour.

**No subscription sandbox test has been run**, because there is nothing to test.
**No real-device regression has been run** against real audio, because there is
none.

---

## P. Known gaps

1. **4 of 5 recipes do not compose** — needs 4 more modules (`activate`,
   `ground`/`release`, `settle`, `sleep`).
2. **No session has been heard on a device.** Composition, persistence and
   fingerprinting are proven; playback, outcome capture, novelty and replay are
   not.
3. 41 of 47 modules unauthored.
3. RevenueCat absent — no purchase possible.
4. Paywall UX is a 61-line placeholder.
5. Batch production tooling not built.
6. Translation workflow not built; 4 locales empty.
7. 7 of 10 voices unmapped.
8. Commercial analytics events not implemented.
9. Locale crisis resources not compiled.
10. Neither store configured.
11. Provider rates unpopulated.
12. Anonymous/pre-auth trial behaviour undecided.

---

## Q. Human approvals still required

- **42 intervention scripts** — authoring and wellbeing approval.
- **Technique keys** for the existing five — proposed, none confirmed.
- **Seven provider voices** — selection.
- **Audio approval** for every rendition, by listening. *(Done: all 15 for the
  launch tranche.)*
- ~~**Pacing**~~ — *0.92× approved 2026-09-14.*
- **Translated content** for four locales, by human translators and reviewers.
- **Crisis resources** per jurisdiction.
- **Anonymous trial UX** — account required up front, or not.
- **Retention periods**, the legal entity, support email, terms and privacy URLs.

---

## R. Release blockers

Ordered by what unblocks the most:

1. **Content.** ~8–10 modules to make all five recipes composable, starting with
   `ground`, `settle` and `focus`. Nothing downstream matters until at least one
   recipe can be filled.
2. ~~Audio for the launch tranche~~ — **done**, 15 renditions in three voices.
3. **RevenueCat integration and the entitlement webhook.**
4. **Paywall UX.**
5. **First real end-to-end session on a device.**
6. **Store configuration**, both platforms.
7. **Apple Developer membership verification.**

---

## S. Exact next action

**Play `nervous_ready` on a device.**

Everything up to the device is proven: free text, safety gate, interpretation,
composition, persistence, fingerprint, signed URLs. Nobody has heard it, and that
is where the next real surprises are — timing, the sound layer, and 35-second
silences that look fine in a table.

Then `activate`, `ground`/`release`, `settle` and `sleep` — four modules to make
the remaining recipes compose.

Everything downstream is built and exercised: import, generate, master, approve,
activate. Run `npm run recipes` after each module lands to see the blocked-phase
count fall.

Authoring and wellbeing approval are human work. I must not do them.
