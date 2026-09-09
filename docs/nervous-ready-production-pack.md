# ELSEA — first production content pack: NERVOUS → READY

The five load-bearing modules, with author-draft wording, ready for content and
clinical review.

Prepared: 2026-09-09. Draft manifest:
[`content/nervous-ready-tranche-1.draft.json`](../content/nervous-ready-tranche-1.draft.json)

> **NOTHING HERE IS APPROVED.** Every script below is **author draft**, every
> `technique_key` is **proposed**, and `approved` is **false** in every record.
> No audio has been recorded, nothing has been imported, and no service-role
> key has been used. Approval is a decision made outside engineering and has
> not been made.

---

## Status at a glance

| | |
|---|---|
| Modules | 5 |
| Author status | **DRAFT COMPLETE** |
| Content approval | **PENDING** |
| Clinical approval | **PENDING** |
| Recording status | **NOT RECORDED** |
| Audio validation | **NOT RUN** |
| `approved` flag | **false** — all five |
| Structural validation | **PASS** (records only; no audio to check) |
| Import | **dry run only** — nothing written, nothing uploaded |

---

## Read this before recording — one script does not fit

Estimated speaking time against each ceiling, at 130 words/minute
(unhurried conversational) and 110 wpm (slower still). Extended-exhale cycles
are counted at ~8 seconds each, because a breath prompt needs real silence to
be followed rather than merely heard.

| Module | Ceiling | Words | Breath cycles | Est. @130 | Est. @110 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| `nr_arrive_short` | 21s | 34 | — | 15.7s | 18.5s | **fits** |
| `nr_regulate_short` | 45s | 67 | 2 | **46.9s** | **52.5s** | **STILL OVER** |
| `nr_reframe_short` | 40s | 64 | — | 29.5s | 34.9s | **fits** |
| `nr_prepare_short` | 45s | 72 | — | 33.2s | 39.3s | **fits** |
| `nr_close_short` | 11s | 18 | — | 8.3s | 9.8s | fits, **tight** |

### `nr_regulate_short` is still over 45 seconds after the cut

**Cutting the third breath cycle helped substantially and was not enough.**

| | Words | Cycles | Est. @130wpm | Est. @110wpm |
|---|---:|---:|---:|---:|
| As first drafted | 70 | 3 | 56.3s | 62.2s |
| **After the cut** | 67 | 2 | **46.9s** | **52.5s** |
| Ceiling | | | **45s** | **45s** |

The remaining gap is **~2 seconds at 130 wpm and ~7.5 at 110 wpm**. Two
extended-exhale cycles are 16 seconds of the 45 on their own, and the words
around them are 67.

It cannot be closed by speaking faster: a hurried extended-exhale prompt is not
an extended exhale, and the technique is the breathing rather than the
sentences.

**A further content decision is required.** Engineering will not rewrite the
script. What the architecture supports, smallest first:

- **Cut the closing two sentences** (*"You're not trying to become perfectly
  calm. You're just taking the edge off, enough to give yourself more room for
  what comes next."* — 30 words). That saves 14–16 seconds and brings it to
  **31–37s**, comfortably inside 45 with room for the breathing to breathe.
  This is the smallest change that actually works.
- **Cut to one breath cycle**, leaving 8 seconds of breathing. Roughly
  39–45s — at the ceiling, with no headroom, and one cycle may not be enough
  of the technique to be worth doing.
- **Author it as `nr_regulate_long` instead** (254s ceiling, fits comfortably).
  But `regulate_arousal` still needs a short module for the five-minute
  session, so a different short `regulate` or `ground` module would then be
  required.

Recording it at 47s and hoping is the one option that does not work: the
validator rejects a file more than 0.25s from its declared length, and a
45-second slot silently will not select a 47-second module.

### `nr_close_short` is tight but viable

8.3–9.8 seconds against an 11-second ceiling. It fits — but *"warm, confident
and concise"* delivery tends to slow down, and there is under 3 seconds of
headroom. Time it in the booth before the take is called good.

---

## The five modules

### 1 — `nr_arrive_short`

| Field | Value |
|---|---|
| `module_key` | `nr_arrive_short` |
| `family` | `orient` |
| Maximum duration | **21 seconds** |
| Proposed `technique_key` | `present_moment_orienting` |
| Author status | DRAFT COMPLETE |
| Content approval | PENDING |
| Clinical approval | PENDING |
| Recording | NOT RECORDED |
| Audio validation | NOT RUN |
| Final filename | `nr_arrive_short.m4a` |
| `approved` | **false** |

**Draft wording**

> Come back to where you actually are. Let your eyes rest on one thing around you.
> Feel the surface supporting you. Notice your feet or your hands.
> Nothing needs solving yet. Just arrive here.

**Delivery direction** — Quiet, grounded and conversational. Not whispery or
meditative.

---

### 2 — `nr_regulate_short`

| Field | Value |
|---|---|
| `module_key` | `nr_regulate_short` |
| `family` | `regulate` |
| Maximum duration | **45 seconds** |
| Proposed `technique_key` | `extended_exhale_release` |
| Author status | DRAFT COMPLETE |
| Content approval | PENDING |
| Clinical approval | PENDING |
| Recording | NOT RECORDED — **still blocked on duration after the cut; see above** |
| Audio validation | NOT RUN |
| Final filename | `nr_regulate_short.m4a` |
| `approved` | **false** |

**Draft wording**

> Notice where the tension is sitting — your jaw, shoulders, chest or stomach.
> You don't have to force it away.
> Breathe in gently, then let the out-breath be a little longer.
> Again. In, easy. Out, slower.
> Let your shoulders soften as you breathe out.
> You're not trying to become perfectly calm.
> You're just taking the edge off, enough to give yourself more room for what comes next.

**Revised 2026-09-09** — the third breath cycle (*"One more time."*) was cut on
instruction. Two cycles remain. This shortened the module by roughly nine
seconds and **did not bring it inside the ceiling**; see the duration finding.

**Delivery direction** — Grounded and normal. Allow enough space for the
breathing prompts without exceeding 45 seconds.

> The delivery direction and the ceiling are in conflict as written. See above.

---

### 3 — `nr_reframe_short`

| Field | Value |
|---|---|
| `module_key` | `nr_reframe_short` |
| `family` | `reframe` |
| Maximum duration | **40 seconds** |
| Proposed `technique_key` | `nervous_energy_reappraisal` |
| Author status | DRAFT COMPLETE |
| Content approval | PENDING |
| Clinical approval | PENDING |
| Recording | NOT RECORDED |
| Audio validation | NOT RUN |
| Final filename | `nr_reframe_short.m4a` |
| `approved` | **false** |

**Draft wording**

> That nervous feeling doesn't automatically mean you're not ready.
> It can simply mean this matters and your system is switched on.
> You don't have to get rid of the energy.
> You can give it a job.
> Let it sharpen your attention.
> Let it remind you to stay present.
> You can feel nerves and still move well.
> Both can be true at the same time.

**Delivery direction** — Confident and matter-of-fact. Do not sound like
reassurance or therapy.

---

### 4 — `nr_prepare_short`

| Field | Value |
|---|---|
| `module_key` | `nr_prepare_short` |
| `family` | `prepare` |
| Maximum duration | **45 seconds** |
| Proposed `technique_key` | `first_action_rehearsal` |
| Author status | DRAFT COMPLETE |
| Content approval | PENDING |
| Clinical approval | PENDING |
| Recording | NOT RECORDED |
| Audio validation | NOT RUN |
| Final filename | `nr_prepare_short.m4a` |
| `approved` | **false** |

**Draft wording**

> Now bring to mind the very first moment you need to handle.
> Not the whole thing — just the beginning.
> What do you need to do first?
> Maybe walk in, make the call, say the opening line, or take your place.
> See yourself doing that one thing steadily.
> Choose one simple cue: shoulders down, eyes up, start slowly.
> You don't need the whole thing mapped out.
> You only need the next move.

**Delivery direction** — Slightly more forward-moving than the earlier modules.
Still controlled and grounded.

> This module is eligible for **two phases** — `build_readiness` and
> `direct_attention_forward`. It never plays twice in one session, but it must
> make sense in either place.

---

### 5 — `nr_close_short`

| Field | Value |
|---|---|
| `module_key` | `nr_close_short` |
| `family` | `close` |
| Maximum duration | **11 seconds** |
| Proposed `technique_key` | `readiness_transition_cue` |
| Author status | DRAFT COMPLETE |
| Content approval | PENDING |
| Clinical approval | PENDING |
| Recording | NOT RECORDED |
| Audio validation | NOT RUN |
| Final filename | `nr_close_short.m4a` |
| `approved` | **false** |

**Draft wording**

> You don't need to feel fearless.
> Take this steadier version of you with you.
> You're ready to begin.

**Delivery direction** — Warm, confident and concise. Do not stretch the
delivery. Must remain ≤11 seconds.

> 11 seconds is the tightest slot in the product, set by `wired_sleep.close`.
> Authored at this length, this module serves **all five recipes**.

---

## The draft manifest

[`content/nervous-ready-tranche-1.draft.json`](../content/nervous-ready-tranche-1.draft.json),
in the exact schema `scripts/modules-validate.mjs` and
`scripts/modules-import.mjs` expect.

### Two fields deliberately left out

**`intensity`** — omitted. It is a clinical field, the scale is undefined
anywhere in the system, and inventing a number would be fabricating a clinical
value. The validator treats it as optional.

> **Note for the import.** When absent, `modules-import.mjs` writes a default
> of `5`. That is an importer default, not a clinical judgement, and it will
> land in the database as though it were one. Either supply real values before
> import or accept that the column holds a placeholder — the column is
> currently read by nothing, so deferring is defensible, but it should be
> deferred deliberately.

**`approved_at`** — set by the importer from `approved`. Since `approved` is
false, it will be written as null, which is correct.

### One field that is a placeholder

**`duration_seconds`** currently holds each module's **ceiling**, not a
measured length. That is the only honest value available before recording, and
it is wrong the moment audio exists.

> **This must be updated to the measured duration of each file before import.**
> The validator rejects any file whose real length differs from the declared
> value by more than 0.25 seconds, so an unedited manifest will fail — which is
> the correct outcome, and better than a manifest that silently disagrees with
> its audio.

### Validation run

```
node scripts/modules-validate.mjs content/nervous-ready-tranche-1.draft.json
→ 5 module record(s) checked
→ PASS — nothing blocking import
→ exit 0
```

Records only. **No audio was checked, because none exists** — the run reports
the codec, sample-rate, channel, bitrate, duration, loudness and true-peak
checks as SKIPPED, and a skipped check is never a pass.

```
node scripts/modules-import.mjs content/nervous-ready-tranche-1.draft.json
→ DRY RUN — 5 module(s), audio MISSING for all five
→ 0 of 5 marked approved
→ Nothing written, nothing uploaded
```

The library remains empty and `compose` still answers `library_empty`.

---

## What has to happen next, in order

1. **A further content decision on `nr_regulate_short`.** The third breath
   cycle was cut on 2026-09-09, which brought it from 56–62s to 47–53s — still
   over the 45-second ceiling. Cutting the closing two sentences is the
   smallest change that would resolve it.
2. **Content review** of all five scripts.
3. **Clinical review**, including confirmation or replacement of the five
   proposed `technique_key` values and a decision on `intensity`.
4. **Approval** — the only thing that makes content selectable.
5. **Record** to the audio specification: AAC-LC `.m4a`, 44.1 kHz, mono,
   96 kbps, −16 LUFS ±1, ≤ −1 dBTP, ≤100 ms head and tail silence, no fades.
   Files named exactly `<module_key>.m4a`.
6. **Update `duration_seconds`** in the manifest to the measured lengths.
7. **Set `approved` to true** for each module that passed review.
8. **Validate with `--audio-dir`**, then dry run, then `--commit` with a
   service-role key.

Steps 1 to 4 and 7 are not engineering decisions and will not be made here.
