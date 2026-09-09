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
const audioDirIndex = args.indexOf('--audio-dir');
const audioDir = audioDirIndex >= 0 ? args[audioDirIndex + 1] : null;

const BUCKET = 'intervention-audio';

if (!manifestPath) {
  console.error('usage: node scripts/modules-import.mjs <manifest.json> --audio-dir <dir> [--commit]');
  process.exit(2);
}

// --- validate first, always ------------------------------------------------
console.log('\n  Validating before anything is touched...');
try {
  execFileSync(
    process.execPath,
    ['scripts/modules-validate.mjs', manifestPath, ...(audioDir ? ['--audio-dir', audioDir] : [])],
    { stdio: 'inherit' }
  );
} catch {
  console.error('  Validation failed. Nothing was imported.\n');
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
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${p.path}`, {
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

console.log(`\n  Uploaded ${uploaded} file(s). Wrote ${rows.length} module row(s).`);
console.log(`  ${approvedCount} are approved and therefore selectable.\n`);
