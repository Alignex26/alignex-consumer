#!/usr/bin/env node
//
// Read-only forensics on ONE staged provider render.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/inspect-staged.mjs \
//     --module nr_arrive_short --locale en --voice clear
//
// WRITES NOTHING. No upload, no database row, no provider call. It downloads the
// staged object to a temporary directory, identifies it, measures it, and dry-runs
// the real mastering chain over it so the numbers can be compared against what
// finalise-master reports.
//
// WHY THIS EXISTS. A master came back at +1.44 dBTP against a -1.5 dBTP mastering
// target, and every explanation offered for it was guesswork, because nothing in
// the pipeline printed enough to test one. The first theory -- that the staged
// render was stereo and the encoder's downmix was moving peaks after the limiter
// -- was plausible, arithmetically tidy, and WRONG: this tool established that
// the file is mono, 44.1 kHz, and measures identically downmixed.
//
// So it prints what a hypothesis can be checked against: the object's hash and
// size, what the file actually is, its untouched measurements, the exact pass-2
// filter, what loudnorm SAYS it achieved, and what would be published. Run it
// before believing any explanation of a mastering result -- including mine.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFORM, SPEC, masterToSpecification, ffmpegVersion } from './lib/mastering.mjs';

const args = process.argv.slice(2);
const pick = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const moduleKey = pick('--module');
const locale = pick('--locale', 'en');
const voice = pick('--voice');
const version = pick('--version', '1');

const BUCKET = 'intervention-audio';

const CEILINGS = {
  nr_arrive_short: 21,
  nr_regulate_short: 45,
  nr_reframe_short: 40,
  nr_prepare_short: 45,
  nr_close_short: 11,
};

if (!moduleKey || !voice) {
  console.error(
    '\n  usage: node scripts/inspect-staged.mjs --module <key> --locale <id> --voice <profile> [--version N]\n'
  );
  process.exit(2);
}

const ok = (b) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0;
if (!ok('ffmpeg') || !ok('ffprobe')) {
  console.error('\n  ffmpeg and ffprobe are required.\n');
  process.exit(2);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n');
  process.exit(2);
}

const staging = `staging/${locale}/${voice}/${moduleKey}.v${version}.mp3`;
const ceiling = CEILINGS[moduleKey] ?? 21;

console.log(`\n  INSPECT (read-only) — ${moduleKey} / ${locale} / ${voice} / v${version}\n`);
console.log(`  ffmpeg         ${ffmpegVersion()}`);
console.log(`  bucket         ${BUCKET}`);
console.log(`  object         ${staging}`);

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const download = await fetch(`${url}/storage/v1/object/${BUCKET}/${staging}`, { headers });

if (!download.ok) {
  console.error(`\n  Not found (${download.status}). Nothing was changed.\n`);
  process.exit(1);
}

const workDir = join(tmpdir(), `elsea-inspect-${Date.now()}`);
mkdirSync(workDir, { recursive: true });
const rawFile = join(workDir, 'staged.mp3');
const bytes = Buffer.from(await download.arrayBuffer());
writeFileSync(rawFile, bytes);

// --- 1. identity ------------------------------------------------------------
console.log(`\n  1. IDENTITY`);
console.log(`     sha256       ${createHash('sha256').update(bytes).digest('hex')}`);
console.log(`     bytes        ${statSync(rawFile).size}`);
console.log(`     local copy   ${rawFile}`);

// --- 2. what it actually is -------------------------------------------------
const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries',
   'stream=codec_name,sample_rate,channels,channel_layout,bit_rate:format=duration,format_name',
   '-of', 'json', rawFile],
  { encoding: 'utf8' }
);
const info = JSON.parse(probe.stdout);
const stream = info.streams?.[0] ?? {};

console.log(`\n  2. AS DELIVERED BY THE PROVIDER`);
console.log(`     container    ${info.format?.format_name ?? '—'}`);
console.log(`     codec        ${stream.codec_name ?? '—'}`);
console.log(`     sample rate  ${stream.sample_rate ?? '—'}`);
console.log(`     channels     ${stream.channels ?? '—'}  (${stream.channel_layout ?? '—'})`);
console.log(`     bitrate      ${stream.bit_rate ? Math.round(Number(stream.bit_rate) / 1000) + 'k' : '—'}`);
console.log(`     duration     ${Number(info.format?.duration).toFixed(2)}s`);

/** Integrated loudness and true peak of a file, optionally pre-filtered. */
function measure(file, pre) {
  const af = `${pre ? pre + ',' : ''}loudnorm=print_format=json`;
  const run = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', af, '-f', 'null', '-'],
    { encoding: 'utf8' });
  const text = `${run.stderr ?? ''}`;
  const s = text.lastIndexOf('{');
  const e = text.indexOf('}', s);
  if (s < 0 || e <= s) return null;
  try {
    const j = JSON.parse(text.slice(s, e + 1));
    return { i: Number(j.input_i), tp: Number(j.input_tp) };
  } catch { return null; }
}

const asDelivered = measure(rawFile, null);
const asMono = measure(rawFile, 'aformat=channel_layouts=mono');

console.log(`\n  3. MEASURED, UNTOUCHED`);
console.log(`     as delivered            ${asDelivered.i.toFixed(2)} LUFS   ${asDelivered.tp.toFixed(2)} dBTP`);
console.log(`     downmixed to mono       ${asMono.i.toFixed(2)} LUFS   ${asMono.tp.toFixed(2)} dBTP`);

const shift = asMono.tp - asDelivered.tp;
if (Number(stream.channels) !== SPEC.channels) {
  console.log(`\n     >> the downmix moves the true peak by ${shift >= 0 ? '+' : ''}${shift.toFixed(2)} dB.`);
  console.log(`     >> ANY conversion after the limiter would move the peak by this much.`);
  console.log(`     >> The chain now conforms the format BEFORE loudnorm, so it cannot.`);
}

// --- 4. dry-run the real mastering chain ------------------------------------
console.log(`\n  4. THE REAL CHAIN, DRY RUN (nothing is uploaded)`);
console.log(`     conform      ${CONFORM}`);

const run = masterToSpecification(rawFile, join(workDir, 'master.m4a'), ceiling);

if (run.failure) {
  console.error(`\n     Mastering could not run: ${run.failure}. Nothing was changed.\n`);
  process.exit(1);
}

const measured = run.measured;
console.log(`     pass 1       input_i=${measured.input_i}  input_tp=${measured.input_tp}  ` +
            `input_lra=${measured.input_lra}  input_thresh=${measured.input_thresh}  ` +
            `offset=${measured.target_offset}`);
console.log(`     ceiling      ${SPEC.truePeak} dBTP, loudness ${SPEC.loudness} +/-${SPEC.loudnessTolerance}`);
console.log('');
console.log('     aim     loudnorm says            encoded AAC                overshoot');
for (const a of run.attempts) {
  const said = a.claimed === null
    ? 'unreadable'
    : `${a.claimed.normalizationType} ${a.claimed.outputTruePeak.toFixed(2)} dBTP`;
  const over = a.claimed === null ? '     ?' : (a.result.peak - a.claimed.outputTruePeak).toFixed(2);
  console.log(`     ${String(a.aim).padStart(5)}   ${said.padEnd(22)}   ` +
              `${a.result.lufs.toFixed(2)} LUFS / ${a.result.peak.toFixed(2)} dBTP   ` +
              `${String(over).padStart(6)} dB${a.problems.length === 0 ? '   OK' : ''}`);
}

console.log('');
console.log('     The overshoot column is what the ENCODER added, after loudnorm was');
console.log('     already done. It is the number this whole investigation turned on.');

const result = run.result;
const problems = run.problems;

console.log(`\n  5. WHAT WOULD BE PUBLISHED`);
console.log(`     aim used     ${run.aim ?? '\u2014'} dBTP`);
console.log(`     duration     ${result.duration.toFixed(2)}s  (ceiling ${ceiling}s)`);
console.log(`     codec        ${result.codec}`);
console.log(`     sample rate  ${result.sampleRate}`);
console.log(`     channels     ${result.channels}`);
console.log(`     bitrate      ${Number.isFinite(result.bitrate) ? Math.round(result.bitrate / 1000) + 'k' : '-'}`);
console.log(`     loudness     ${result.lufs.toFixed(2)} LUFS`);
console.log(`     true peak    ${result.peak.toFixed(2)} dBTP`);
console.log(`\n     ${problems.length === 0 ? 'PASS — meets the production specification.' : 'REJECTED:'}`);
for (const p of problems) console.log(`       - ${p}`);

console.log(`\n  Nothing was uploaded. No rendition row was written. The staged object is`);
console.log(`  untouched. Local copy left at ${workDir}\n`);
