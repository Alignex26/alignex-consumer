#!/usr/bin/env node
//
// Can each recipe actually be composed from the modules that exist?
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/recipe-readiness.mjs
//
// READ-ONLY. No writes, no uploads, no provider calls.
//
// WHY THIS IS NOT JUST "DOES EVERY FAMILY HAVE A MODULE".
//
// A module may be played at most once per session — `usedInSession` is threaded
// across phases in the allocator, so composition never repeats content to fill
// time. That makes phase-filling a MATCHING problem, not a coverage one: a recipe
// can have a module for every family it names and still fail, because two phases
// compete for the same single module.
//
// That is exactly what happened with `nervous_ready`. Every one of its six phases
// named a family we had. It failed anyway:
//
//     build_readiness            prepare, activate  -> nr_prepare_short
//     direct_attention_forward   focus, prepare     -> nothing left
//
// One `prepare` module, two phases wanting it, and no `focus` module at all. A
// coverage report says "all families present" and is wrong. This computes a
// maximum bipartite matching instead, which is what the allocator effectively
// does, and reports the phases that genuinely cannot be filled.

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

const [transitions, phases, phaseFamilies, modules] = await Promise.all([
  rest('transitions?select=key&order=key'),
  rest('recipe_phases?select=transition_key,ordinal,phase,min_seconds,max_seconds&order=transition_key,ordinal'),
  rest('recipe_phase_families?select=transition_key,phase,family'),
  rest('intervention_modules?select=module_key,family,approved,is_active&order=module_key'),
]);

/** Only a module that would actually be selected counts. */
const playable = modules.filter((m) => m.approved && m.is_active);

/**
 * Maximum bipartite matching, phases to modules (Kuhn's algorithm).
 *
 * Returns the set of phase indices that could not be matched. Any phase left
 * unmatched is a phase the allocator would fail on with `phase_unfilled`.
 */
function unfillablePhases(phaseList, eligibleFor) {
  const matchedModule = new Map(); // module_key -> phase index
  const seen = new Set();

  function augment(phaseIndex) {
    for (const moduleKey of eligibleFor[phaseIndex]) {
      if (seen.has(moduleKey)) continue;
      seen.add(moduleKey);
      if (!matchedModule.has(moduleKey) || augment(matchedModule.get(moduleKey))) {
        matchedModule.set(moduleKey, phaseIndex);
        return true;
      }
    }
    return false;
  }

  const unmatched = [];
  for (let i = 0; i < phaseList.length; i += 1) {
    seen.clear();
    if (!augment(i)) unmatched.push(i);
  }
  return unmatched;
}

console.log('');
console.log('  RECIPE READINESS');
console.log('  ' + '='.repeat(74));
console.log('');
console.log(`  ${playable.length} playable module(s): ` +
  (playable.length ? playable.map((m) => `${m.module_key} (${m.family})`).join(', ') : 'none'));
console.log('');

const familiesNeeded = new Set();
let readyCount = 0;

for (const t of transitions) {
  const recipePhases = phases.filter((p) => p.transition_key === t.key);
  if (recipePhases.length === 0) continue;

  const eligibleFor = recipePhases.map((p) => {
    const fams = phaseFamilies
      .filter((f) => f.transition_key === t.key && f.phase === p.phase)
      .map((f) => f.family);
    return playable.filter((m) => fams.includes(m.family)).map((m) => m.module_key);
  });

  const unmatched = unfillablePhases(recipePhases, eligibleFor);
  const minTotal = recipePhases.reduce((sum, p) => sum + p.min_seconds, 0);

  console.log(`  ${t.key}`);
  console.log(`    ${recipePhases.length} phases, minimum ${minTotal}s`);

  if (unmatched.length === 0) {
    readyCount += 1;
    console.log('    COMPOSABLE — every phase can be filled without repeating a module.');
  } else {
    console.log(`    NOT COMPOSABLE — ${unmatched.length} phase(s) cannot be filled:`);
    for (const i of unmatched) {
      const p = recipePhases[i];
      const fams = phaseFamilies
        .filter((f) => f.transition_key === t.key && f.phase === p.phase)
        .map((f) => f.family);
      for (const f of fams) familiesNeeded.add(f);
      const why = eligibleFor[i].length === 0
        ? 'no module in any accepted family'
        : `only ${eligibleFor[i].join(', ')} — taken by an earlier phase`;
      console.log(`      ${p.ordinal}. ${p.phase.padEnd(26)} needs ${fams.join('|').padEnd(20)} ${why}`);
    }
  }
  console.log('');
}

console.log('  ' + '-'.repeat(74));
console.log(`  Recipes composable: ${readyCount}/${transitions.length}`);
console.log('');

if (familiesNeeded.size > 0) {
  const byFamily = new Map();
  for (const f of familiesNeeded) {
    byFamily.set(f, playable.filter((m) => m.family === f).length);
  }
  console.log('  Families that would unblock a phase, and what exists in each:');
  for (const [f, n] of [...byFamily].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
    console.log(`    ${f.padEnd(12)} ${n} playable module(s)`);
  }
  console.log('');
  console.log('  A family showing 0 blocks every phase that names it. A family showing 1 or');
  console.log('  more still blocks a phase when an earlier phase in the same session already');
  console.log('  used the only module — which is why this is a matching, not a checklist.');
  console.log('');
}
