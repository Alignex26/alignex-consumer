#!/usr/bin/env node
//
// Bring each module's canonical duration into line with the audio that exists.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-durations.mjs
//   ... node scripts/sync-durations.mjs --commit
//
// DRY RUN BY DEFAULT. Without `--commit` nothing is written.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NEEDED, AND WHY IT IS NOT A COMPOSER CHANGE
// ---------------------------------------------------------------------------
//
// `intervention_modules.duration_seconds` is what the allocator plans against.
// It was set from the draft manifests as an ESTIMATE, before any audio existed,
// and nothing has updated it since: `finalise-master` writes the measured length
// to the RENDITION and leaves the module's own value alone.
//
// The gap is not small. Measured 2026-09-14:
//
//     nr_regulate_short   declared 45s   actual 18-23s
//     nr_reframe_short    declared 40s   actual 19-27s
//     nr_prepare_short    declared 45s   actual 25-29s
//
// A 300s session allocated 190s to speech that really runs about 125s, so most
// of a session is silence nobody planned. That is audible, and it is the first
// thing anyone would notice on a device.
//
// THE OBVIOUS FIX IS THE WRONG ONE. The composer already holds the resolved
// rendition and could plan against its real length — but it deliberately does
// not, and says so: the allocator plans with the canonical length "so the SAME
// techniques are chosen whichever voice is playing. Only the recording differs,
// which is the whole point." Planning per voice would mean changing voice
// changes which interventions you get. That is a product property, not an
// oversight.
//
// So the canonical value stays canonical, and is made true instead.
//
// WHY THE MAXIMUM, NOT THE MEAN. Every voice plays inside the same segment. If
// the canonical length were the average, the slowest voice's audio would run
// past the end of its slot and into the next segment. The longest rendition is
// the only value that fits them all.
//
// VERSION ROWS ARE NOT TOUCHED. `intervention_module_versions.duration_seconds`
// is part of a version's identity and the append-only trigger refuses to change
// it. That is correct: a version records what was approved, not what was later
// measured.
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const locale = args.includes('--locale') ? args[args.indexOf('--locale') + 1] : 'en';

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

async function rest(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  if (!response.ok) {
    console.error(`\n  Query failed (${response.status}): ${path}\n  ${text}\n`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

const modules = await rest('intervention_modules?select=id,module_key,family,duration_seconds&order=module_key');
const renditions = await rest(
  `module_renditions?select=module_id,voice_profile,duration_seconds&approved=eq.true&is_active=eq.true&locale=eq.${encodeURIComponent(locale)}`
);

console.log(`\n  ${commit ? 'SYNC' : 'DRY RUN'} — canonical durations from approved ${locale} audio\n`);

const changes = [];
let unchanged = 0;
let noAudio = 0;

for (const m of modules) {
  const mine = renditions.filter((r) => r.module_id === m.id);
  if (mine.length === 0) {
    noAudio += 1;
    continue;
  }

  // The longest approved rendition. Anything shorter truncates a slower voice.
  const longest = Math.max(...mine.map((r) => r.duration_seconds));
  if (longest === m.duration_seconds) {
    unchanged += 1;
    continue;
  }
  changes.push({ ...m, longest, voices: mine.length, delta: longest - m.duration_seconds });
}

if (changes.length === 0) {
  console.log('  Every module with audio already carries its measured length.\n');
  process.exit(0);
}

console.log('  module                 family        declared -> measured   change  voices');
for (const c of changes) {
  console.log(
    `  ${c.module_key.padEnd(22)} ${c.family.padEnd(12)} ` +
    `${String(c.declared ?? c.duration_seconds).padStart(7)}s -> ${String(c.longest).padStart(4)}s   ` +
    `${(c.delta > 0 ? '+' : '') + c.delta}s`.padStart(8) + `  ${c.voices}`
  );
}

const reclaimed = changes.reduce((sum, c) => sum + Math.max(0, -c.delta), 0);
console.log(`\n  ${changes.length} module(s) to update, ${unchanged} already correct, ${noAudio} without audio.`);
if (reclaimed > 0) {
  console.log(`  ${reclaimed}s of silence removed from the planning model across the library.`);
}

if (!commit) {
  console.log('\n  Dry run. Nothing written. Re-run with --commit to apply.\n');
  process.exit(0);
}

for (const c of changes) {
  await rest(`intervention_modules?id=eq.${c.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ duration_seconds: c.longest }),
  });
}

console.log(`\n  Updated ${changes.length} module(s).`);
console.log('  Re-run `npm run recipes` — composition changes when planning lengths do.\n');
