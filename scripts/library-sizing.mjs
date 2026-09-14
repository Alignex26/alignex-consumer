#!/usr/bin/env node
//
// How many modules per family does the library actually need?
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/library-sizing.mjs
//   ... node scripts/library-sizing.mjs --validate-only
//
// READ-ONLY. Reads recipes and modules; composes nothing, writes nothing.
//
// ---------------------------------------------------------------------------
// THIS IS A MODEL, AND MODELS OF THIS ALLOCATOR HAVE BEEN WRONG BEFORE
// ---------------------------------------------------------------------------
//
// `recipe-readiness.mjs` once modelled phase-filling as a bipartite matching and
// reported 5/5 recipes composable when the composer managed 27 of 60. It has
// since been rewritten to ask the composer instead.
//
// This script cannot do that, because the question is about modules that do not
// exist yet — there is nothing to compose. So it reimplements `allocate`,
// `fillPhase` and `pick` from `supabase/functions/_shared/allocate.ts`, and then
// DOES NOT TRUST ITSELF: it first replays the real library and asserts it
// reproduces the composer's actual result exactly. If the model and reality
// disagree, it refuses to answer rather than extrapolate from a lie.
//
// Re-check that assertion whenever the allocator changes.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const validateOnly = args.includes('--validate-only');

const DURATIONS = [300, 600, 900, 1200];

/**
 * What the composer really produced, 2026-09-14, with ten modules — one per
 * family — across five recipes, four durations and three voices.
 *
 * The model must reproduce this before it is allowed to predict anything.
 */
const GROUND_TRUTH = {
  flat_go: { 300: false, 600: false, 900: false, 1200: false },
  nervous_ready: { 300: true, 600: true, 900: true, 1200: true },
  scattered_focused: { 300: true, 600: false, 900: false, 1200: false },
  wired_sleep: { 300: true, 600: true, 900: true, 1200: true },
  wound_up_home: { 300: false, 600: false, 900: false, 1200: false },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n');
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

// --- the allocator, reimplemented verbatim ---------------------------------

/** `allocate` from _shared/allocate.ts. */
function allocate(phases, available) {
  const floors = phases.map((p) => p.min);
  const totalFloor = floors.reduce((a, b) => a + b, 0);
  if (available < totalFloor) return null;

  const headroom = phases.map((p) => p.max - p.min);
  const totalHeadroom = headroom.reduce((a, b) => a + b, 0);
  let slack = available - totalFloor;
  if (totalHeadroom === 0 || slack === 0) return floors;

  const slackTotal = slack;
  const allocated = floors.slice();
  for (let i = 0; i < phases.length && slack > 0; i += 1) {
    const proportional = Math.round((headroom[i] / totalHeadroom) * slackTotal);
    const share = Math.min(slack, headroom[i], i === phases.length - 1 ? slack : proportional);
    allocated[i] += share;
    slack -= share;
  }
  return allocated;
}

/**
 * `pick`. All scores are neutral here — effectiveness data does not exist yet —
 * so this is longest-first, then module key ascending.
 */
function pick(candidates, allocatedSeconds) {
  const fits = candidates.filter((m) => m.duration <= allocatedSeconds);
  if (fits.length === 0) return null;
  return fits.reduce((best, c) => {
    if (c.duration !== best.duration) return c.duration > best.duration ? c : best;
    return c.key < best.key ? c : best;
  });
}

/** `fillPhase`. Chains modules until nothing eligible fits, mutating `used`. */
function fillPhase(candidates, allocatedSeconds, used) {
  const chosen = [];
  let remaining = allocatedSeconds;
  while (remaining > 0) {
    const next = pick(candidates.filter((m) => !used.has(m.key)), remaining);
    if (!next) break;
    chosen.push(next);
    used.add(next.key);
    remaining -= next.duration;
  }
  return chosen;
}

/** `planPhases`. True when every phase got at least one module. */
function composes(phases, modulesByFamily, available) {
  const allocation = allocate(phases, available);
  if (allocation === null) return false;
  const used = new Set();
  for (let i = 0; i < phases.length; i += 1) {
    const candidates = phases[i].families.flatMap((f) => modulesByFamily.get(f) ?? []);
    if (fillPhase(candidates, allocation[i], used).length === 0) return false;
  }
  return true;
}

// --- the real recipes and the real library ---------------------------------

const [rawPhases, rawFamilies, modules, renditions] = await Promise.all([
  rest('recipe_phases?select=transition_key,ordinal,phase,min_seconds,max_seconds&order=transition_key,ordinal'),
  rest('recipe_phase_families?select=transition_key,phase,family'),
  rest('intervention_modules?select=id,module_key,family,duration_seconds&approved=eq.true'),
  rest('module_renditions?select=module_id,voice_profile,duration_seconds&locale=eq.en&approved=eq.true'),
]);

const recipes = new Map();
for (const p of rawPhases) {
  if (!recipes.has(p.transition_key)) recipes.set(p.transition_key, []);
  recipes.get(p.transition_key).push({
    phase: p.phase,
    min: p.min_seconds,
    max: p.max_seconds,
    families: rawFamilies
      .filter((f) => f.transition_key === p.transition_key && f.phase === p.phase)
      .map((f) => f.family),
  });
}

const VOICES = [...new Set(renditions.map((r) => r.voice_profile))].sort();

/**
 * The real library.
 *
 * DECLARED durations, not measured ones. The composer allocates against
 * `intervention_modules.duration_seconds` and never looks at the rendition's
 * actual length — which is why every voice fails and succeeds identically, and
 * why the first version of this model, built on per-voice rendition durations,
 * disagreed with the composer on `scattered_focused @ 300s / bright`.
 *
 * Those declared values are the original manifest ESTIMATES and nothing updates
 * them from the audio: `nr_regulate_short` is declared 45s and measures 18-23s.
 * See the gap report in §6w. Sizing here uses what the composer uses, because
 * the question is what the composer will do.
 */
function realLibrary() {
  const byFamily = new Map();
  for (const m of modules) {
    if (!byFamily.has(m.family)) byFamily.set(m.family, []);
    byFamily.get(m.family).push({ key: m.module_key, duration: m.duration_seconds });
  }
  return byFamily;
}

// --- 1. validate the model against reality ---------------------------------

console.log('');
console.log('  LIBRARY SIZING');
console.log('  ' + '='.repeat(74));
console.log('');
console.log('  Validating the model against what the composer actually did...');

let mismatches = 0;
for (const [key, phases] of recipes) {
  for (const d of DURATIONS) {
    const expected = GROUND_TRUTH[key]?.[d];
    if (expected === undefined) continue;
    for (const v of VOICES) {
      const got = composes(phases, realLibrary(), d);
      if (got !== expected) {
        mismatches += 1;
        console.log(`    MISMATCH ${key} @ ${d}s / ${v}: model says ${got}, composer said ${expected}`);
      }
    }
  }
}

if (mismatches > 0) {
  console.log('');
  console.log(`  ${mismatches} mismatch(es). The model does not reproduce reality, so it is not`);
  console.log('  fit to predict anything. Re-check it against _shared/allocate.ts.');
  console.log('');
  process.exit(1);
}

console.log(`    model agrees with the composer on all ${recipes.size * DURATIONS.length * VOICES.length} combinations.`);
console.log('');

if (validateOnly) process.exit(0);

// --- 2. search for the smallest library that composes everywhere -----------

const FAMILIES = [...new Set(rawFamilies.map((f) => f.family))].sort();

/**
 * A hypothetical library with `n` modules in every family.
 *
 * Durations are taken from what real modules in that family actually measure,
 * cycling through them, so the sizes are realistic rather than invented. A
 * family with no real module yet uses the median of everything.
 */
const allDurations = modules.map((m) => m.duration_seconds).sort((a, b) => a - b);
const medianDuration = allDurations[Math.floor(allDurations.length / 2)];

function hypothetical(perFamily) {
  const real = realLibrary();
  const byFamily = new Map();
  for (const family of FAMILIES) {
    const seed = real.get(family) ?? [{ key: `${family}_0`, duration: medianDuration }];
    const list = [];
    for (let i = 0; i < perFamily; i += 1) {
      const base = seed[i % seed.length];
      list.push({ key: `${family}_${String(i).padStart(2, '0')}`, duration: base.duration });
    }
    byFamily.set(family, list);
  }
  return byFamily;
}

function score(perFamily) {
  let ok = 0;
  let total = 0;
  const failing = [];
  for (const [key, phases] of recipes) {
    for (const d of DURATIONS) {
      for (const v of VOICES) {
        total += 1;
        if (composes(phases, hypothetical(perFamily), d)) ok += 1;
        else failing.push(`${key}@${d}s`);
      }
    }
  }
  return { ok, total, failing: [...new Set(failing)] };
}

console.log('  Uniform library size — n modules in every family:');
console.log('');
console.log('    n    composes   still failing');
let answer = null;
for (let n = 1; n <= 12; n += 1) {
  const { ok, total, failing } = score(n);
  const summary = failing.length === 0 ? '—' : failing.slice(0, 4).join(', ') + (failing.length > 4 ? ` +${failing.length - 4}` : '');
  console.log(`    ${String(n).padStart(2)}   ${String(ok).padStart(3)}/${total}    ${summary}`);
  if (ok === total && answer === null) answer = n;
}

console.log('');
if (answer === null) {
  console.log('  No uniform size up to 12 per family reaches every combination.');
} else {
  console.log(`  SMALLEST UNIFORM LIBRARY: ${answer} per family = ${answer * FAMILIES.length} modules`);
  console.log(`  across ${FAMILIES.length} families that recipes actually reference.`);
}
console.log('');
console.log('  Durations here are drawn from what real modules measure. A library of');
console.log('  longer modules needs fewer of them and leaves less silence; a library of');
console.log('  shorter ones needs more. Treat this as a floor, not a forecast.');
console.log('');
