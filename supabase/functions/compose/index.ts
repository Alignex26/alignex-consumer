// supabase/functions/compose/index.ts
//
// THE SERVER-SIDE SESSION COMPOSER.
//
// Takes a structured decision and returns a finished manifest. The client
// receives WHAT to play; it never learns how the decision was made.
//
// WHY THIS IS SERVER-SIDE. The five recipes, their phase bands and their
// family eligibility are ELSEA's proprietary product intelligence. While the
// recipe tables were readable with the public anon key, anyone who pulled that
// key out of the app bundle could enumerate the lot through PostgREST. Those
// policies are now dropped and the tables are service-role only, which is why
// composition has to happen here.
//
// This still honours profitability rule 6. Playback composition — sequencing,
// beds, ducking, fades, silence — remains client-side, in
// `src/audio/use-manifest-player.ts`. It is the DECISION that moved.
//
// The second reason: this is the only place that can call a paid TTS provider,
// so this is where the dynamic-speech budget has to be enforced. A ceiling
// checked only on the client is not a ceiling — a modified client would simply
// not check it. Nothing about the budget is accepted from the caller.
//
// Deploy:
//   npx supabase functions deploy compose

import { createClient } from "jsr:@supabase/supabase-js@2";

// THE SAME allocation and selection algorithm the app imports — one
// implementation, not two. Deno needs the explicit extension; the app resolves
// the identical file without one. Keep that module dependency-free or this
// sharing breaks and the duplication comes back.
import {
  BUDGET_CEILING_SECONDS,
  BUDGET_NORMAL_SECONDS,
  planPhases,
  scoresFrom,
  type PlanModule,
  type PlanPhase,
} from "../_shared/allocate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Must agree with TRANSITION_KEYS in src/types/elsea.ts. */
const TRANSITION_KEYS = [
  "wound_up_home",
  "scattered_focused",
  "nervous_ready",
  "wired_sleep",
  "flat_go",
];

const MAX_DURATION_SECONDS = 3600;

type PhaseRow = { ordinal: number; phase: string; min_seconds: number; max_seconds: number };

type ModuleRow = {
  id: string;
  module_key: string;
  family: string;
  storage_path: string;
  duration_seconds: number;
  is_bed: boolean;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Always 200: a session that cannot be composed is an expected outcome, not a
 * transport error. The client falls back to the catalogue path.
 */
function fail(failure: string): Response {
  return json({ ok: false, failure });
}

const toPlanModule = (row: ModuleRow): PlanModule => ({
  id: row.id,
  moduleKey: row.module_key,
  storagePath: row.storage_path,
  durationSeconds: row.duration_seconds,
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, failure: "method_not_allowed" }, 405);

  let body: { transition_key?: unknown; duration_seconds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, failure: "bad_request" }, 400);
  }

  const transitionKey = String(body.transition_key ?? "");
  const durationSeconds = Number(body.duration_seconds ?? 0);

  // Closed vocabulary. The caller cannot compose for a transition that does
  // not exist, and cannot ask for an unbounded session.
  if (!TRANSITION_KEYS.includes(transitionKey)) {
    return json({ ok: false, failure: "unknown_transition" }, 400);
  }
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_DURATION_SECONDS
  ) {
    return json({ ok: false, failure: "bad_duration" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // The person, if signed in. Their identity comes from a verified token, never
  // from the request body — a caller must not be able to compose using somebody
  // else's effectiveness history by naming them.
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(authHeader.slice(7));
    userId = data?.user?.id ?? null;
  }

  // ---- The recipe ---------------------------------------------------------
  const { data: phaseRows } = await admin
    .from("recipe_phases")
    .select("ordinal, phase, min_seconds, max_seconds")
    .eq("transition_key", transitionKey)
    .order("ordinal", { ascending: true });

  const rows = (phaseRows ?? []) as PhaseRow[];
  if (rows.length === 0) return fail("no_recipe");

  const phases: PlanPhase[] = rows.map((r) => ({
    phase: r.phase,
    minSeconds: r.min_seconds,
    maxSeconds: r.max_seconds,
  }));

  const { data: familyRows } = await admin
    .from("recipe_phase_families")
    .select("phase, family")
    .eq("transition_key", transitionKey);

  const familiesByPhase = new Map<string, string[]>();
  for (const row of familyRows ?? []) {
    const list = familiesByPhase.get(row.phase) ?? [];
    list.push(row.family);
    familiesByPhase.set(row.phase, list);
  }

  // ---- The library --------------------------------------------------------
  const { data: moduleRows } = await admin
    .from("intervention_modules")
    .select("id, module_key, family, storage_path, duration_seconds, is_bed")
    .eq("is_active", true)
    .eq("approved", true);

  const modules = (moduleRows ?? []) as ModuleRow[];
  if (modules.length === 0) return fail("library_empty");

  // ---- This person's history ---------------------------------------------
  let scores = new Map<string, number>();
  if (userId) {
    const { data } = await admin
      .from("module_effectiveness")
      .select("module_id, positive, total")
      .eq("user_id", userId);

    scores = scoresFrom(
      (data ?? []).map((r) => ({ moduleId: r.module_id, positive: r.positive, total: r.total })),
    );
  }

  // ---- Budget -------------------------------------------------------------
  //
  // Nothing about the budget comes from the caller. Dynamic speech is not
  // generated yet, so this session speaks nothing and bills nothing — which is
  // also the guardrail: narration must be impossible by default.
  const dynamicSeconds = 0;
  if (dynamicSeconds > BUDGET_CEILING_SECONDS) return fail("budget_exceeded");

  // ---- Compose ------------------------------------------------------------
  //
  // A module qualifies on FAMILY ELIGIBILITY, never on merely existing. A phase
  // with no approved families accepts nothing and the composition fails, which
  // is correct: better no session than an unapproved one.
  const plan = planPhases(
    phases,
    (phase) => {
      const eligible = familiesByPhase.get(phase) ?? [];
      return modules
        .filter((m) => !m.is_bed && eligible.includes(m.family))
        .map(toPlanModule);
    },
    scores,
    durationSeconds - dynamicSeconds,
  );

  if (!plan.ok) return fail(plan.failure);

  const segments = plan.segments.map((segment, index) => {
    const base = {
      ordinal: index,
      layer: "foreground",
      offset_seconds: segment.offsetSeconds,
      duration_seconds: segment.durationSeconds,
      phase: segment.phase,
    };

    return segment.kind === "module" && segment.module
      ? {
        ...base,
        kind: "module",
        module_id: segment.module.id,
        module_key: segment.module.moduleKey,
        storage_path: segment.module.storagePath,
      }
      : { ...base, kind: "silence" };
  });

  const bed = modules.find((m) => m.is_bed) ?? null;
  if (bed) {
    segments.push({
      kind: "module",
      ordinal: 0,
      layer: "bed",
      offset_seconds: 0,
      duration_seconds: plan.totalSeconds,
      module_id: bed.id,
      module_key: bed.module_key,
      storage_path: bed.storage_path,
      phase: "bed",
    });
  }

  return json({
    ok: true,
    manifest: {
      transition_key: transitionKey,
      // What was actually composed, which can be under the request when every
      // phase is at its ceiling. Reporting the request would be a lie.
      duration_seconds: plan.totalSeconds,
      recipe_version: 1,
      dynamic_seconds: dynamicSeconds,
      exceptional_speech: dynamicSeconds > BUDGET_NORMAL_SECONDS,
      segments,
    },
  });
});
