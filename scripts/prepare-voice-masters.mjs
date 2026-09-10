#!/usr/bin/env node
//
// Turns raw voice recordings into production masters, and refuses anything
// that does not belong in the library.
//
//   node scripts/prepare-voice-masters.mjs [--in <dir>] [--out <dir>]
//
// IN   content/nervous_ready/audio-source/   raw takes, named <module_key>.*
// OUT  content/nervous_ready/masters/        <module_key>.m4a, to spec
//
// It applies the locked specification from docs/audio-production-spec.md:
// AAC-LC in .m4a, 44.1 kHz, mono, 96 kbps, -16 LUFS +/-1, true peak <= -1 dBTP,
// head and tail silence trimmed to <=100 ms, and no baked-in fades.
//
// WHAT IT WILL NOT DO. It will not shorten a take that runs over its ceiling.
// Time-compressing speech to fit a slot changes the delivery, and for the
// regulate module the pacing IS the technique. A take that runs long is
// reported and skipped: it needs recording again, not processing harder.
//
// It also applies no fade. The player already ramps 250 ms at every cue
// boundary, so a fade in the file would be applied twice.

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';

const args = process.argv.slice(2);
const pick = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const IN = pick('--in', join('content', 'nervous_ready', 'audio-source'));
const OUT = pick('--out', join('content', 'nervous_ready', 'masters'));

/** From the approved manifest. Ceilings are hard. */
const CEILINGS = {
  nr_arrive_short: 21,
  nr_regulate_short: 45,
  nr_reframe_short: 40,
  nr_prepare_short: 45,
  nr_close_short: 11,
};

/** docs/audio-production-spec.md. Do not vary these here. */
const SPEC = {
  sampleRate: 44100,
  channels: 1,
  bitrate: '96k',
  loudness: -16,
  loudnessTolerance: 1,
  truePeak: -1,
  /** Trim to comfortably inside the 100 ms the spec allows. */
  silenceThresholdDb: -50,
  maxEdgeSilence: 0.1,
};

const ok = (b) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0;
if (!ok('ffmpeg') || !ok('ffprobe')) {
  console.error('\n  ffmpeg and ffprobe are required. Nothing was written.\n');
  process.exit(2);
}

if (!existsSync(IN)) {
  console.error(`\n  No raw audio directory at ${IN}\n  Put the takes there and re-run.\n`);
  process.exit(2);
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) return NaN;
  try {
    return Number(JSON.parse(r.stdout).format?.duration);
  } catch {
    return NaN;
  }
}

function measure(file) {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const text = `${r.stderr ?? ''}`;
  const s = text.lastIndexOf('{');
  const e = text.indexOf('}', s);
  if (s < 0 || e < s) return null;
  try {
    const p = JSON.parse(text.slice(s, e + 1));
    const i = Number(p.input_i);
    const tp = Number(p.input_tp);
    return Number.isFinite(i) && Number.isFinite(tp) ? { i, tp } : null;
  } catch {
    return null;
  }
}

// --- find the takes --------------------------------------------------------
const takes = new Map();
for (const entry of readdirSync(IN)) {
  const key = basename(entry, extname(entry));
  if (!(key in CEILINGS)) continue;
  if (takes.has(key)) {
    console.error(`\n  More than one take named ${key}. Leave exactly one.\n`);
    process.exit(1);
  }
  takes.set(key, join(IN, entry));
}

const missing = Object.keys(CEILINGS).filter((k) => !takes.has(k));

console.log(`\n  Preparing voice masters\n  from ${IN}\n  to   ${OUT}\n`);

if (takes.size === 0) {
  console.log('  No recordings found.\n');
  for (const key of missing) console.log(`    waiting for  ${key}.<wav|m4a|mp3|aiff|flac>`);
  console.log('');
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

console.log('  module               raw     ceiling  master   LUFS    dBTP   result');
console.log('  -------------------  ------  -------  ------  ------  ------  ------');

let rejected = 0;
let written = 0;

for (const key of Object.keys(CEILINGS)) {
  if (!takes.has(key)) continue;

  const source = takes.get(key);
  const ceiling = CEILINGS[key];
  const rawDuration = probeDuration(source);

  if (!Number.isFinite(rawDuration)) {
    console.log(`  ${key.padEnd(19)}  UNREADABLE — ffprobe could not read ${basename(source)}`);
    rejected += 1;
    continue;
  }

  // THE HARD GATE. Trimming edge silence can only remove up to ~200 ms, so a
  // take meaningfully over its ceiling cannot be brought inside it and is not
  // going to be squeezed.
  if (rawDuration > ceiling + SPEC.maxEdgeSilence * 2) {
    console.log(
      `  ${key.padEnd(19)}  ${rawDuration.toFixed(2).padStart(6)}  ` +
      `${String(ceiling).padStart(6)}s       —       —       —  ` +
      `REJECTED, over by ${(rawDuration - ceiling).toFixed(2)}s`
    );
    rejected += 1;
    continue;
  }

  const master = join(OUT, `${key}.m4a`);

  // Trim edge silence, normalise, then encode. Order matters: trimming after
  // normalising would change the measured loudness of what is kept.
  const filter = [
    `silenceremove=start_periods=1:start_silence=${SPEC.maxEdgeSilence}:start_threshold=${SPEC.silenceThresholdDb}dB`,
    `areverse`,
    `silenceremove=start_periods=1:start_silence=${SPEC.maxEdgeSilence}:start_threshold=${SPEC.silenceThresholdDb}dB`,
    `areverse`,
    `loudnorm=I=${SPEC.loudness}:TP=${SPEC.truePeak}:LRA=7`,
    `aresample=${SPEC.sampleRate}`,
  ].join(',');

  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', source,
      '-af', filter,
      '-c:a', 'aac', '-profile:a', 'aac_low',
      '-b:a', SPEC.bitrate,
      '-ar', String(SPEC.sampleRate),
      '-ac', String(SPEC.channels),
      master,
    ],
    { encoding: 'utf8' }
  );

  if (r.status !== 0) {
    console.log(`  ${key.padEnd(19)}  CONVERSION FAILED`);
    if (r.stderr) console.log(`    ${r.stderr.trim().split('\n').slice(-1)[0]}`);
    rejected += 1;
    continue;
  }

  const finalDuration = probeDuration(master);
  const loud = measure(master);

  // Trimming can only shorten, but check rather than assume.
  if (finalDuration > ceiling) {
    console.log(
      `  ${key.padEnd(19)}  ${rawDuration.toFixed(2).padStart(6)}  ` +
      `${String(ceiling).padStart(6)}s  ${finalDuration.toFixed(2).padStart(6)}  ` +
      `—       —  REJECTED, still over after trim`
    );
    rejected += 1;
    continue;
  }

  const loudOk =
    loud && Math.abs(loud.i - SPEC.loudness) <= SPEC.loudnessTolerance && loud.tp <= SPEC.truePeak;

  console.log(
    `  ${key.padEnd(19)}  ${rawDuration.toFixed(2).padStart(6)}  ` +
    `${String(ceiling).padStart(6)}s  ${finalDuration.toFixed(2).padStart(6)}  ` +
    `${loud ? loud.i.toFixed(1).padStart(6) : '  SKIP'}  ` +
    `${loud ? loud.tp.toFixed(1).padStart(6) : '  SKIP'}  ` +
    `${loud ? (loudOk ? 'ok' : 'OUT OF SPEC') : 'UNMEASURED'}`
  );

  if (!loud) rejected += 1;
  else if (!loudOk) rejected += 1;
  else written += 1;
}

// --- what is still outstanding --------------------------------------------
if (missing.length) {
  console.log('\n  Not yet recorded:');
  for (const key of missing) {
    console.log(`    ${key.padEnd(19)} ceiling ${String(CEILINGS[key]).padStart(2)}s`);
  }
}

console.log(`\n  ${written} master(s) written, ${rejected} rejected.`);

if (written > 0) {
  console.log(
    `\n  Next: update duration_seconds in the manifest to the master lengths\n` +
    `  above, then validate:\n\n` +
    `    node scripts/modules-validate.mjs content/nervous-ready-tranche-1.draft.json \\\n` +
    `      --audio-dir ${OUT}\n`
  );
}

if (rejected > 0) {
  console.error(
    `  Rejected takes were not written. Nothing is time-compressed to fit a\n` +
    `  ceiling: re-record rather than reprocess.\n`
  );
  process.exit(1);
}

console.log('');
