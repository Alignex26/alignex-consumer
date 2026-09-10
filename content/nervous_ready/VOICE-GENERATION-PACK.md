# ELSEA — voice generation pack: NERVOUS → READY

The five approved scripts, for recording. Nothing else.

Wording is **approved and must not be changed**. Record it as written.

---

## 1 — `nr_arrive_short`

**MODULE KEY** `nr_arrive_short`

**MAXIMUM DURATION** 21 seconds

**EXACT APPROVED SCRIPT**

> Come back to where you actually are. Let your eyes rest on one thing around you.
> Feel the surface supporting you. Notice your feet or your hands.
> Nothing needs solving yet. Just arrive here.

**DELIVERY DIRECTION** — Quiet, grounded and conversational. Not whispery or
meditative.

**OUTPUT FILENAME** `nr_arrive_short.m4a`

---

## 2 — `nr_regulate_short`

**MODULE KEY** `nr_regulate_short`

**MAXIMUM DURATION** 45 seconds

**EXACT APPROVED SCRIPT**

> Notice where the tension is sitting — your jaw, shoulders, chest or stomach.
> You don't have to force it away.
> Breathe in gently, then let the out-breath be a little longer.
> Again. In, easy. Out, slower.
> Let your shoulders soften as you breathe out.

**DELIVERY DIRECTION** — Grounded and normal. Allow enough space for the
breathing prompts without exceeding 45 seconds.

**OUTPUT FILENAME** `nr_regulate_short.m4a`

---

## 3 — `nr_reframe_short`

**MODULE KEY** `nr_reframe_short`

**MAXIMUM DURATION** 40 seconds

**EXACT APPROVED SCRIPT**

> That nervous feeling doesn't automatically mean you're not ready.
> It can simply mean this matters and your system is switched on.
> You don't have to get rid of the energy.
> You can give it a job.
> Let it sharpen your attention.
> Let it remind you to stay present.
> You can feel nerves and still move well.
> Both can be true at the same time.

**DELIVERY DIRECTION** — Confident and matter-of-fact. Do not sound like
reassurance or therapy.

**OUTPUT FILENAME** `nr_reframe_short.m4a`

---

## 4 — `nr_prepare_short`

**MODULE KEY** `nr_prepare_short`

**MAXIMUM DURATION** 45 seconds

**EXACT APPROVED SCRIPT**

> Now bring to mind the very first moment you need to handle.
> Not the whole thing — just the beginning.
> What do you need to do first?
> Maybe walk in, make the call, say the opening line, or take your place.
> See yourself doing that one thing steadily.
> Choose one simple cue: shoulders down, eyes up, start slowly.
> You don't need the whole thing mapped out.
> You only need the next move.

**DELIVERY DIRECTION** — Slightly more forward-moving than the earlier modules.
Still controlled and grounded.

**OUTPUT FILENAME** `nr_prepare_short.m4a`

---

## 5 — `nr_close_short`

**MODULE KEY** `nr_close_short`

**MAXIMUM DURATION** 11 seconds

**EXACT APPROVED SCRIPT**

> You don't need to feel fearless.
> Take this steadier version of you with you.
> You're ready to begin.

**DELIVERY DIRECTION** — Warm, confident and concise. Do not stretch the
delivery. Must remain ≤11 seconds.

**OUTPUT FILENAME** `nr_close_short.m4a`

---

## Recording and preparation

### Two voices

V1 ships **two narration voices**, `warm` and `clear`. **The same five approved
scripts are recorded twice** — the technique, the wording and the approval are
identical, and only the recording differs. Do not vary the words between them.

`warm` is the default and the fallback: if a module has no `clear` recording,
that module plays warm rather than dropping out of the session. So warm can be
recorded first and shipped alone.

**Put raw recordings here:**

```
content/nervous_ready/audio-source/warm/
content/nervous_ready/audio-source/clear/
```

Name each raw file after its module key — any common format:
`nr_arrive_short.wav`, `.m4a`, `.mp3`, `.aiff`, `.flac`.

Record clean and dry: **no fades, no music, no processing.** Loudness, peak
and silence trimming are applied by the command below, and a fade already in
the file would be applied twice by the player.

**Then run, once per voice:**

```bash
node scripts/prepare-voice-masters.mjs --voice warm
node scripts/prepare-voice-masters.mjs --voice clear
```

It converts each raw file to the locked production specification — AAC-LC in
`.m4a`, 44.1 kHz, mono, 96 kbps, −16 LUFS ±1, true peak ≤ −1 dBTP, head and
tail silence trimmed to ≤100 ms, no baked-in fades — writes the masters to
`content/nervous_ready/masters/<voice>/`, and measures every one.

The ceilings are identical for both voices: they are a property of the recipe,
not of the narrator.

**It rejects any recording over its ceiling.** A take that runs long is
reported with the overage and no master is written for it. Nothing is
time-compressed to fit: a 47-second take of a 45-second module is a take that
needs doing again.
