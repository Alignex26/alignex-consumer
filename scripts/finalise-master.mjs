#!/usr/bin/env node
//
// Turns ONE staged provider render into ONE production master rendition.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/finalise-master.mjs \
//     --module nr_arrive_short --locale en --voice warm [--commit]
//
// The second half of master generation. `generate-master` holds the ElevenLabs
// key and produces raw audio into `staging/`; this converts it to the audio
// production specification, measures it, and writes the rendition row.
//
// THE SPLIT IS WHERE THE CONSTRAINT IS. Meeting the specification means
// measuring and re-encoding, which means ffmpeg, which cannot run in a Deno Edge
// Function. So the provider key stays in Supabase and never reaches a laptop,
// and the ffmpeg work happens where ffmpeg exists. Neither half can do the
// other's job.
//
// NO ELEVENLABS KEY IS NEEDED HERE. This talks to storage and the database, not
// to a provider.
//
// ONE AT A TIME, ON PURPOSE. Module, locale and voice are all required and all
// singular. Bulk generation is a later decision: it is much easier to spend
// money by accident with a loop than with a command that does one thing.
//
// DRY RUN BY DEFAULT. Without `--commit` nothing is uploaded and no row is
// written.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { masterToSpecification, ffmpegVersion } from './lib/mastering.mjs';

const args = process.argv.slice(2);
const pick = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const moduleKey = pick('--module');
const locale = pick('--locale', 'en');
const voice = pick('--voice');
const commit = args.includes('--commit');

/**
 * PACING TEST MODE.
 *
 * `--speed 0.88` finalises a paced render instead of a production one. It reads
 * from the isolated staging path that `generate-master` wrote the paced audio
 * to, writes the master under `pacing/`, and writes NO rendition row.
 *
 * There is deliberately no way to point this at a production path: the source
 * path, the destination path and the decision to skip the rendition all follow
 * from the same flag, so a pacing test cannot overwrite an approved master by
 * being invoked slightly wrong.
 */
const speed = pick('--speed');
const pacing = speed !== null;

const BUCKET = 'intervention-audio';

/** From the approved manifest. Hard, and a property of the recipe. */
const CEILINGS = {
  nr_arrive_short: 21,
  nr_regulate_short: 45,
  nr_reframe_short: 40,
  nr_prepare_short: 45,
  nr_close_short: 11,
};

if (!moduleKey || !voice) {
  console.error(
    '\n  usage: node scripts/finalise-master.mjs --module <key> --locale <id> --voice <profile> [--commit]\n' +
    '\n  All three are required and singular. Bulk generation is deliberately not\n' +
    '  offered: it is much easier to spend money by accident with a loop.\n'
  );
  process.exit(2);
}

if (!(moduleKey in CEILINGS)) {
  console.error(`\n  Unknown module "${moduleKey}".\n`);
  process.exit(2);
}

const ok = (b) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0;
if (!ok('ffmpeg') || !ok('ffprobe')) {
  console.error('\n  ffmpeg and ffprobe are required. Nothing was done.\n');
  process.exit(2);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL is not set.\n');
  process.exit(2);
}
if (!serviceKey) {
  console.error(
    '\n  SUPABASE_SERVICE_ROLE_KEY is required.\n' +
    '  Pass it in the environment for this one command; do not add it to .env.\n' +
    '\n  No ElevenLabs key is needed here — that one stays in Supabase.\n'
  );
  process.exit(2);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

const rest = async (path, init = {}) => {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { ...headers, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text };
};

console.log(`\n  ${commit ? 'FINALISE' : 'DRY RUN'} — ${moduleKey} / ${locale} / ${voice}\n`);

// --- the approved version --------------------------------------------------
const moduleResult = await rest(
  `/rest/v1/intervention_modules?module_key=eq.${encodeURIComponent(moduleKey)}&select=id`
);
const modules = moduleResult.ok ? JSON.parse(moduleResult.body) : [];
if (modules.length === 0) {
  console.error(`  No module "${moduleKey}" exists. Import it before generating audio for it.\n`);
  process.exit(1);
}
const moduleId = modules[0].id;

const versionResult = await rest(
  `/rest/v1/intervention_module_versions` +
  `?module_id=eq.${moduleId}&locale=eq.${encodeURIComponent(locale)}` +
  `&select=id,version,approved_at,withdrawn_at&order=version.desc&limit=1`
);
const versions = versionResult.ok ? JSON.parse(versionResult.body) : [];
if (versions.length === 0) {
  console.error(`  No ${locale} content version for ${moduleKey}.\n`);
  process.exit(1);
}
const version = versions[0];

if (version.withdrawn_at !== null) {
  console.error(`  Version ${version.version} is withdrawn. Nothing was done.\n`);
  process.exit(1);
}
if (version.approved_at === null) {
  console.error(
    `  Version ${version.version} is not approved content. Content approval comes\n` +
    `  before audio, always.\n`
  );
  process.exit(1);
}

const speedTag = pacing ? String(speed).replace('.', '_') : null;

const staging = pacing
  ? `staging/pacing/${locale}/${voice}/${moduleKey}.v${version.version}.s${speedTag}.mp3`
  : `staging/${locale}/${voice}/${moduleKey}.v${version.version}.mp3`;

const masterPath = pacing
  ? `pacing/${locale}/${voice}/${moduleKey}.s${speedTag}.m4a`
  : `modules/${locale}/${voice}/${moduleKey}.m4a`;
const ceiling = CEILINGS[moduleKey];

if (pacing) {
  console.log(`  PACING TEST    speed ${speed} — no rendition row will be written,`);
  console.log(`                 and the approved master is not written to.\n`);
}
console.log(`  version        ${version.version} (approved)`);
console.log(`  staged at      ${staging}`);
console.log(`  master path    ${masterPath}`);
console.log(`  ceiling        ${ceiling}s\n`);

// --- fetch the staged render -----------------------------------------------
const download = await fetch(`${url}/storage/v1/object/${BUCKET}/${staging}`, { headers });
if (!download.ok) {
  console.error(
    `  No staged render at ${staging} (${download.status}).\n\n` +
    `  Generate it first:\n\n` +
    `    curl -X POST "$SUPABASE_URL/functions/v1/generate-master" \\\n` +
    `      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \\\n` +
    `      -H "Content-Type: application/json" \\\n` +
    `      -d '{"module_key":"${moduleKey}","locale":"${locale}","voice_profile":"${voice}"}'\n`
  );
  process.exit(1);
}

const work = mkdirSync(join(tmpdir(), `elsea-master-${Date.now()}`), { recursive: true });
const workDir = work ?? join(tmpdir(), `elsea-master-${Date.now()}`);
mkdirSync(workDir, { recursive: true });

const rawFile = join(workDir, 'raw.mp3');
const masterFile = join(workDir, 'master.m4a');
writeFileSync(rawFile, Buffer.from(await download.arrayBuffer()));

// --- master to specification ------------------------------------------------
//
// The loop lives in scripts/lib/mastering.mjs. It masters, encodes, MEASURES THE
// ENCODED FILE, and if the encoder pushed the true peak over the ceiling it aims
// lower and encodes again. The specification is identical at every attempt.
console.log('  mastering');
console.log(`    ffmpeg       ${ffmpegVersion()}`);

const run = masterToSpecification(rawFile, masterFile, ceiling);

if (run.failure === 'unmeasurable') {
  console.error('');
  console.error('  Could not measure the staged render. Nothing was written.');
  console.error('');
  process.exit(1);
}
if (run.failure === 'encode_failed') {
  console.error('');
  console.error('  Conversion failed.');
  console.error(`  ${run.stderr}`);
  console.error('');
  process.exit(1);
}

const measured = run.measured;
console.log(
  `    source       ${Number(measured.input_i).toFixed(2)} LUFS, ` +
  `${Number(measured.input_tp).toFixed(2)} dBTP, LRA ${measured.input_lra}`
);

for (const attempt of run.attempts) {
  const said = attempt.claimed === null
    ? 'unreadable'
    : `${attempt.claimed.normalizationType} ${attempt.claimed.outputTruePeak.toFixed(2)}`;
  console.log(
    `    aim ${String(attempt.aim).padStart(5)}    loudnorm ${said.padEnd(16)} ` +
    `encoded ${attempt.result.lufs.toFixed(2)} LUFS / ${attempt.result.peak.toFixed(2)} dBTP` +
    `${attempt.problems.length === 0 ? '   OK' : ''}`
  );
}

if (run.attempts.length > 1 && run.ok) {
  console.log('');
  console.log(`    The encoder added ${(run.attempts[0].result.peak - run.attempts[0].aim).toFixed(2)} dB of`);
  console.log(`    true peak at the first aim, so mastering aimed lower. Loudness is`);
  console.log(`    unchanged in target and was re-checked on every attempt.`);
}

const result = run.result;
const { duration } = result;
const problems = run.problems;

console.log('  measured');
console.log(`    duration     ${Number.isFinite(duration) ? duration.toFixed(2) + 's' : 'UNMEASURED'}  (ceiling ${ceiling}s)`);
console.log(`    codec        ${result.codec ?? '\u2014'}`);
console.log(`    sample rate  ${result.sampleRate}`);
console.log(`    channels     ${result.channels}`);
console.log(`    bitrate      ${Number.isFinite(result.bitrate) ? Math.round(result.bitrate / 1000) + 'k' : '\u2014'}`);
console.log(`    loudness     ${Number.isFinite(result.lufs) ? result.lufs.toFixed(2) + ' LUFS' : 'UNMEASURED'}`);
console.log(`    true peak    ${Number.isFinite(result.peak) ? result.peak.toFixed(2) + ' dBTP' : 'UNMEASURED'}`);

// --- gates ------------------------------------------------------------------
if (problems.length > 0) {
  console.error(`\n  REJECTED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`    - ${p}`);
  console.error(
    `\n  Nothing was uploaded and no rendition row was written.\n` +
    `\n  Every true-peak aim down to the limit of the ladder was tried; loudness is\n` +
    `  re-checked at each one, so the run stops rather than publish something quiet.\n` +
    `  A take that runs long is re-generated, not compressed to fit.\n`
  );
  process.exit(1);
}

console.log('\n  PASS — meets the production specification.');

if (!commit) {
  console.log('\n  Dry run. Nothing uploaded, no rendition written.');
  console.log('  Re-run with --commit to publish.\n');
  process.exit(0);
}

// --- publish ----------------------------------------------------------------
const upload = await fetch(`${url}/storage/v1/object/${BUCKET}/${masterPath}`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'audio/mp4', 'x-upsert': 'true' },
  body: readFileSync(masterFile),
});

if (!upload.ok && upload.status !== 409) {
  console.error(`\n  Upload failed: ${upload.status}\n`);
  process.exit(1);
}

if (pacing) {
  console.log('\n  Pacing test finalised. No rendition row was written and no approved');
  console.log('  master was touched.\n');
  console.log(`  Listen with a short-lived signed URL for:\n    ${masterPath}\n`);
  process.exit(0);
}

// APPROVED = FALSE, ALWAYS. Synthesis is not approval, and a successful render
// is not a decision that the recording is good enough to play to somebody.
const rendition = await rest(
  '/rest/v1/module_renditions?on_conflict=module_id,locale,version,voice_profile',
  {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{
      module_id: moduleId,
      version: version.version,
      locale,
      voice_profile: voice,
      storage_path: masterPath,
      duration_seconds: Math.round(duration),
      approved: false,
      approved_at: null,
      updated_at: new Date().toISOString(),
    }]),
  }
);

if (!rendition.ok) {
  console.error(`\n  Rendition row failed: ${rendition.status}\n  ${rendition.body}\n`);
  process.exit(1);
}

console.log(
  `\n  Published to ${masterPath}\n` +
  `  Rendition written with approved = false.\n\n` +
  `  IT WILL NOT PLAY UNTIL SOMEBODY APPROVES IT. Listen to it, then:\n\n` +
  `    update module_renditions set approved = true, approved_at = now()\n` +
  `     where module_id = '${moduleId}' and locale = '${locale}'\n` +
  `       and voice_profile = '${voice}' and version = ${version.version};\n`
);
