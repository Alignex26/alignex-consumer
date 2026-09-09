#!/usr/bin/env node
//
// Generates the ELSEA sound layer: the ambient bed and the spatial movement
// assets, deterministically, with ffmpeg.
//
//   node scripts/generate-sound-assets.mjs [--out <dir>] [--force]
//
// WHY OFFLINE. There is no runtime stereo panning anywhere in this project and
// none is being added. Panning on a device would mean a DSP layer, a native
// dependency and a per-frame budget in the middle of a regulation session. The
// movement is baked into a stereo file here, once, and the player just plays
// it. That keeps the device side to "start a file, stop a file".
//
// WHAT THESE ARE. Prototype sound design, generated from synthesis primitives.
// They are NOT intervention content, are not clinical, and carry no claim of
// any kind. They live in the app bundle under assets/sound-layer/ and never go
// near `intervention_modules` or the private audio bucket.
//
// FREQUENCIES ARE ENGINEERING PARAMETERS. The carrier tones below were chosen
// because they are low, musically neutral, and divide evenly into the asset
// length so the bed loops without a seam. Nothing here treats, entrains or
// heals anything, and no frequency may be described as doing so.

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUT = outIndex >= 0 ? args[outIndex + 1] : join('assets', 'audio', 'sound-design');
const force = args.includes('--force');

// ---------------------------------------------------------------------------
// Sound-design parameters. Engineering values, not therapeutic ones.
// ---------------------------------------------------------------------------

const SPEC = {
  sampleRate: 44100,
  // Stereo, unlike the spoken modules: the whole point of this layer is that it
  // has a left and a right.
  channels: 2,
  // Lower than the 96k used for speech. This is ambient material with very
  // little high-frequency content, and it loops, so bytes matter more here.
  bitrate: '64k',
  /**
   * Delivery level for the whole layer, in LUFS.
   *
   * The spoken modules are mastered to -16 LUFS. This layer is normalised to
   * **10 dB under that**, so it is present without competing, and the player
   * attenuates it further still (BED_GAIN) before anything is heard.
   *
   * The number is a sound-design parameter, chosen so the relationship between
   * voice and layer is fixed at the asset level rather than left to whatever
   * the synthesis happened to produce. Without it these assets came out around
   * -44 LUFS, which is inaudible under speech.
   */
  loudnessTarget: -26,
  truePeakCeiling: -3,
};

const BED = {
  key: 'nervous_ready_bed_v1',
  // 20 s divides evenly by both carriers below, so the waveform is at the same
  // phase at the end as at the start and the loop has no seam.
  seconds: 20,
  // 110 Hz and its octave. Chosen for being low and unobtrusive, and for
  // dividing exactly into 20 s (2200 and 4400 whole cycles).
  carrierHz: 110,
  octaveHz: 220,
  // Well under the voice. The player attenuates further on top of this.
  gain: 0.06,
  octaveGain: 0.025,
  // A little air, heavily filtered so it reads as room rather than as hiss.
  airGain: 0.012,
};

const SWEEP = {
  key: 'spatial_sweep_soft_v1',
  seconds: 4,
  // One full pan cycle across the asset: LEFT -> CENTRE -> RIGHT -> CENTRE ->
  // LEFT. 1 / 4 s = 0.25 Hz.
  panHz: 0.25,
  gain: 0.16,
};

const RESOLVE = {
  key: 'centre_resolve_soft_v1',
  seconds: 2,
  // Same carrier family as the bed so the resolve belongs to it.
  toneHz: 220,
  gain: 0.12,
};

// ---------------------------------------------------------------------------

function ffmpegAvailable() {
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return r.status === 0;
}

function run(label, filter, seconds, file) {
  // Normalisation is appended to every graph rather than baked into each one,
  // so all three assets land at the same level relative to the voice and the
  // relationship cannot drift between them.
  const normalised =
    `${filter};[out]loudnorm=I=${SPEC.loudnessTarget}:TP=${SPEC.truePeakCeiling}:LRA=7[norm]`;

  const result = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-filter_complex', normalised,
      '-map', '[norm]',
      '-t', String(seconds),
      '-c:a', 'aac', '-profile:a', 'aac_low',
      '-b:a', SPEC.bitrate,
      '-ar', String(SPEC.sampleRate),
      '-ac', String(SPEC.channels),
      file,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    console.error(`\n  ${label} failed:\n${result.stderr ?? ''}\n`);
    process.exit(1);
  }
}

/**
 * The ambient bed.
 *
 * Two sine carriers an octave apart plus a band-limited hiss, summed, then
 * given a gentle stereo spread by delaying one channel by a few milliseconds.
 * The delay is what makes it stereo without any panning: the ear reads a small
 * inter-channel time difference as width.
 *
 * Fades are applied at both ends and are deliberate here -- unlike the spoken
 * modules, which must have none. A looped bed with hard edges ticks once per
 * loop, and the fades are inside the asset's own length so looping stays
 * seamless.
 */
function bedFilter() {
  const { seconds, carrierHz, octaveHz, gain, octaveGain, airGain } = BED;
  const fade = 0.5;
  return [
    `sine=frequency=${carrierHz}:sample_rate=${SPEC.sampleRate}:duration=${seconds}[c]`,
    `sine=frequency=${octaveHz}:sample_rate=${SPEC.sampleRate}:duration=${seconds}[o]`,
    `anoisesrc=color=brown:sample_rate=${SPEC.sampleRate}:duration=${seconds}:amplitude=0.4[n]`,
    `[c]volume=${gain}[cv]`,
    `[o]volume=${octaveGain}[ov]`,
    `[n]lowpass=f=520,highpass=f=90,volume=${airGain}[nv]`,
    `[cv][ov][nv]amix=inputs=3:normalize=0[mono]`,
    // Mono -> stereo, then a 7 ms offset on the right channel for width.
    `[mono]aformat=channel_layouts=mono,pan=stereo|c0=c0|c1=c0[st]`,
    `[st]stereotools=sbal=0:mlev=1,adelay=0|7[wide]`,
    `[wide]afade=t=in:st=0:d=${fade},afade=t=out:st=${seconds - fade}:d=${fade}[out]`,
  ].join(';');
}

/**
 * The spatial sweep.
 *
 * A soft filtered noise band moved across the stereo field by `apulsator` in
 * sine mode, which modulates the two channels in antiphase -- that is the pan.
 * At 0.25 Hz over 4 s the asset contains exactly one cycle, so it starts left,
 * crosses centre, reaches right, and returns.
 *
 * Kept dull on purpose: a low-passed noise band reads as air moving, where an
 * unfiltered one reads as a film transition.
 */
function sweepFilter() {
  const { seconds, panHz, gain } = SWEEP;
  return [
    `anoisesrc=color=pink:sample_rate=${SPEC.sampleRate}:duration=${seconds}:amplitude=0.5[n]`,
    `sine=frequency=180:sample_rate=${SPEC.sampleRate}:duration=${seconds}[t]`,
    `[n]lowpass=f=1400,highpass=f=180[nf]`,
    `[t]volume=0.25[tv]`,
    `[nf][tv]amix=inputs=2:normalize=0[mix]`,
    `[mix]aformat=channel_layouts=mono,pan=stereo|c0=c0|c1=c0[st]`,
    // The pan itself.
    `[st]apulsator=hz=${panHz}:mode=sine:width=1:offset_l=0:offset_r=0.5[pan]`,
    // Shaped so it arrives and leaves rather than switching on.
    `[pan]volume=${gain},afade=t=in:st=0:d=1.2,afade=t=out:st=${seconds - 1.4}:d=1.4[out]`,
  ].join(';');
}

/**
 * The centre resolve.
 *
 * Deliberately NOT panned. It is the counterpart to the sweep: after movement,
 * something that sits still in the middle. Equal in both channels by
 * construction.
 */
function resolveFilter() {
  const { seconds, toneHz, gain } = RESOLVE;
  return [
    `sine=frequency=${toneHz}:sample_rate=${SPEC.sampleRate}:duration=${seconds}[t]`,
    `sine=frequency=${toneHz * 1.5}:sample_rate=${SPEC.sampleRate}:duration=${seconds}[f]`,
    `[t]volume=${gain}[tv]`,
    `[f]volume=${gain * 0.4}[fv]`,
    `[tv][fv]amix=inputs=2:normalize=0[mix]`,
    `[mix]aformat=channel_layouts=mono,pan=stereo|c0=c0|c1=c0[st]`,
    `[st]afade=t=in:st=0:d=0.15,afade=t=out:st=0.4:d=${seconds - 0.4}[out]`,
  ].join(';');
}

// ---------------------------------------------------------------------------

if (!ffmpegAvailable()) {
  console.error(
    '\n  ffmpeg is required to generate the sound layer and was not found.\n' +
    '  Install it and re-run. Nothing was written.\n'
  );
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

const assets = [
  { ...BED, filter: bedFilter(), what: 'ambient bed, seamless loop' },
  { ...SWEEP, filter: sweepFilter(), what: 'L -> C -> R -> C -> L pan' },
  { ...RESOLVE, filter: resolveFilter(), what: 'centred resolve' },
];

console.log(`\n  Generating the ELSEA sound layer into ${OUT}\n`);

for (const asset of assets) {
  const file = join(OUT, `${asset.key}.m4a`);

  if (existsSync(file) && !force) {
    console.log(`  ${asset.key.padEnd(26)} exists, skipped (--force to rebuild)`);
    continue;
  }

  run(asset.key, asset.filter, asset.seconds, file);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  ${asset.key.padEnd(26)} ${String(asset.seconds).padStart(3)}s  ${String(kb).padStart(4)} KB  ${asset.what}`);
}

// ---------------------------------------------------------------------------
// Validation. Measured with ffprobe and ffmpeg, and reported exactly as
// measured — a check that could not run is printed as SKIPPED, never folded
// into a pass.
// ---------------------------------------------------------------------------

function probe(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error',
     '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration',
     '-of', 'json', file],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function measureLoudness(file) {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const text = `${r.stderr ?? ''}`;
  const start = text.lastIndexOf('{');
  const end = text.indexOf('}', start);
  if (start < 0 || end < 0) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const i = Number(parsed.input_i);
    const tp = Number(parsed.input_tp);
    return Number.isFinite(i) && Number.isFinite(tp) ? { i, tp } : null;
  } catch {
    return null;
  }
}

console.log('\n  VALIDATION — measured, not assumed\n');
console.log('  asset                       dur   rate  ch  codec  kbps   LUFS    dBTP');
console.log('  --------------------------  ----  -----  --  -----  ----  ------  ------');

const skipped = [];

for (const asset of assets) {
  const file = join(OUT, `${asset.key}.m4a`);
  const info = probe(file);

  if (!info) {
    skipped.push(`${asset.key}: ffprobe could not read the file`);
    console.log(`  ${asset.key.padEnd(26)}  UNREADABLE`);
    continue;
  }

  const stream = info.streams?.[0] ?? {};
  const duration = Number(info.format?.duration);
  const kbps = stream.bit_rate ? Math.round(Number(stream.bit_rate) / 1000) : null;

  const loud = measureLoudness(file);
  if (!loud) skipped.push(`${asset.key}: loudness and true peak could not be measured`);

  console.log(
    `  ${asset.key.padEnd(26)}  ${duration.toFixed(1).padStart(4)}  ` +
    `${String(stream.sample_rate).padStart(5)}  ${String(stream.channels).padStart(2)}  ` +
    `${String(stream.codec_name).padEnd(5)}  ${String(kbps ?? '—').padStart(4)}  ` +
    `${loud ? loud.i.toFixed(1).padStart(6) : ' SKIP '}  ` +
    `${loud ? loud.tp.toFixed(1).padStart(6) : ' SKIP '}`
  );

  // Hard requirements for this layer. Stereo is the whole point of it.
  if (Number(stream.channels) !== SPEC.channels) {
    console.error(`\n  ${asset.key} is not stereo (${stream.channels} channels).\n`);
    process.exit(1);
  }
  if (Number(stream.sample_rate) !== SPEC.sampleRate) {
    console.error(`\n  ${asset.key} is ${stream.sample_rate} Hz, expected ${SPEC.sampleRate}.\n`);
    process.exit(1);
  }
}

if (skipped.length) {
  console.log('\n  SKIPPED (not passed — simply not measured):');
  for (const s of skipped) console.log(`    - ${s}`);
}

console.log(
  `\n  Prototype sound design. Not intervention content, not clinical, and no\n` +
  `  claim attached to any frequency. These never enter intervention_modules\n` +
  `  and never go into the private audio bucket.\n`
);
