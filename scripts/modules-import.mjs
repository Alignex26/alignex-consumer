#!/usr/bin/env node
//
// Imports approved intervention modules, and uploads their masters to the
// private bucket.
//
//   node scripts/modules-import.mjs <manifest.json> --audio-dir <dir> [--commit]
//
// DRY RUN BY DEFAULT. Without `--commit` nothing is written and nothing is
// uploaded; the script reports exactly what it would do. That is the intended
// way to use it — run it, read the plan, then run it again with `--commit`.
//
// It validates first and refuses to proceed on any failure, so the same checks
// that guard a review guard the import.
//
// REQUIRES a service-role key, because `intervention_modules` and the private
// bucket are service-role only. Supply it in the environment, never in a file:
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/modules-import.mjs ... --commit
//
// The key is never logged, never written, and never leaves this process.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith('--'));
const commit = args.includes('--commit');
const allowUnverified = args.includes('--allow-unverified-audio');
const voiceIndex = args.indexOf('--voice');
/**
 * Which narration voice these recordings are.
 *
 * The manifest is voice-agnostic on purpose: it describes the MODULE — the
 * technique, the wording, the approval — and all of that is identical across
 * voices. Only the recording differs, so the same manifest is imported once
 * per voice with a different --voice and a different audio folder.
 */
const voice = voiceIndex >= 0 ? args[voiceIndex + 1] : 'warm';

/**
 * Which language these recordings are in.
 *
 * BCP 47, and checked against a closed list. An unsupported identifier is
 * refused rather than passed through: the database would reject it at the
 * foreign key anyway, but failing here means failing before any upload rather
 * than halfway through one.
 */
const LOCALES = ['en', 'es', 'de', 'fr', 'pt-BR'];
const localeIndex = args.indexOf('--locale');
const locale = localeIndex >= 0 ? args[localeIndex + 1] : 'en';

if (!LOCALES.includes(locale)) {
  console.error(`
  Unsupported locale "${locale}". Known: ${LOCALES.join(', ')}
`);
  process.exit(2);
}

const VOICES = ['warm', 'clear', 'bright'];
if (!VOICES.includes(voice)) {
  console.error(`
  Unknown voice "${voice}". Known: ${VOICES.join(', ')}
`);
  process.exit(2);
}
const audioDirIndex = args.indexOf('--audio-dir');
const audioDir = audioDirIndex >= 0 ? args[audioDirIndex + 1] : null;

const BUCKET = 'intervention-audio';

/** modules/<family>/<key>.m4a  ->  modules/<voice>/<family>/<key>.m4a */
const renditionPath = (path, voiceId, localeId) =>
  path.replace(/^modules\//, `modules/${localeId}/${voiceId}/`);

if (!manifestPath) {
  console.error('usage: node scripts/modules-import.mjs <manifest.json> --audio-dir <dir> [--commit]');
  process.exit(2);
}

// --- validate first, always ------------------------------------------------
console.log('\n  Validating before anything is touched...');
let audioUnverified = false;
try {
  execFileSync(
    process.execPath,
    ['scripts/modules-validate.mjs', manifestPath, ...(audioDir ? ['--audio-dir', audioDir] : [])],
    { stdio: 'inherit' }
  );
} catch (error) {
  // Exit 2 is "records valid, audio not verified" — a real state, not a
  // failure. Anything else is a genuine validation failure.
  if (error?.status === 2) {
    audioUnverified = true;
  } else {
    console.error('  Validation failed. Nothing was imported.\n');
    process.exit(1);
  }
}

// A dry run may proceed unverified: it writes nothing, and seeing the plan is
// the point. A real import may not, because uploading unchecked masters is how
// a recorded tranche reaches a device and fails there.
if (audioUnverified && commit && !allowUnverified) {
  console.error(
    `\n  Refusing to import: the audio was never technically verified.\n` +
    `\n  Install ffmpeg and re-run, so codec, sample rate, channels, bitrate,\n` +
    `  duration, loudness and true peak are actually checked. Without it the\n` +
    `  only thing known about each file is that it exists and is not empty.\n` +
    `\n  If you genuinely accept unchecked masters, pass --allow-unverified-audio.\n`
  );
  process.exit(1);
}

const modules = JSON.parse(readFileSync(manifestPath, 'utf8'));

// --- credentials -----------------------------------------------------------
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL is not set.\n');
  process.exit(2);
}
if (commit && !serviceKey) {
  console.error(
    '\n  SUPABASE_SERVICE_ROLE_KEY is required to commit.\n' +
    '  Pass it in the environment for this one command; do not add it to .env,\n' +
    '  which is loaded into the app.\n'
  );
  process.exit(2);
}

async function rest(path, init = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text };
}

// --- plan ------------------------------------------------------------------
const plan = [];
for (const m of modules) {
  const file = audioDir ? join(audioDir, basename(m.storage_path)) : null;
  plan.push({
    key: m.module_key,
    family: m.family,
    seconds: m.duration_seconds,
    approved: m.approved === true,
    path: m.storage_path,
    audio: file && existsSync(file) ? file : null,
  });
}

console.log(`\n  ${commit ? 'IMPORT' : 'DRY RUN'} — ${plan.length} module(s)\n`);
console.log('  key                       family      dur   approved  audio');
for (const p of plan) {
  console.log(
    `  ${p.key.padEnd(25)} ${p.family.padEnd(11)} ${String(p.seconds).padStart(4)}s ` +
    `${(p.approved ? 'yes' : 'no').padEnd(9)} ${p.audio ? 'present' : 'MISSING'}`
  );
}

const approvedCount = plan.filter((p) => p.approved).length;
console.log(
  `\n  ${approvedCount} of ${plan.length} marked approved. ` +
  `Approval is taken from the input exactly as given and is never inferred.`
);

if (!commit) {
  console.log('\n  Dry run. Nothing written, nothing uploaded.');
  console.log('  Re-run with --commit to apply.\n');
  process.exit(0);
}

// --- upload, then insert ---------------------------------------------------
// Audio first: a row whose asset is missing would be selectable the moment it
// is approved, and the composer would fail the whole session signing it.
let uploaded = 0;
for (const p of plan) {
  if (!p.audio) {
    if (p.approved) {
      console.error(`\n  ${p.key} is approved but has no audio. Stopping before any write.\n`);
      process.exit(1);
    }
    continue;
  }

  const bytes = readFileSync(p.audio);
  // Renditions are filed by voice, so two recordings of the same module do not
  // collide: modules/<voice>/<family>/<key>.m4a
  const objectPath = renditionPath(p.path, voice, locale);
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'audio/mp4',
      'x-upsert': 'true',
    },
    body: bytes,
  });

  if (!response.ok && response.status !== 409) {
    console.error(`\n  Upload failed for ${p.key}: ${response.status} ${await response.text()}\n`);
    process.exit(1);
  }
  uploaded += 1;
}

// Idempotent: `module_key` is unique, so a re-run updates rather than
// duplicating. `approved` is written from the input, so a module can be
// withdrawn by re-importing it with approved:false.
const rows = modules.map((m) => ({
  module_key: m.module_key,
  family: m.family,
  technique_key: m.technique_key,
  storage_path: m.storage_path,
  duration_seconds: m.duration_seconds,
  intensity: m.intensity ?? 5,
  requires_headphones: m.requires_headphones === true,
  is_bed: m.is_bed === true,
  // Bumping this is how an author publishes replacement audio: the module row
  // is updated in place, and the previous version survives as its own
  // immutable row. Defaulting to 1 keeps a first import simple.
  version: m.version ?? 1,
  approved: m.approved === true,
  approved_at: m.approved === true ? new Date().toISOString() : null,
  updated_at: new Date().toISOString(),
}));

const result = await rest('/rest/v1/intervention_modules?on_conflict=module_key', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(rows),
});

if (!result.ok) {
  console.error(`\n  Insert failed: ${result.status}\n  ${result.body}\n`);
  process.exit(1);
}

// --- immutable version rows ------------------------------------------------
//
// WHY THIS IS NOT OPTIONAL. `intervention_modules` is a CURRENT pointer: the
// row is updated in place on re-import, so replacing a module's audio
// overwrites the only record of what the previous version was. A session saved
// against the old audio would then replay different content under the same
// name, which is precisely what "exact" must not mean.
//
// `intervention_module_versions` is the history, and it has to be written at
// the moment of import. It cannot be reconstructed later — once the module row
// has moved on, the old storage path and duration are simply gone.
//
// Append-only, so a re-import of an unchanged version is a duplicate and is
// ignored rather than being an error. Bumping `version` in the manifest is
// what publishes a new one.
const imported = JSON.parse(result.body);
// The script comes from the manifest, not from the returned row: it is content,
// and `intervention_modules` does not carry it. Matched by module_key so a
// reordered response cannot pair a script with the wrong module.
const scriptFor = new Map(modules.map((m) => [m.module_key, m.script_text]));

const versionRows = imported.map((row) => ({
  module_id: row.id,
  version: row.version,
  storage_path: row.storage_path,
  duration_seconds: row.duration_seconds,
  technique_key: row.technique_key,
  locale,
  // THE APPROVED WORDING. This is what a server-side generator will speak, so
  // it must be the approved text and nothing else. The validator has already
  // refused a manifest without it.
  script_text: scriptFor.get(row.module_key) ?? null,
  approved_at: row.approved ? row.approved_at : null,
}));

const missingScript = versionRows.filter((r) => !r.script_text);
if (missingScript.length > 0) {
  console.error(
    `
  ${missingScript.length} version row(s) would be written with no script.
` +
    `  A version with no wording cannot be generated from, and writing one now
` +
    `  would create an approved-looking row that nothing can speak.
`
  );
  process.exit(1);
}

const versionResult = await rest(
  '/rest/v1/intervention_module_versions?on_conflict=module_id,locale,version',
  {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(versionRows),
  }
);

if (!versionResult.ok) {
  console.error(
    `\n  Module rows were written, but the version history was not:\n` +
    `  ${versionResult.status} ${versionResult.body}\n\n` +
    `  Fix this before importing again. Without version rows an exact replay\n` +
    `  cannot be rebuilt, and re-importing will overwrite the only record of\n` +
    `  what the current audio was.\n`
  );
  process.exit(1);
}

const newVersions = JSON.parse(versionResult.body).length;

// --- renditions ------------------------------------------------------------
//
// One row per (module, version, voice). This is what the composer resolves to
// find the audio, and it is the reason a second voice does not fork the
// library: the module row, its technique, its wording and its approval are
// untouched by importing another recording.
//
// `approved` is copied from the manifest exactly as given, like everything
// else. A rendition of approved content is not itself approved until somebody
// says so.
const renditionRows = imported.map((row) => ({
  module_id: row.id,
  version: row.version,
  voice_profile: voice,
  locale,
  storage_path: renditionPath(row.storage_path, voice, locale),
  duration_seconds: row.duration_seconds,
  approved: row.approved === true,
  approved_at: row.approved ? row.approved_at : null,
  updated_at: new Date().toISOString(),
}));

const renditionResult = await rest(
  '/rest/v1/module_renditions?on_conflict=module_id,locale,version,voice_profile',
  {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(renditionRows),
  }
);

if (!renditionResult.ok) {
  console.error(
    `
  Module rows were written, but the ${voice} renditions were not:
` +
    `  ${renditionResult.status} ${renditionResult.body}

` +
    `  The modules exist with no audio attached for this voice, so the composer
` +
    `  will not select them. Fix and re-run.
`
  );
  process.exit(1);
}

console.log(`\n  Uploaded ${uploaded} file(s). Wrote ${rows.length} module row(s).`);
console.log(`  Recorded ${newVersions} new version row(s); ${versionRows.length - newVersions} already present.`);
console.log(`  ${approvedCount} are approved and therefore selectable.\n`);
