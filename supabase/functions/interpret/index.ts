// supabase/functions/interpret/index.ts
//
// Gate first. Interpreter second. Selection third.
//
// CONTRACT (spec §2, §7):
//   - The safety gate runs BEFORE the interpreter, server-side, always.
//   - Every error path fails CLOSED to the support route. Never to a session.
//   - The model classifies. It never generates prose on the safety path.
//   - Raw input text is never persisted, logged, or forwarded to any
//     observability tool. Not in Postgres. Not in Sentry. Not in PostHog.
//
// Deploy:
//   npx supabase functions deploy interpret
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// PREREQUISITE: confirm zero data retention is enabled on the specific
// Anthropic key used here before this handles real user input.

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODEL = "claude-haiku-4-5-20251001";
const GATE_TIMEOUT_MS = 2500;
const INTERPRET_TIMEOUT_MS = 4000;
const MAX_INPUT_CHARS = 1000;

const CONFIDENCE_FLOOR = 0.6;

// ---------------------------------------------------------------------------
// Taxonomy (spec §3) — closed vocabulary. The model maps onto it; it does
// not invent states.
// ---------------------------------------------------------------------------

const STATES_CURRENT = [
  "wound_up", "anxious", "scattered", "flat", "angry",
  "overwhelmed", "tired_wired", "nervous", "low_energy", "neutral",
] as const;

const STATES_TARGET = [
  "home", "focused", "ready", "sleep", "activated", "settled",
] as const;

const TAXONOMY_VERSION = 1;

// ---------------------------------------------------------------------------
// LAYER 1 — deterministic term list
//
// TUNED TO OVER-TRIGGER. A false positive costs one unnecessary support
// screen. A false negative costs something that cannot be undone.
//
// !! THIS LIST IS A STARTING POINT AND MUST BE REVIEWED BY SOMEONE WITH
// !! CLINICAL OR CRISIS-LINE EXPERIENCE BEFORE LAUNCH. Do not treat it as
// !! complete. Samaritans publish media guidelines; a local Mind branch may
// !! review at no cost.
//
// Deliberately excluded: no method terms, no means, no quantities. This list
// detects intent and distress registers only.
// ---------------------------------------------------------------------------

const CRISIS_TERMS: RegExp[] = [
  // Suicidal ideation / intent
  /\bkill (myself|me)\b/i,
  /\b(end|ending) (it|my life|things)\b/i,
  /\bdon'?t want to (be here|live|wake up|exist)\b/i,
  /\bwant to die\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\bsuicid/i,
  /\bno (point|reason) (in )?(going on|living|carrying on)\b/i,
  /\bcan'?t (go on|do this any ?more|keep going)\b/i,
  /\bgoodbye (everyone|world)\b/i,

  // Self-harm
  /\b(hurt|harm)(ing)? myself\b/i,
  /\bself[- ]harm/i,
  /\bcut(ting)? myself\b/i,

  // Disordered eating
  /\b(purge|purging|starve|starving) myself\b/i,
  /\bhaven'?t eaten (in|for) \w+ (days?|weeks?)\b/i,
  /\bmake myself (sick|throw up|vomit)\b/i,

  // Harm to others
  /\b(kill|hurt|harm) (him|her|them|someone|everyone)\b/i,

  // Abuse / violence being experienced
  /\b(he|she|they) (hits?|hit|beats?|beat|strangl)/i,
  /\bafraid (of|for) my (life|safety)\b/i,
  /\bnot safe at home\b/i,

  // Acute crisis / dissociation registers
  /\bcan'?t (feel|tell) (anything|what'?s real)\b/i,
  /\bnothing (feels|is) real\b/i,
  /\bvoices (telling|are telling) me\b/i,
];

function layerOneFlags(text: string): boolean {
  return CRISIS_TERMS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// LAYER 2 — conservative model classification
//
// Classification ONLY. The model returns a single token. It does not counsel,
// reassure, reflect back, or comment on what the person said.
// ---------------------------------------------------------------------------

const GATE_SYSTEM = `You are a safety classifier. You classify text and nothing else.

Return EXACTLY one word, with no punctuation, explanation, or preamble:

FLAG  - the text indicates any of: suicidal thoughts or intent; self-harm;
        disordered eating; abuse or violence the person is experiencing;
        harm the person intends toward others; acute crisis, psychosis, or
        dissociation.
PASS  - none of the above.

When uncertain, return FLAG. Over-flagging is correct behaviour here.
Ordinary stress, frustration, tiredness, anger about work, or anxiety about
an event are PASS.

Return only FLAG or PASS.`;

// ---------------------------------------------------------------------------
// Interpreter — maps free text onto the closed taxonomy (spec §7.2)
// ---------------------------------------------------------------------------

const INTERPRET_SYSTEM = `You map a description of someone's state onto a fixed vocabulary.

Return ONLY minified JSON. No markdown fences, no prose.

{"state_current":<one of ${STATES_CURRENT.join("|")}>,
 "state_target":<one of ${STATES_TARGET.join("|")}>,
 "time_available_seconds":<integer or null>,
 "context_tag":<short snake_case tag or null>,
 "confidence":<0.0-1.0>}

Rules:
- Use ONLY the listed values. Never invent a state.
- time_available_seconds: only if the person states or clearly implies a
  duration. Otherwise null.
- context_tag examples: after_work, pre_meeting, bedtime, morning. Null if
  unclear.
- confidence: your genuine confidence in the state mapping. Be honest. Below
  0.6 triggers a manual picker, which is a good outcome when you are unsure.`;

// ---------------------------------------------------------------------------
// Anthropic call with hard timeout
// ---------------------------------------------------------------------------

async function callModel(
    system: string,
    userText: string,
    maxTokens: number,
    timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userText }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`anthropic_${res.status}`);

    const data = await res.json();
    const block = data?.content?.find((b: any) => b.type === "text");
    if (!block?.text) throw new Error("no_text_block");
    return block.text.trim();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Contentless safety event (spec §2.4)
// No category. No content. No free text. Ever.
// ---------------------------------------------------------------------------

async function recordSafetyEvent(userId: string | null): Promise<void> {
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await admin.from("safety_events").insert({ user_id: userId });
  } catch {
    // Logging must never affect the user-facing outcome. Swallow.
  }
}

// ---------------------------------------------------------------------------
// Selection (spec §7.4) — deterministic, in code, never in the model
// ---------------------------------------------------------------------------

function transitionKeyFor(current: string, target: string): string | null {
  const map: Record<string, string> = {
    "wound_up|home": "wound_up_home",
    "angry|home": "wound_up_home",
    "overwhelmed|home": "wound_up_home",
    "wound_up|settled": "wound_up_home",
    "angry|settled": "wound_up_home",

    "scattered|focused": "scattered_focused",
    "overwhelmed|focused": "scattered_focused",

    "nervous|ready": "nervous_ready",
    "anxious|ready": "nervous_ready",
    "nervous|settled": "nervous_ready",

    "tired_wired|sleep": "wired_sleep",
    "wound_up|sleep": "wired_sleep",
    "anxious|sleep": "wired_sleep",

    "flat|activated": "flat_go",
    "low_energy|activated": "flat_go",
    "flat|ready": "flat_go",
  };
  return map[`${current}|${target}`] ?? null;
}

async function selectSession(
    transitionKey: string,
    timeAvailable: number | null,
): Promise<{ sessionId: string; durationSeconds: number } | null> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await admin
      .from("sessions_catalogue")
      .select("id, duration_seconds, intensity")
      .eq("transition_key", transitionKey)
      .eq("is_active", true)
      .order("duration_seconds", { ascending: false });

  if (error || !data?.length) return null;

  // Longest that fits. If no time given, default to the shortest so the
  // first experience is never longer than someone expected.
  const fits = timeAvailable
      ? data.filter((s) => s.duration_seconds <= timeAvailable)
      : [];

  const chosen = fits.length ? fits[0] : data[data.length - 1];
  return { sessionId: chosen.id, durationSeconds: chosen.duration_seconds };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const SUPPORT = { route: "support" as const };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let text = "";
  let userId: string | null = null;

  try {
    const body = await req.json();
    text = String(body?.text ?? "").slice(0, MAX_INPUT_CHARS);
    userId = body?.user_id ?? null;
  } catch {
    // Cannot even parse the request. Fail closed.
    return Response.json(SUPPORT);
  }

  if (!text.trim()) {
    return Response.json({ route: "picker", reason: "empty_input" });
  }

  // -------------------------------------------------------------------------
  // GATE — layer 1
  // -------------------------------------------------------------------------
  if (layerOneFlags(text)) {
    await recordSafetyEvent(userId);
    return Response.json(SUPPORT);
  }

  // -------------------------------------------------------------------------
  // GATE — layer 2. Any error, timeout, or unexpected output routes to
  // support. Never falls open.
  // -------------------------------------------------------------------------
  try {
    const verdict = await callModel(GATE_SYSTEM, text, 8, GATE_TIMEOUT_MS);
    if (verdict.toUpperCase() !== "PASS") {
      await recordSafetyEvent(userId);
      return Response.json(SUPPORT);
    }
  } catch {
    await recordSafetyEvent(userId);
    return Response.json(SUPPORT);
  }

  // -------------------------------------------------------------------------
  // INTERPRETER — from here, failures fall back to the manual picker, which
  // is a safe non-AI path. The product works with the model down.
  // -------------------------------------------------------------------------
  let parsed: any;
  try {
    const raw = await callModel(
        INTERPRET_SYSTEM,
        text,
        200,
        INTERPRET_TIMEOUT_MS,
    );
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return Response.json({ route: "picker", reason: "interpreter_unavailable" });
  }

  // Validate against the closed taxonomy. Anything unexpected → picker.
  const current = parsed?.state_current;
  const target = parsed?.state_target;
  const confidence = Number(parsed?.confidence);

  const valid =
      STATES_CURRENT.includes(current) &&
      STATES_TARGET.includes(target) &&
      Number.isFinite(confidence);

  if (!valid || confidence < CONFIDENCE_FLOOR) {
    return Response.json({ route: "picker", reason: "low_confidence" });
  }

  const transitionKey = transitionKeyFor(current, target);
  if (!transitionKey) {
    return Response.json({ route: "picker", reason: "no_transition" });
  }

  const timeAvailable =
      Number.isFinite(parsed?.time_available_seconds)
          ? Number(parsed.time_available_seconds)
          : null;

  const session = await selectSession(transitionKey, timeAvailable);
  if (!session) {
    return Response.json({ route: "picker", reason: "no_session" });
  }

  // Structured extraction only. The raw text does not leave this function.
  return Response.json({
    route: "session",
    transition_key: transitionKey,
    session_id: session.sessionId,
    duration_seconds: session.durationSeconds,
    state_current: current,
    state_target: target,
    context_tag: parsed?.context_tag ?? null,
    taxonomy_version: TAXONOMY_VERSION,
  });
});