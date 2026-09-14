#!/usr/bin/env node
//
// Can each recipe actually be composed? Asked of the composer, not of a model.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/recipe-readiness.mjs
//   ... node scripts/recipe-readiness.mjs --voice clear
//
// READ-ONLY. It calls `compose`, which reads and returns a manifest; it does not
// persist one, because persistence requires a signed-in user and this runs with
// the service role, which has no `sub`.
//
// ---------------------------------------------------------------------------
// WHY THIS NO LONGER SIMULATES THE ALLOCATOR
// ---------------------------------------------------------------------------
//
// The first version of this script computed a maximum bipartite matching of
// phases to modules. It reported 5/5 recipes composable when the real composer
// could manage 27 of 60 recipe/duration/voice combinations. It was confidently,
// specifically wrong, and it was wrong in the direction that costs money: it
// said the library was finished.
//
// Two things the model missed, both of which are deliberate in the allocator:
//
//   1. A PHASE CHAINS MODULES. `fillPhase` loops `while (remaining > 0)`, so one
//      phase can consume several modules, and every one it takes is out of
//      contention for every later phase. A 600s session swallows more of the
//      library than a 300s one — which is why longer durations fail FIRST, the
//      opposite of what a matching predicts.
//
//   2. SELECTION IS GREEDY, WITH NO LOOKAHEAD. `pick` takes best-rated then
//      longest. In `flat_go`, `choose_first_move` accepts focus|prepare and
//      takes the longer `prepare`; `build_momentum` accepts activate|prepare and
//      finds both gone. A matching finds the assignment that works. The
//      allocator does not look for it, on purpose — "a packing algorithm nobody
//      can predict is worth less" than one that is legible.
//
// A model of a system is a second implementation that has to be kept true. This
// asks the system.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const pick = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const DURATIONS = [300, 600, 900, 1200];
const onlyVoice = pick('--voice');
const locale = pick('--locale', 'en');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('\n  EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.\n');
  process.exit(2);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function rest(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!response.ok) {
    console.error(`\n  Query failed (${response.status}): ${path}\n`);
    process.exit(1);
  }
  return response.json();
}

async function compose(transitionKey, durationSeconds, voiceProfile) {
  const response = await fetch(`${url}/functions/v1/compose`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      transition_key: transitionKey,
      duration_seconds: durationSeconds,
      voice_profile: voiceProfile,
      locale,
    }),
  });
  try {
    return await response.json();
  } catch {
    return { ok: false, failure: `http_${response.status}` };
  }
}

const [transitions, voices, modules] = await Promise.all([
  rest('transitions?select=key&order=key'),
  rest('voice_profiles?select=id,is_active&is_active=eq.true&order=sort_order'),
  rest('intervention_modules?select=module_key,family,approved&approved=eq.true&order=module_key'),
]);

const voiceList = onlyVoice ? voices.filter((v) => v.id === onlyVoice) : voices;

console.log('');
console.log('  RECIPE READINESS — asked of the composer');
console.log('  ' + '='.repeat(74));
console.log('');
console.log(`  ${modules.length} playable module(s), ${voiceList.length} voice(s), ` +
  `${DURATIONS.length} durations = ${transitions.length * voiceList.length * DURATIONS.length} combinations`);
console.log('');

let ok = 0;
let total = 0;
const failures = [];

for (const t of transitions) {
  const cells = [];
  for (const d of DURATIONS) {
    const results = [];
    for (const v of voiceList) {
      const r = await compose(t.key, d, v.id);
      total += 1;
      if (r.ok) {
        ok += 1;
        results.push((r.manifest?.segments ?? []).filter((s) => s.kind === 'module').length);
      } else {
        results.push(null);
        failures.push({ recipe: t.key, duration: d, voice: v.id, failure: r.failure });
      }
    }
    const worked = results.filter((n) => n !== null);
    cells.push(
      worked.length === results.length
        ? `${d}s ${Math.min(...worked)}-${Math.max(...worked)}mod`.padEnd(16)
        : `${d}s FAIL`.padEnd(16)
    );
  }
  console.log(`  ${t.key.padEnd(19)} ${cells.join('')}`);
}

console.log('');
console.log('  ' + '-'.repeat(74));
console.log(`  Compositions that succeed: ${ok}/${total}`);
console.log('');

if (failures.length > 0) {
  const byReason = new Map();
  for (const f of failures) {
    const key = `${f.recipe} @ ${f.duration}s — ${f.failure}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  console.log('  Failures:');
  for (const [reason, count] of byReason) {
    console.log(`    ${reason}${count > 1 ? `  (${count} voices)` : ''}`);
  }
  console.log('');
  console.log('  `phase_unfilled` means a phase had no eligible module left — either');
  console.log('  nothing short enough, or everything eligible was already used earlier');
  console.log('  in the same session. Selection is greedy and does not look ahead, so a');
  console.log('  later phase can be starved by an earlier one taking the module it needed.');
  console.log('  More modules in the contested families is the fix, not a smarter search.');
  console.log('');
}

const byFamily = new Map();
for (const m of modules) byFamily.set(m.family, (byFamily.get(m.family) ?? 0) + 1);
console.log('  Playable modules per family:');
for (const [family, n] of [...byFamily].sort()) {
  console.log(`    ${family.padEnd(12)} ${n}`);
}
console.log('');
