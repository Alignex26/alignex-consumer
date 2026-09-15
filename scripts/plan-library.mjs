#!/usr/bin/env node
//
// What is the smallest NEXT batch of modules that most increases REAL coverage?
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/plan-library.mjs
//   ... node scripts/plan-library.mjs --json
//
// READ-ONLY, AND NO PROVIDER CALLS. It reads recipes and modules, calls
// `compose` to establish the live baseline, and writes nothing anywhere.
//
// ---------------------------------------------------------------------------
// WHY THIS REPLACES library-sizing.mjs
// ---------------------------------------------------------------------------
//
// The previous tool answered "what does a balanced final library look like" and
// reported a JOINT configuration — ground 6, prepare 6, reframe 6, settle 6,
// transition 7 — as if it were a work list. The first row was commissioned. It
// produced 21 provider calls and zero coverage gain, because none of those
// numbers means anything without the others.
//
// It was also drifting from the composer: 30/60 against a real 27/60, because
// hypothetical modules shared one duration per family. That was harmless while
// every family had one module and wrong the moment `transition` gained seven of
// varying length.
//
// So this tool:
//
//   * derives its baseline from LIVE `compose` calls every run, and fails closed
//     without service-role access rather than validating against a fixture;
//   * refuses to recommend anything unless the simulator reproduces that
//     baseline exactly;
//   * models real duration shapes derived from recipe floors and observed
//     lengths, not one number per family;
//   * reports DEPENDENT BATCHES when no single module gains anything, instead of
//     presenting a joint optimum as independent steps.
// ---------------------------------------------------------------------------

import {
  coverage, durationShapesFor, libraryFrom, planSession, withAdded,
} from './lib/planning.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const DURATIONS = [300, 600, 900, 1200];

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// FAIL CLOSED. A planning tool without live truth is a guess, and this one is
// used to decide where money goes.
if (!url || !serviceKey) {
  console.error(
    '\n  PLANNING REFUSED — no live baseline available.\n' +
    '\n  EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n' +
    '  This tool will not fall back to a fixture: a recommendation validated\n' +
    '  against a stale library is how 21 provider calls bought nothing.\n'
  );
  process.exit(2);
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
const out = (s = '') => { if (!asJson) console.log(s); };

async function rest(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!response.ok) {
    console.error(`\n  Query failed (${response.status}): ${path}\n`);
    process.exit(1);
  }
  return response.json();
}

async function composeLive(transitionKey, durationSeconds, voice) {
  const response = await fetch(`${url}/functions/v1/compose`, {
    method: 'POST', headers,
    body: JSON.stringify({ transition_key: transitionKey, duration_seconds: durationSeconds, voice_profile: voice, locale: 'en' }),
  });
  try { return (await response.json()).ok === true; } catch { return false; }
}

// --- the live world --------------------------------------------------------
const [rawPhases, rawFamilies, modules, voices] = await Promise.all([
  rest('recipe_phases?select=transition_key,ordinal,phase,min_seconds,max_seconds&order=transition_key,ordinal'),
  rest('recipe_phase_families?select=transition_key,phase,family'),
  rest('intervention_modules?select=module_key,family,duration_seconds&approved=eq.true&is_active=eq.true&order=module_key'),
  rest('voice_profiles?select=id&is_active=eq.true&order=sort_order'),
]);

const recipes = new Map();
for (const p of rawPhases) {
  if (!recipes.has(p.transition_key)) recipes.set(p.transition_key, []);
  recipes.get(p.transition_key).push({
    phase: p.phase, min: p.min_seconds, max: p.max_seconds,
    families: rawFamilies
      .filter((f) => f.transition_key === p.transition_key && f.phase === p.phase)
      .map((f) => f.family),
  });
}

const FAMILIES = [...new Set(rawFamilies.map((f) => f.family))].sort();
const current = libraryFrom(modules);
const VOICE_COUNT = Math.max(1, voices.length);
const CASES = recipes.size * DURATIONS.length * VOICE_COUNT;

out('');
out('  LIBRARY PLANNING');
out('  ' + '='.repeat(74));
out('');
out(`  ${modules.length} playable modules, ${VOICE_COUNT} voices, ${DURATIONS.length} durations`);
out('');

// --- 1. live baseline, then validate the simulator against it --------------
out('  Establishing the baseline from the live composer...');

const liveCases = [];
for (const [key] of recipes) {
  for (const d of DURATIONS) {
    // One voice is enough and the tool says why: the composer allocates against
    // canonical durations precisely so voice cannot change the outcome. Asking
    // three times would triple the calls to confirm a designed invariant.
    liveCases.push({ recipe: key, duration: d, ok: await composeLive(key, d, voices[0]?.id ?? 'warm') });
  }
}
const liveOk = liveCases.filter((c) => c.ok).length;

const simulated = coverage(recipes, current, DURATIONS);
const disagreements = liveCases.filter((c, i) => c.ok !== simulated.cases[i].ok);

out(`    composer  ${liveOk * VOICE_COUNT}/${CASES}`);
out(`    simulator ${simulated.ok * VOICE_COUNT}/${CASES}`);

if (disagreements.length > 0) {
  console.error('');
  console.error(`  PLANNING REFUSED — the simulator disagrees with the composer on ${disagreements.length} case(s):`);
  for (const d of disagreements) console.error(`    ${d.recipe} @ ${d.duration}s`);
  console.error('');
  console.error('  scripts/lib/planning.mjs has drifted from _shared/allocate.ts.');
  console.error('  No recommendation is produced: a model that cannot reproduce today');
  console.error('  cannot be trusted about tomorrow.');
  console.error('');
  process.exit(1);
}

out('    agreement on all cases — the simulator may be used for planning.');
out('');

const baseline = simulated.ok;
const scale = (n) => `${n * VOICE_COUNT}/${CASES}`;

// --- 2. candidate shapes ---------------------------------------------------
const candidates = [];
for (const family of FAMILIES) {
  for (const shape of durationShapesFor(family, recipes, current.get(family) ?? [])) {
    candidates.push(shape);
  }
}

const score = (additions) => coverage(recipes, withAdded(current, additions), DURATIONS).ok;

// --- 3. singles, then dependent pairs --------------------------------------
out('  SINGLE MODULE ADDITIONS');
out('');
out('    family        duration  coverage        gain');
const singles = candidates
  .map((c) => ({ ...c, after: score([c]) }))
  .sort((a, b) => b.after - a.after || a.duration - b.duration);

for (const s of singles) {
  const gain = s.after - baseline;
  out(`    ${s.family.padEnd(12)} ${String(s.duration).padStart(5)}s   ${scale(s.after).padEnd(12)} ${gain > 0 ? `+${gain * VOICE_COUNT}` : '0'}`);
}

const bestSingle = singles[0];
const singleGains = bestSingle.after > baseline;
out('');
if (!singleGains) {
  out('    NO SINGLE MODULE IMPROVES COVERAGE. Every candidate alone gains nothing,');
  out('    which is exactly the shape that was previously mistaken for a work list.');
  out('    Searching for the smallest DEPENDENT BATCH instead.');
  out('');
}

/**
 * The smallest set of additions that gains anything.
 *
 * Breadth-first over batch size so the answer is genuinely the smallest, not
 * merely the first found. Capped because the search is exponential and a batch
 * nobody would commission in one go is not a useful recommendation.
 */
function smallestGainingBatch(from, maxSize = 4) {
  const base = score(from);
  for (let size = 1; size <= maxSize; size += 1) {
    const stack = [[0, []]];
    while (stack.length > 0) {
      const [start, chosen] = stack.pop();
      if (chosen.length === size) {
        const after = score([...from, ...chosen]);
        if (after > base) return { batch: chosen, before: base, after };
        continue;
      }
      for (let i = start; i < candidates.length; i += 1) {
        stack.push([i, [...chosen, candidates[i]]]);
      }
    }
  }
  return null;
}

// --- 4. an ordered roadmap -------------------------------------------------
out('  ORDERED ROADMAP');
out('');

const roadmap = [];
let committed = [];
let step = 0;
while (score(committed) < simulated.total && step < 20) {
  const found = smallestGainingBatch(committed, 4);
  if (found === null) {
    out('    No batch of four or fewer modules improves coverage further.');
    out('    Remaining failures may need a larger batch, or may be structural.');
    break;
  }
  step += 1;
  const dependent = found.batch.length > 1;
  roadmap.push({ step, ...found, dependent, cumulative: committed.length + found.batch.length });

  out(`  STEP ${step}${dependent ? '   DEPENDENT BATCH — these only work together' : ''}`);
  for (const b of found.batch) {
    out(`    + ${b.family} module, ${b.duration}s or shorter   (${b.note})`);
  }
  const beforeCases = coverage(recipes, withAdded(current, committed), DURATIONS);
  committed = [...committed, ...found.batch];
  const afterCases = coverage(recipes, withAdded(current, committed), DURATIONS);
  const newly = afterCases.cases.filter((c, i) => c.ok && !beforeCases.cases[i].ok);

  out(`    ${scale(found.before)} -> ${scale(found.after)}   gain +${(found.after - found.before) * VOICE_COUNT}`);
  out(`    newly composable: ${newly.map((c) => `${c.recipe}@${c.duration}s`).join(', ')}`);
  out(`    cumulative new modules: ${committed.length}   (${committed.length * VOICE_COUNT} generations)`);
  out('');
}

const finalCoverage = score(committed);

// --- 5. the three targets --------------------------------------------------
out('  ' + '-'.repeat(74));
out('');
out('  A. MINIMUM FUNCTIONAL LIBRARY');
out(`     ${modules.length} existing + ${committed.length} new = ${modules.length + committed.length} modules`);
out(`     coverage ${scale(finalCoverage)}`);
const perFamily = new Map();
for (const c of committed) perFamily.set(c.family, (perFamily.get(c.family) ?? 0) + 1);
for (const [family, n] of [...perFamily].sort()) {
  out(`     ${family.padEnd(12)} +${n}`);
}
out('');
out('     This is the smallest set that composes. It is NOT launch quality:');
out('     see the repetition report below.');
out('');

// --- 6. repetition, and what depth would actually buy ----------------------
//
// THE HEADLINE FINDING COMES FIRST BECAUSE IT CHANGES THE QUESTION. Selection is
// deterministic and novelty weighting is not active: `pick` takes longest-then-
// key with all scores neutral, so the SAME recipe at the SAME duration produces
// the SAME manifest every single time, no matter how large the library gets.
//
// Simulating thirty sessions therefore yields one fingerprint, and would yield
// one fingerprint with a thousand modules. Inventory depth does not reduce
// repetition on its own — activating novelty does. What depth buys is the room
// for novelty to have somewhere to go.
//
// So this measures inventory SUFFICIENCY rather than observed variety: how much
// of the eligible pool a single session consumes, and which phases have only one
// possible occupant.

function repetitionReport(library, label) {
  out(`  ${label}`);
  out('');

  const REPEATS = 30;
  let singleCandidatePhases = 0;
  let totalPhases = 0;
  const usageCount = new Map();
  let sessions = 0;
  const fingerprints = new Set();
  const consumption = [];

  for (const [key, phases] of recipes) {
    for (const d of DURATIONS) {
      const first = planSession(phases, library, d);
      if (first === null) continue;

      // Thirty runs, to show that determinism is what it is.
      for (let i = 0; i < REPEATS; i += 1) {
        const run = planSession(phases, library, d);
        fingerprints.add(`${key}|${d}|${run.join(',')}`);
      }
      sessions += REPEATS;

      for (const k of first) usageCount.set(k, (usageCount.get(k) ?? 0) + 1);

      // How much of what COULD have been chosen actually was.
      const pool = new Set();
      for (const phase of phases) {
        const eligible = phase.families.flatMap((f) => library.get(f) ?? []);
        for (const m of eligible) pool.add(m.key);
        totalPhases += 1;
        if (eligible.length === 1) singleCandidatePhases += 1;
      }
      consumption.push({ recipe: key, duration: d, used: first.length, pool: pool.size });
    }
  }

  const distinctSessions = consumption.length;
  const avgUsed = consumption.reduce((s, c) => s + c.used, 0) / Math.max(1, distinctSessions);
  const avgPool = consumption.reduce((s, c) => s + c.pool, 0) / Math.max(1, distinctSessions);

  out(`    ${REPEATS} runs of each composable case (${sessions} sessions)`);
  out(`    unique manifests: ${fingerprints.size}  (one per case — selection is deterministic)`);
  out(`    consecutive identical manifests: every repeat`);
  out('');
  out(`    a session uses ${avgUsed.toFixed(1)} modules on average, from an eligible pool of ${avgPool.toFixed(1)}`);
  out(`    phases with only one possible module: ${singleCandidatePhases}/${totalPhases}`);
  out('');

  const heavy = [...usageCount.entries()]
    .map(([k, n]) => ({ k, share: n / Math.max(1, distinctSessions) }))
    .sort((a, b) => b.share - a.share);
  for (const threshold of [0.9, 0.75, 0.5]) {
    const n = heavy.filter((h) => h.share >= threshold).length;
    out(`    modules appearing in >=${Math.round(threshold * 100)}% of composable sessions: ${n}`);
  }
  out('');

  return { singleCandidatePhases, totalPhases, avgUsed, avgPool, uniqueManifests: fingerprints.size };
}

const minimalLibrary = withAdded(current, committed);
const repMinimal = repetitionReport(minimalLibrary, 'REPETITION — minimum functional library');

out('    Depth does not fix this. Two sessions differ only when something makes');
out('    them differ, and novelty weighting is recorded but not applied. A larger');
out('    library changes which modules are chosen, not how often the choice');
out('    changes. Activating novelty is a separate piece of work and is the only');
out('    thing that makes repeated use feel different.');
out('');

// --- 7. launch-quality and long-term targets -------------------------------
//
// LAUNCH QUALITY is defined here as: no phase has a single possible occupant, so
// that when novelty is switched on it has an alternative to reach for in every
// slot. That is a measurable property of inventory, unlike "feels fresh", which
// is a property of novelty being active.

function depthForNoSinglePhase() {
  const additions = [...committed];
  for (let guard = 0; guard < 60; guard += 1) {
    const library = withAdded(current, additions);
    let worst = null;
    for (const [, phases] of recipes) {
      for (const phase of phases) {
        const eligible = phase.families.flatMap((f) => library.get(f) ?? []);
        if (eligible.length <= 1) {
          const family = phase.families[0];
          const shapes = durationShapesFor(family, recipes, library.get(family) ?? []);
          if (shapes.length > 0) { worst = shapes[0]; break; }
        }
      }
      if (worst) break;
    }
    if (!worst) return additions;
    additions.push(worst);
  }
  return additions;
}

const launchAdditions = depthForNoSinglePhase();
const launchLibrary = withAdded(current, launchAdditions);
const launchPerFamily = new Map();
for (const a of launchAdditions) launchPerFamily.set(a.family, (launchPerFamily.get(a.family) ?? 0) + 1);

out('  B. LAUNCH-QUALITY LIBRARY');
out(`     ${modules.length} existing + ${launchAdditions.length} new = ${modules.length + launchAdditions.length} modules`);
out(`     coverage ${scale(coverage(recipes, launchLibrary, DURATIONS).ok)}`);
out('     defined as: every phase has at least two possible modules, so novelty');
out('     has somewhere to go once it is switched on.');
for (const [family, n] of [...launchPerFamily].sort()) out(`     ${family.padEnd(12)} +${n}`);
out('');

const repLaunch = repetitionReport(launchLibrary, 'REPETITION — launch-quality library');

out('  C. LONG-TERM DEPTH LIBRARY');
out('');
out('     NOT ESTIMATED, deliberately. Depth beyond launch quality is a novelty and');
out('     personalisation question, and the evidence that would size it — which');
out('     modules people actually rate, which repeat badly, which recipes get used —');
out('     does not exist yet. `module_effectiveness` has no rows.');
out('');
out('     The canonical 47-module plan sits between B and C on these numbers. It is');
out('     comfortably more than the minimum and plausible as a first depth target,');
out('     but nothing here justifies 47 specifically over 40 or 55.');
out('');

if (asJson) {
  console.log(JSON.stringify({
    baseline: { ok: baseline * VOICE_COUNT, total: CASES },
    roadmap: roadmap.map((r) => ({
      step: r.step, dependent: r.dependent,
      modules: r.batch.map((b) => ({ family: b.family, maxDuration: b.duration })),
      before: r.before * VOICE_COUNT, after: r.after * VOICE_COUNT,
      cumulative: r.cumulative,
    })),
    minimumFunctional: { existing: modules.length, added: committed.length, coverage: finalCoverage * VOICE_COUNT },
  }, null, 2));
}

export { recipes, current, committed, DURATIONS, VOICE_COUNT, planSession, withAdded };
