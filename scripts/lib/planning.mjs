//
// THE PLANNING SIMULATOR.
//
// A faithful reimplementation of `supabase/functions/_shared/allocate.ts`, used
// only to answer questions about modules that do not exist yet and therefore
// cannot be composed.
//
// IT IS NOT A SECOND SOURCE OF TRUTH. Every caller must validate it against the
// live composer before acting on anything it says, and must fail closed when it
// disagrees. `plan-library.mjs` does that on every run.
//
// WHY THIS FILE EXISTS SEPARATELY. The previous model lived inline in a script
// and drifted: it used one duration per family, which was harmless while every
// family had one module and wrong the moment `transition` gained seven of
// varying length. It then reported 30/60 where the composer said 27/60 — and it
// was being used to decide where provider money went. Extracting it makes the
// divergence testable.
//
// KEEP IN STEP WITH THE ALLOCATOR. If `allocate.ts` changes, this must change,
// and the validation in `plan-library.mjs` is what will catch it if it does not.
//

/** `allocate` — proportional slack over phase floors. */
export function allocate(phases, available) {
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
 * `pick` — best-rated, then longest, then key ascending.
 *
 * Effectiveness scores are all neutral in planning: there is no history for
 * modules that do not exist, and assuming any would be inventing evidence.
 */
export function pick(candidates, allocatedSeconds) {
  const fits = candidates.filter((m) => m.duration <= allocatedSeconds);
  if (fits.length === 0) return null;
  return fits.reduce((best, c) => {
    if (c.duration !== best.duration) return c.duration > best.duration ? c : best;
    return c.key < best.key ? c : best;
  });
}

/** `fillPhase` — chains modules until nothing eligible fits. Mutates `used`. */
export function fillPhase(candidates, allocatedSeconds, used) {
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

/**
 * `planPhases`, reduced to the question planning asks: does every phase get at
 * least one module?
 *
 * Returns the chosen modules in order when it succeeds, so callers can measure
 * repetition without composing twice.
 */
export function planSession(phases, byFamily, available) {
  const allocation = allocate(phases, available);
  if (allocation === null) return null;

  const used = new Set();
  const chosen = [];
  for (let i = 0; i < phases.length; i += 1) {
    const candidates = phases[i].families.flatMap((f) => byFamily.get(f) ?? []);
    const filled = fillPhase(candidates, allocation[i], used);
    if (filled.length === 0) return null;
    chosen.push(...filled.map((m) => m.key));
  }
  return chosen;
}

/** True when a session can be built at all. */
export function composes(phases, byFamily, available) {
  return planSession(phases, byFamily, available) !== null;
}

/**
 * Coverage over every recipe and duration.
 *
 * VOICE IS NOT A DIMENSION HERE, and that is not a simplification: the composer
 * allocates against the module's canonical duration specifically so the same
 * techniques are chosen whichever voice plays. Voice multiplies the reported
 * case count and can never change the outcome. Callers scale by the voice count
 * to speak in the same units as the live check.
 */
export function coverage(recipes, byFamily, durations) {
  const cases = [];
  for (const [key, phases] of recipes) {
    for (const d of durations) {
      cases.push({ recipe: key, duration: d, ok: composes(phases, byFamily, d) });
    }
  }
  return { cases, ok: cases.filter((c) => c.ok).length, total: cases.length };
}

/** A library as the simulator wants it: family -> [{key, duration}]. */
export function libraryFrom(modules) {
  const byFamily = new Map();
  for (const m of modules) {
    if (!byFamily.has(m.family)) byFamily.set(m.family, []);
    byFamily.get(m.family).push({ key: m.module_key, duration: m.duration_seconds });
  }
  return byFamily;
}

/** A copy with extra hypothetical modules added. */
export function withAdded(byFamily, additions) {
  const next = new Map();
  for (const [f, list] of byFamily) next.set(f, [...list]);
  for (const [i, a] of additions.entries()) {
    if (!next.has(a.family)) next.set(a.family, []);
    next.get(a.family).push({ key: `hypothetical_${a.family}_${a.duration}_${i}`, duration: a.duration });
  }
  return next;
}

/**
 * Duration shapes worth modelling for a family, derived from the recipes rather
 * than invented.
 *
 * A module is only usable in a phase whose allocation reaches its length, and a
 * phase is only guaranteed its floor. So the distinct phase floors that accept a
 * family are the points where a module's usefulness actually changes — below the
 * smallest it fits everywhere, above the largest it fits only the roomiest
 * phases.
 *
 * Existing approved durations are included as evidence of what this content
 * really measures, so recommendations stay inside what the writing has shown to
 * be achievable.
 */
export function durationShapesFor(family, recipes, existing) {
  const floors = new Set();
  for (const [, phases] of recipes) {
    for (const p of phases) {
      if (p.families.includes(family)) floors.add(p.min);
    }
  }
  if (floors.size === 0) return [];

  const sorted = [...floors].sort((a, b) => a - b);
  const observed = existing.map((m) => m.duration).sort((a, b) => a - b);
  const typical = observed.length > 0
    ? observed[Math.floor(observed.length / 2)]
    : Math.max(8, Math.round(sorted[0] * 0.7));

  // THE PIPELINE'S CEILING IS THE REAL LIMIT, and the planner must not
  // recommend past it.
  //
  // `finalise-master` derives a module's duration ceiling as the SMALLEST floor
  // of any phase accepting its family, so a module long enough to need a roomier
  // phase is refused outright. Recommending one is worse than useless: it looks
  // like a plan and cannot be built.
  //
  // This was found when the roadmap asked for a 60s `settle` module while the
  // mastering ceiling for `settle` is 30s. A shorter one achieved identical
  // coverage.
  //
  // There is a genuine tension here — a longer module IS usable in the roomier
  // phases, and the conservative ceiling forbids it — but that is a question
  // about `finalise-master`, not something to route around by recommending
  // modules the pipeline will reject. Recorded rather than resolved.
  const masteringCeiling = sorted[0];

  const shapes = new Map();
  shapes.set(Math.min(masteringCeiling, typical),
    `<=${masteringCeiling}s, the mastering ceiling for this family`);

  // Observed lengths below the ceiling are worth modelling too: they are what
  // this content really measures, and shorter modules chain differently.
  for (const d of observed) {
    if (d < masteringCeiling) shapes.set(d, `${d}s, matching an existing module`);
  }

  return [...shapes]
    .filter(([duration]) => duration <= masteringCeiling)
    .map(([duration, note]) => ({ family, duration, note }))
    .sort((a, b) => a.duration - b.duration);
}
