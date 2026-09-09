# ELSEA — audio production specification, V1

The technical standard every approved intervention master must meet. An
engineering and media decision, not a therapeutic one: nothing here concerns
what is said, only how it is encoded and delivered.

Enforced by `npm run modules:validate`, which rejects a file that does not
conform.

---

## 1. The specification

| Property | Value |
|---|---|
| Container | `.m4a` (MPEG-4 audio) |
| Codec | AAC-LC |
| Sample rate | 44 100 Hz |
| Channels | **Mono** |
| Bitrate | 96 kbps CBR |
| Integrated loudness | **−16 LUFS** (±1 LU) |
| True peak ceiling | **−1 dBTP** |
| Leading silence | ≤ 100 ms |
| Trailing silence | ≤ 100 ms |
| Fades | none baked in |
| Naming | `<module_key>.m4a` — see §5 |
| Typical size | ~12 KB per second (~1.2 MB for 100 s) |

## 2. Why each of these

**AAC-LC in `.m4a`.** Natively decoded by iOS with no third-party dependency,
and the format `expo-audio` already handles. The seeded catalogue's paths
already use `.m4a`, so nothing in the codebase changes.

**Mono.** Spoken word carries no stereo information worth the bandwidth, and
mono halves the bytes. It also removes a real failure mode: concatenating
segments recorded with different stereo imaging produces an audible shift in
the voice's position between modules, which is exactly the "mechanically
assembled" impression the no-repeat rule exists to avoid.

**44.1 kHz.** Sufficient for speech, universally supported, and avoids
resampling on iOS. 48 kHz would be defensible for video work; there is no video.

**96 kbps.** Comfortably transparent for mono speech — 64 kbps is usually
adequate and 96 leaves headroom for breath and room tone without artefacts. At
~12 KB/s, a full twenty-minute session is roughly 14 MB of unique audio, and
that is before any of it is reused across sessions.

**−16 LUFS integrated, −1 dBTP.**

This is the decision worth explaining, because three conventions compete:

| Standard | Target | Domain |
|---|---|---|
| EBU R 128 | −23 LUFS | broadcast television and radio |
| Apple Music / podcast convention | −16 LUFS | mobile listening |
| Spotify, YouTube, Tidal | −14 LUFS | music streaming |

−23 LUFS is a broadcast target and far too quiet for a phone in a quiet room at
low volume — a person settling for sleep would not hear it. −14 LUFS is a music
target and too hot for spoken word intended to calm.

**−16 LUFS** is the mobile spoken-word convention and matches Apple's own
normalisation, so ELSEA sits where the listener's other audio sits and needs no
volume change when switching.

**Consistency matters more here than in most products.** A session is several
masters played back to back. A module 3 LU louder than its neighbour is not a
small flaw — it is a jolt in the middle of a regulation exercise. The ±1 LU
tolerance is tight on purpose.

**−1 dBTP** leaves headroom so lossy encoding cannot produce inter-sample peaks
that clip on playback.

**Silence trimmed to ≤100 ms.** The composer inserts silence deliberately, as
manifest segments with known durations (S15). Silence baked into a file is
invisible to it: a 90-second module with two seconds of trailing air is a
92-second module that reports 90, and the timeline drifts from the progress
bar. Trim it, and let composition place the gaps.

**No baked-in fades.** The player applies a 250 ms edge ramp at every cue
boundary. A fade already in the file would be applied twice.

## 3. What the validator checks

`npm run modules:validate` reads each file's actual media properties and fails
on: wrong codec, wrong container, wrong sample rate, stereo, bitrate outside
64–128 kbps, duration mismatching declared metadata by more than 250 ms,
loudness outside −16 ±1 LUFS, true peak above −1 dBTP, or leading/trailing
silence above 100 ms.

Loudness and peak analysis require `ffmpeg` on the machine running the
validator. Where it is absent the validator reports those checks as **skipped**
rather than passed — a skipped check is never reported as a pass.

## 4. Storage

Masters live in the private `intervention-audio` bucket under a deterministic
key:

```
modules/<family>/<module_key>.m4a
```

The bucket is private with no client policy: anon cannot list it, read it, or
see that it exists. The composer issues per-segment signed URLs valid for two
hours. The client never receives a storage path.

Grouping by family makes the layout predictable for the people managing it,
and the object names carry no recipe or selection information — knowing a file
is `modules/regulate/x.m4a` reveals the taxonomy, which is already public in
the app's behaviour, and nothing about which recipes use it or when.

## 5. File naming

**A delivered master is named `<module_key>.m4a`** — for example
`nr_arrive_short.m4a`. Lower case letters, digits and underscores only, and the
name must match the module's `module_key` exactly.

That is not a convention; it is what the tooling requires. Both the validator
and the importer locate a module's audio by taking the **basename of its
`storage_path`** and looking for that file in the delivery folder. Since the
storage path is `modules/<family>/<module_key>.m4a`, the file has to be
`<module_key>.m4a` or it is simply not found — and an approved module with no
file stops the import before anything is written.

> **Corrected 2026-09-09.** This table previously specified
> `<family>_<key>_<seconds>s.m4a`, which nothing implemented and which no
> delivery could have satisfied: a file named that way would fail the audio
> check for every approved module in a tranche. The family is already carried
> by the storage path, and the duration is already carried by
> `duration_seconds` and verified against the file itself, so encoding either
> into the filename would have duplicated a fact that is checked elsewhere —
> and a duration in a filename is a fact that can silently go stale.

## 6. Not specified here

- **Voice, delivery, pacing and tone.** Content decisions.
- **Whether a module needs headphones.** Per-module content decision; the
  schema carries `requires_headphones` and the app already surfaces it.
- **Bed and ambience levels.** The player mixes beds at a fixed gain that is an
  engineering default, not an approved production value — see the known gaps in
  `ELSEA.md`.
