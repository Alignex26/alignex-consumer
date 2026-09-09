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

## Read this before recording — durations

Estimated speaking time against each ceiling, at 130 words/minute
(unhurried conversational) and 110 wpm (slower still). Extended-exhale cycles
are counted at ~8 seconds each, because a breath prompt needs real silence to
be followed rather than merely heard.

| Module | Ceiling | Words | Breath cycles | Est. @130 | Est. @110 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| `nr_arrive_short` | 21s | 34 | — | 15.7s | 18.5s | **fits** |
| `nr_regulate_short` | 45s | 44 | 2 | 36.3s | 40.0s | **fits** |
| `nr_reframe_short` | 40s | 64 | — | 29.5s | 34.9s | **fits** |
| `nr_prepare_short` | 45s | 72 | — | 33.2s | 39.3s | **fits** |
| `nr_close_short` | 11s | 18 | — | 8.3s | 9.8s | fits, **tight** |

### `nr_regulate_short` — resolved over two cuts

It took both. The first cut helped and was not enough on its own.

| | Words | Cycles | Est. @130wpm | Est. @110wpm | |
|---|---:|---:|---:|---:|---|
| As first drafted | 70 | 3 | 56.3s | 62.2s | over |
| After cutting the third breath cycle | 67 | 2 | 46.9s | 52.5s | still over |
| **After cutting the closing two sentences** | **44** | **2** | **36.3s** | **40.0s** | **fits** |
| Ceiling | | | **45s** | **45s** | |

**Headroom is now 5–9 seconds**, which the breathing needs: two extended-exhale
cycles are 16 seconds of the 45 on their own, and pace is the one thing that
must not be compressed here. A hurried extended-exhale prompt is not an
extended exhale.

> Why two cuts rather than one. Removing a breath cycle takes out eight seconds
> of silence but only three words; removing the closing sentences takes out 23
> words and no silence. The first cut addressed the larger single component and
> still left the module over, because the words were the rest of it.

**Estimates, not measurements.** 130 and 110 words per minute bracket an
unhurried conversational delivery, and the breathing is counted at ~8 seconds
per cycle. The real number comes from the booth, and `duration_seconds` in the
manifest must be updated to it.

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
| Recording | NOT RECORDED |
| Audio validation | NOT RUN |
| Final filename | `nr_regulate_short.m4a` |
| `approved` | **false** |

**Draft wording**

> Notice where the tension is sitting — your jaw, shoulders, chest or stomach.
> You don't have to force it away.
> Breathe in gently, then let the out-breath be a little longer.
> Again. In, easy. Out, slower.
> Let your shoulders soften as you breathe out.

**Revised 2026-09-09, twice, on instruction.** First the third breath cycle
(*"One more time."*) was cut, then the closing two sentences (*"You're not
trying to become perfectly calm…"*). Two extended-exhale cycles remain and the
module now **fits its ceiling** — see the duration finding.

The module now ends on the breathing rather than on a summary. Whether that is
the right ending is a content judgement; it was not made here.

**Delivery direction** — Grounded and normal. Allow enough space for the
breathing prompts without exceeding 45 seconds.

> There is now room to follow that direction: roughly 5–9 seconds of headroom
> after the two cuts. Do not spend it all — the breathing is the technique.

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

1. ~~Content decision on `nr_regulate_short`~~ — **resolved 2026-09-09** over
   two cuts: the third breath cycle, then the closing two sentences. Now
   estimated 36–40s against a 45s ceiling. All five scripts fit.
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
