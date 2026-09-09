#!/usr/bin/env node
//
// TEST-ONLY placeholder voice files, so the session flow can be exercised
// before approved masters exist.
//
//   node scripts/generate-placeholder-voice.mjs [--out <dir>] [--force]
//
// ===========================================================================
// THESE ARE NOT INTERVENTION CONTENT AND MUST NEVER BE TREATED AS SUCH.
//
// They do not speak the approved scripts. That is deliberate: audio that
// sounds like real ELSEA content is precisely the thing that must not escape
// into a bucket, a build or a demo. Each file says out loud, repeatedly, that
// it is placeholder audio and not approved content.
//
// Nothing is lost by that. What the flow needs proving is timing, sequencing,
// phase progression, the sound layer, pause, resume, early exit and outcome —
// none of which depends on the words being real.
//
// The output directory is git-ignored. These files must not be committed and
// must not be uploaded to the private bucket alongside real masters.
// ===========================================================================
//
// They ARE generated to the real production specification — AAC-LC, 44.1 kHz,
// mono, 96 kbps, -16 LUFS, -1 dBTP, no long silences — so that the real
// validator accepts them and the import path is exercised honestly rather than
// with checks disabled.

import { existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUT = outIndex >= 0 ? args[outIndex + 1] : join('content', 'placeholder-audio');
const force = args.includes('--force');

/** Must match content/nervous-ready-tranche-1.draft.json. */
const MODULES = [
  { key: 'nr_arrive_short', seconds: 21, phase: 'arrive' },
  { key: 'nr_regulate_short', seconds: 45, phase: 'regulate' },
  { key: 'nr_reframe_short', seconds: 40, phase: 'reframe' },
  { key: 'nr_prepare_short', seconds: 45, phase: 'prepare' },
  { key: 'nr_close_short', seconds: 11, phase: 'close' },
];

const SPEC = {
  sampleRate: 44100,
  channels: 1,
  bitrate: '96k',
  loudness: -16,
  truePeak: -1,
};

function have(binary) {
  return spawnSync(binary, ['-version'], { stdio: 'ignore' }).status === 0;
}

if (!have('ffmpeg') || !have('ffprobe')) {
  console.error('\n  ffmpeg and ffprobe are required. Nothing was written.\n');
  process.exit(2);
}

const hasFlite =
  spawnSync('ffmpeg', ['-hide_banner', '-f', 'lavfi', '-i', "flite=text='x':voice=slt",
    '-t', '0.1', '-f', 'null', '-'], { stdio: 'ignore' }).status === 0;

if (!hasFlite) {
  console.error(
    '\n  This ffmpeg build has no libflite, so speech cannot be synthesised.\n' +
    '  Nothing was written. A tone would not exercise anything a silence\n' +
    '  cue does not already exercise.\n'
  );
  process.exit(2);
}

mkdirSync(OUT, { recursive: true });

/**
 * The spoken marker.
 *
 * Said once takes a few seconds; it is looped to fill the module's duration so
 * there is speech throughout rather than a short phrase and a long silence.
 * Long silence would fail the production spec, and would also make the flow
 * test less useful — a module that is mostly quiet cannot show whether the bed
 * ducked under it.
 */
const marker = (phase) =>
  `Placeholder audio. Not approved content. ${phase} module. ` +
  `This is a test file and must not be released.`;

console.log(`\n  TEST-ONLY placeholder voice into ${OUT}\n`);
console.log('  module               target  actual   LUFS    dBTP   ch  rate');
console.log('  -------------------  ------  ------  ------  ------  --  -----');

let failures = 0;

for (const m of MODULES) {
  const file = join(OUT, `${m.key}.m4a`);

  if (existsSync(file) && !force) {
    console.log(`  ${m.key.padEnd(19)}  exists, skipped (--force to rebuild)`);
    continue;
  }

  const text = marker(m.phase).replace(/'/g, '');

  // Speak, loop to cover the duration, trim to exactly the duration, then
  // normalise. Trimming before loudnorm keeps the measured length exact.
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `flite=text='${text}':voice=slt`,
      '-af',
      `aloop=loop=-1:size=2e9,atrim=0:${m.seconds},asetpts=N/SR/TB,` +
      `loudnorm=I=${SPEC.loudness}:TP=${SPEC.truePeak}:LRA=7,` +
      `aresample=${SPEC.sampleRate}`,
      '-t', String(m.seconds),
      '-c:a', 'aac', '-profile:a', 'aac_low',
      '-b:a', SPEC.bitrate,
      '-ar', String(SPEC.sampleRate),
      '-ac', String(SPEC.channels),
      file,
    ],
    { encoding: 'utf8' }
  );

  if (r.status !== 0) {
    console.error(`\n  ${m.key} failed:\n${r.stderr ?? ''}\n`);
    failures += 1;
    continue;
  }

  // Measure what was actually produced. Declared and real must agree within
  // 0.25s or the real validator rejects the file, which is the point.
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=channels,sample_rate:format=duration',
     '-of', 'json', file],
    { encoding: 'utf8' }
  );

  let duration = NaN, channels = '?', rate = '?';
  try {
    const info = JSON.parse(probe.stdout);
    duration = Number(info.format?.duration);
    channels = info.streams?.[0]?.channels ?? '?';
    rate = info.streams?.[0]?.sample_rate ?? '?';
  } catch {
    // Reported as unknown below rather than guessed at.
  }

  const loud = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const text2 = `${loud.stderr ?? ''}`;
  const s = text2.lastIndexOf('{');
  const e = text2.indexOf('}', s);
  let i = NaN, tp = NaN;
  if (s >= 0 && e > s) {
    try {
      const parsed = JSON.parse(text2.slice(s, e + 1));
      i = Number(parsed.input_i);
      tp = Number(parsed.input_tp);
    } catch {
      // Left as NaN and printed as unknown.
    }
  }

  const drift = Math.abs(duration - m.seconds);
  const ok = drift <= 0.25;
  if (!ok) failures += 1;

  console.log(
    `  ${m.key.padEnd(19)}  ${String(m.seconds).padStart(5)}s  ` +
    `${duration.toFixed(2).padStart(6)}  ` +
    `${Number.isFinite(i) ? i.toFixed(1).padStart(6) : '     ?'}  ` +
    `${Number.isFinite(tp) ? tp.toFixed(1).padStart(6) : '     ?'}  ` +
    `${String(channels).padStart(2)}  ${String(rate).padStart(5)}` +
    `${ok ? '' : `   DRIFT ${drift.toFixed(2)}s`}`
  );
}

if (failures > 0) {
  console.error(`\n  ${failures} file(s) failed or drifted. Not usable as-is.\n`);
  process.exit(1);
}

console.log(
  `\n  TEST FILES ONLY. They say so out loud, they are git-ignored, and they\n` +
  `  must never be uploaded to the private bucket or marked approved in\n` +
  `  production. Delete them with:  rm -rf ${OUT}\n`
);
