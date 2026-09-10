#!/usr/bin/env node
//
// Validates a proposed intervention-module import BEFORE anything touches the
// database or the private bucket.
//
//   node scripts/modules-validate.mjs <manifest.json> [--audio-dir <dir>]
//
// The manifest is a JSON array of module records. Audio files are optional at
// this stage: without them the media checks report SKIPPED, never PASSED.
//
// Nothing here approves content. `approved` is carried through from the input
// exactly as given and is never inferred, defaulted or upgraded.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, basename } from 'node:path';

/** The twelve approved families. Must match `_shared/types.ts`. */
const FAMILIES = [
  'orient', 'regulate', 'ground', 'release', 'reframe', 'focus',
  'activate', 'prepare', 'transition', 'settle', 'sleep', 'close',
];

/** From docs/audio-production-spec.md. */
const AUDIO = {
  codec: 'aac',
  container: 'm4a',
  sampleRate: 44100,
  channels: 1,
  bitrateMin: 64_000,
  bitrateMax: 128_000,
  loudnessTarget: -16,
  loudnessTolerance: 1,
  truePeakCeiling: -1,
  durationToleranceSeconds: 0.25,
};

const STORAGE_PATH = /^modules\/[a-z]+\/[a-z0-9_]+\.m4a$/;

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith('--'));
const audioDirIndex = args.indexOf('--audio-dir');
const audioDir = audioDirIndex >= 0 ? args[audioDirIndex + 1] : null;

if (!manifestPath) {
  console.error('usage: node scripts/modules-validate.mjs <manifest.json> [--audio-dir <dir>]');
  process.exit(2);
}

const problems = [];
const skipped = [];
const fail = (key, message) => problems.push(`${key}: ${message}`);

let modules;
try {
  modules = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`\n  Could not read ${manifestPath}: ${error.message}\n`);
  process.exit(2);
}

if (!Array.isArray(modules)) {
  console.error('\n  Manifest must be a JSON array of module records.\n');
  process.exit(2);
}

// --- ffprobe, if available -------------------------------------------------
let hasFfprobe = false;
try {
  execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  hasFfprobe = true;
} catch {
  skipped.push('ffprobe not found — codec, sample rate, channels, bitrate and duration unchecked');
}

let hasFfmpeg = false;
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  hasFfmpeg = true;
} catch {
  skipped.push('ffmpeg not found — loudness and true-peak unchecked');
}

function probe(file) {
  const raw = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration,format_name',
     '-of', 'json', file],
    { encoding: 'utf8' }
  );
  return JSON.parse(raw);
}

function loudness(file) {
  // ffmpeg writes the loudnorm JSON summary to stderr, and — this is the part
  // that was wrong — it writes it on a SUCCESSFUL run. `-f null -` analyses and
  // exits 0.
  //
  // The previous version only parsed stderr inside a catch block, so the
  // success path returned null every time and every file was reported as
  // "loudness could not be measured". The check had never executed. It failed
  // honestly rather than silently, which is the only reason it was survivable,
  // but it meant the loudness and true-peak limits in the audio spec were
  // never enforced on anything.
  //
  // spawnSync rather than execFileSync because stderr is needed on success,
  // and execFileSync returns only stdout.
  const result = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );

  const text = `${result.stderr ?? ''}`;
  const start = text.lastIndexOf('{');
  if (start < 0) return null;

  // Slice to the CLOSING brace, not to the end of stderr. ffmpeg writes
  // progress and muxing lines after the JSON summary, and including them made
  // JSON.parse throw — which the catch below then swallowed as "could not be
  // measured", indistinguishable from ffmpeg being absent.
  const end = text.indexOf('}', start);
  if (end < 0) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const integrated = Number(parsed.input_i);
    const truePeak = Number(parsed.input_tp);
    // A digitally silent file reports -inf, which is not a measurement.
    if (!Number.isFinite(integrated) || !Number.isFinite(truePeak)) return null;
    return { integrated, truePeak };
  } catch {
    return null;
  }
}

// --- structural checks -----------------------------------------------------
const seenKeys = new Set();

for (const [index, m] of modules.entries()) {
  const key = m?.module_key ?? `#${index}`;

  if (!m || typeof m !== 'object') { fail(key, 'not an object'); continue; }

  // Identity
  if (typeof m.module_key !== 'string' || !/^[a-z0-9_]+$/.test(m.module_key)) {
    fail(key, 'module_key must be lower-case letters, digits and underscores');
  }
  if (seenKeys.has(m.module_key)) fail(key, 'duplicate module_key in this manifest');
  seenKeys.add(m.module_key);

  // Family
  if (!FAMILIES.includes(m.family)) {
    fail(key, `family "${m.family}" is not one of the twelve approved families`);
  }

  // Clinical fields — required, never invented here.
  if (typeof m.technique_key !== 'string' || m.technique_key.trim() === '') {
    fail(key, 'technique_key is required and must come from clinical authoring');
  }
  if (m.technique_key === 'CONTENT_AUTHORING_REQUIRED') {
    fail(key, 'technique_key is still the placeholder — content has not been authored');
  }

  // Duration
  if (!Number.isInteger(m.duration_seconds) || m.duration_seconds <= 0) {
    fail(key, 'duration_seconds must be a positive integer');
  }

  // Intensity — carried, not interpreted. See docs: non-operative in V1.
  if (m.intensity !== undefined && (!Number.isInteger(m.intensity) || m.intensity < 1 || m.intensity > 10)) {
    fail(key, 'intensity, if given, must be an integer 1-10');
  }

  // Storage — must be a private-bucket object key, never a URL.
  if (typeof m.storage_path !== 'string' || !STORAGE_PATH.test(m.storage_path)) {
    fail(key, 'storage_path must match modules/<family>/<key>.m4a — never a URL or public path');
  } else if (m.family && !m.storage_path.startsWith(`modules/${m.family}/`)) {
    fail(key, `storage_path does not sit under its own family (${m.family})`);
  }
  if (typeof m.storage_path === 'string' && /^https?:|^\/|\.\./.test(m.storage_path)) {
    fail(key, 'storage_path must not be absolute, a URL, or contain traversal');
  }

  // Approval — carried through exactly. Never defaulted to true.
  if (typeof m.approved !== 'boolean') {
    fail(key, 'approved must be explicitly true or false');
  }

  // Script — the approved localised wording.
  //
  // Required, because it is what a server-side generator will speak. Without it
  // the only way to synthesise a master is to hand text to an endpoint, and an
  // endpoint that accepts text and speaks it can say anything.
  if (typeof m.script_text !== 'string' || m.script_text.trim() === '') {
    fail(key, 'script_text is required — the approved wording, exactly as approved');
  } else if (m.script_text.trim() !== m.script_text) {
    fail(key, 'script_text has leading or trailing whitespace');
  } else if (/CONTENT_AUTHORING_REQUIRED|TODO|TBD|PLACEHOLDER|Lorem/i.test(m.script_text)) {
    fail(key, 'script_text still contains a placeholder — content has not been authored');
  }

  // Version — how replacement audio is published. Optional (a first import is
  // version 1), but if given it must be a positive integer, because it becomes
  // an immutable history row and part of a saved session's identity.
  if (m.version !== undefined && (!Number.isInteger(m.version) || m.version < 1)) {
    fail(key, 'version, if given, must be a positive integer');
  }

  // --- media ---------------------------------------------------------------
  if (!audioDir) continue;
  const file = join(audioDir, basename(m.storage_path ?? ''));
  if (!existsSync(file)) {
    if (m.approved) fail(key, `approved module has no audio file at ${file}`);
    continue;
  }

  if (statSync(file).size === 0) { fail(key, 'audio file is empty'); continue; }

  if (hasFfprobe) {
    try {
      const info = probe(file);
      const stream = info.streams?.[0] ?? {};
      if (stream.codec_name !== AUDIO.codec) fail(key, `codec is ${stream.codec_name}, expected ${AUDIO.codec}`);
      if (Number(stream.sample_rate) !== AUDIO.sampleRate) fail(key, `sample rate is ${stream.sample_rate}, expected ${AUDIO.sampleRate}`);
      if (Number(stream.channels) !== AUDIO.channels) fail(key, `${stream.channels} channels, expected mono`);
      const bitrate = Number(stream.bit_rate);
      if (bitrate && (bitrate < AUDIO.bitrateMin || bitrate > AUDIO.bitrateMax)) {
        fail(key, `bitrate ${Math.round(bitrate / 1000)}kbps outside ${AUDIO.bitrateMin / 1000}-${AUDIO.bitrateMax / 1000}`);
      }
      const actual = Number(info.format?.duration);
      if (Number.isFinite(actual) && Math.abs(actual - m.duration_seconds) > AUDIO.durationToleranceSeconds) {
        fail(key, `audio is ${actual.toFixed(2)}s but metadata says ${m.duration_seconds}s`);
      }
    } catch (error) {
      fail(key, `could not probe audio: ${error.message}`);
    }
  }

  if (hasFfmpeg) {
    const measured = loudness(file);
    if (!measured) {
      skipped.push(`${key}: loudness could not be measured`);
    } else {
      const drift = Math.abs(measured.integrated - AUDIO.loudnessTarget);
      if (drift > AUDIO.loudnessTolerance) {
        fail(key, `integrated loudness ${measured.integrated.toFixed(1)} LUFS, target ${AUDIO.loudnessTarget} +/- ${AUDIO.loudnessTolerance}`);
      }
      if (measured.truePeak > AUDIO.truePeakCeiling) {
        fail(key, `true peak ${measured.truePeak.toFixed(1)} dBTP exceeds ${AUDIO.truePeakCeiling}`);
      }
    }
  }
}

// --- report ----------------------------------------------------------------
console.log(`\n  ${modules.length} module record(s) checked from ${manifestPath}`);
if (audioDir) console.log(`  audio from ${audioDir}`);

if (skipped.length) {
  console.log(`\n  SKIPPED (not passed — simply not checked):`);
  for (const s of skipped) console.log(`    - ${s}`);
}

if (problems.length === 0) {
  // A pass with skipped media checks is NOT the same as a pass. Without
  // ffprobe the only thing verified about a file is that it exists and is not
  // empty — a text file renamed `.m4a` gets through. Saying "nothing blocking
  // import" there contradicts this script's own principle that a skipped check
  // is never reported as a pass, and it is how non-conforming audio would
  // reach the private bucket and fail on someone's device.
  //
  // Exit 2 means: the records are valid, and the audio was not verified.
  // The importer refuses to --commit on 2 unless explicitly overridden.
  if (audioDir && skipped.length > 0) {
    console.log(
      `\n  INCOMPLETE — records are valid, but the audio itself was NOT verified.` +
      `\n  Install ffmpeg and re-run before importing, or import with` +
      `\n  --allow-unverified-audio if you accept unchecked masters.\n`
    );
    process.exit(2);
  }

  console.log(`\n  PASS — nothing blocking import.\n`);
  process.exit(0);
}

console.error(`\n  FAIL — ${problems.length} problem(s):`);
for (const p of problems) console.error(`    - ${p}`);
console.error('');
process.exit(1);
