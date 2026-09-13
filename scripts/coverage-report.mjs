#!/usr/bin/env node
//
// What actually exists, across locale x voice x module.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/coverage-report.mjs
//   ... node scripts/coverage-report.mjs --locale en --json
//
// READ-ONLY. No upload, no database write, no provider call.
//
// WHY THIS EXISTS. The architectural target is 10 voices x 5 locales x 47
// modules = 2,350 renditions, and the single most expensive mistake available is
// manufacturing assets nobody has asked for. This answers the only questions
// worth acting on: what is approved, what is playable, and what is missing from
// the launch catalogue specifically.
//
// It reports COVERAGE, not progress. A module with wording but no audio is not
// 50% done — it is unplayable, and it is counted as unplayable.

import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const pick = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const asJson = args.includes('--json');
const onlyLocale = pick('--locale');

/** The canonical plan. A product decision, not something this script derives. */
const PLANNED_MODULES = 47;
const FAMILIES = [
  'orient', 'regulate', 'ground', 'release', 'reframe', 'focus',
  'activate', 'prepare', 'transition', 'settle', 'sleep', 'close',
];

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '\n  EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n' +
    '\n  Read-only, but the content tables are service-role only.\n'
  );
  process.exit(2);
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

async function rest(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!response.ok) {
    console.error(`\n  Query failed (${response.status}): ${path}\n`);
    process.exit(1);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
const [locales, voices, modules, versions, renditions, mappings] = await Promise.all([
  rest('locales?select=id,display_label,is_enabled,is_content_ready&order=id'),
  rest('voice_profiles?select=id,display_label,is_active,is_default,sort_order&order=sort_order'),
  rest('intervention_modules?select=id,module_key,family,is_active,approved&order=module_key'),
  rest('intervention_module_versions?select=module_id,version,locale,approved_at,withdrawn_at,script_text'),
  rest('module_renditions?select=module_id,locale,version,voice_profile,approved,duration_seconds'),
  rest('provider_voice_mappings?select=voice_profile,locale,provider,is_active'),
]);

const moduleById = new Map(modules.map((m) => [m.id, m]));
const wantedLocales = onlyLocale ? locales.filter((l) => l.id === onlyLocale) : locales;

/** Content approved and not withdrawn, per locale. */
const approvedContent = new Map(); // locale -> Set(module_id)
for (const v of versions) {
  if (v.approved_at === null || v.withdrawn_at !== null) continue;
  if (!approvedContent.has(v.locale)) approvedContent.set(v.locale, new Set());
  approvedContent.get(v.locale).add(v.module_id);
}

/** Wording authored at all, approved or not. */
const authored = new Map();
for (const v of versions) {
  if (!v.script_text || !v.script_text.trim()) continue;
  if (!authored.has(v.locale)) authored.set(v.locale, new Set());
  authored.get(v.locale).add(v.module_id);
}

/** Audio a human has approved, per locale+voice. */
const approvedAudio = new Map(); // `${locale}:${voice}` -> Set(module_id)
for (const r of renditions) {
  if (!r.approved) continue;
  const key = `${r.locale}:${r.voice_profile}`;
  if (!approvedAudio.has(key)) approvedAudio.set(key, new Set());
  approvedAudio.get(key).add(r.module_id);
}

const mappedVoices = new Set(
  mappings.filter((m) => m.is_active).map((m) => `${m.locale}:${m.voice_profile}`)
);

const out = (s = '') => { if (!asJson) console.log(s); };

out('');
out('  ELSEA COVERAGE');
out('  ' + '='.repeat(74));
out('');
out(`  Canonical plan: ${PLANNED_MODULES} modules across ${FAMILIES.length} families.`);
out(`  Architectural matrix: ${voices.length} voices x ${locales.length} locales x ${PLANNED_MODULES} modules`
  + ` = ${voices.length * locales.length * PLANNED_MODULES} possible renditions.`);
out('');

// ---- modules --------------------------------------------------------------
out('  MODULES');
out(`    planned                  ${PLANNED_MODULES}`);
out(`    exist in the database    ${modules.length}`);
out(`    playable (approved)      ${modules.filter((m) => m.approved).length}`);
out(`    missing from the plan    ${PLANNED_MODULES - modules.length}`);
out('');

const byFamily = new Map(FAMILIES.map((f) => [f, 0]));
for (const m of modules) byFamily.set(m.family, (byFamily.get(m.family) ?? 0) + 1);
out('    by family:');
for (const f of FAMILIES) {
  const n = byFamily.get(f) ?? 0;
  out(`      ${f.padEnd(12)} ${String(n).padStart(2)}${n === 0 ? '   <- none authored' : ''}`);
}
out('');

// ---- locales --------------------------------------------------------------
out('  LOCALES');
out('    locale   label                  enabled  content_ready  authored  approved');
for (const l of locales) {
  const a = authored.get(l.id)?.size ?? 0;
  const c = approvedContent.get(l.id)?.size ?? 0;
  out(
    `    ${l.id.padEnd(8)} ${String(l.display_label).padEnd(22)} ` +
    `${String(l.is_enabled).padEnd(8)} ${String(l.is_content_ready).padEnd(14)} ` +
    `${String(a).padStart(8)}  ${String(c).padStart(8)}`
  );
}
out('');

// ---- voices ---------------------------------------------------------------
out('  VOICE PROFILES');
out('    voice       label        active  default  mapped(en)  approved audio (en)');
for (const v of voices) {
  const mapped = mappedVoices.has(`en:${v.id}`);
  const audio = approvedAudio.get(`en:${v.id}`)?.size ?? 0;
  out(
    `    ${v.id.padEnd(11)} ${String(v.display_label).padEnd(12)} ` +
    `${String(v.is_active).padEnd(7)} ${String(v.is_default).padEnd(8)} ` +
    `${String(mapped).padEnd(11)} ${String(audio).padStart(6)}`
  );
}
out('');

// ---- the matrix -----------------------------------------------------------
out('  COVERAGE MATRIX  (approved audio / content-approved modules)');
out('    locale   voice        mapped  approved audio  missing  playable');
const matrix = [];
for (const l of wantedLocales) {
  const contentReady = approvedContent.get(l.id) ?? new Set();
  for (const v of voices) {
    const key = `${l.id}:${v.id}`;
    const audio = approvedAudio.get(key) ?? new Set();
    const missing = [...contentReady].filter((id) => !audio.has(id));
    const row = {
      locale: l.id,
      voice: v.id,
      mapped: mappedVoices.has(key),
      approved_audio: audio.size,
      content_approved: contentReady.size,
      missing_audio: missing.length,
      missing_modules: missing.map((id) => moduleById.get(id)?.module_key).filter(Boolean).sort(),
      playable: audio.size > 0 && v.is_active,
    };
    matrix.push(row);
    if (audio.size > 0 || row.mapped) {
      out(
        `    ${l.id.padEnd(8)} ${v.id.padEnd(12)} ${String(row.mapped).padEnd(7)} ` +
        `${String(row.approved_audio).padStart(14)}  ${String(row.missing_audio).padStart(7)}  ` +
        `${row.playable ? 'yes' : 'no'}`
      );
    }
  }
}
out('    (rows with neither a mapping nor audio are omitted; see --json for all)');
out('');

// ---- the honest summary ---------------------------------------------------
const enContent = approvedContent.get('en')?.size ?? 0;
const enPlayable = modules.filter((m) => m.approved).length;

out('  READINESS');
out(`    English content-approved       ${enContent}/${PLANNED_MODULES}`);
out(`    English modules playable       ${enPlayable}/${PLANNED_MODULES}`);
out(`    Locales content-ready          ${locales.filter((l) => l.is_content_ready).length}/${locales.length}`);
out(`    Voices selectable              ${voices.filter((v) => v.is_active).length}/${voices.length}`);
out(`    Voices provider-mapped (en)    ${voices.filter((v) => mappedVoices.has(`en:${v.id}`)).length}/${voices.length}`);
out('');

if (enPlayable === 0) {
  out('    NO MODULE IS PLAYABLE. Every session runs on the silent catalogue');
  out('    fallback. This is the release blocker.');
  out('');
}

const fingerprint = createHash('sha256')
  .update(JSON.stringify({ modules: modules.length, versions: versions.length, renditions: renditions.length }))
  .digest('hex')
  .slice(0, 12);
out(`  state fingerprint ${fingerprint}   (changes when content or audio changes)`);
out('');

if (asJson) {
  console.log(JSON.stringify({
    planned: PLANNED_MODULES,
    families: FAMILIES,
    modules: { total: modules.length, playable: enPlayable },
    locales, voices, matrix,
    fingerprint,
  }, null, 2));
}
