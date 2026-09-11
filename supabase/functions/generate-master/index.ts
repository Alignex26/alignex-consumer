// supabase/functions/generate-master/index.ts
//
// OPERATOR-ONLY MASTER GENERATION.
//
// Renders ONE approved localised script, in ONE voice, to raw audio, and stores
// it in the private bucket under `staging/`. It is the first half of producing
// a reusable intervention master.
//
// ===========================================================================
// WHY THIS ONLY DOES HALF THE JOB.
//
// The audio production specification requires AAC-LC, 44.1 kHz, mono, 96 kbps,
// -16 LUFS, true peak under -1 dBTP and edge silence trimmed to 100 ms. Meeting
// it means measuring and re-encoding, and that means ffmpeg — which cannot run
// in a Deno Edge Function. There is no binary to invoke and no way to ship one.
//
// So this function does the part that REQUIRES the provider key, and stops.
// `scripts/finalise-master.mjs` does the part that requires ffmpeg. The split
// falls exactly where the constraint is, and it preserves the property that
// motivated building this at all: the ElevenLabs key never leaves Supabase.
//
// Pretending otherwise was the alternative — storing an unconverted MP3 as a
// master and calling it spec-compliant. It would have failed the validator
// later, or worse, passed a machine without ffmpeg and shipped.
// ===========================================================================
//
// MASTER GENERATION IS NOT SESSION TTS. A master is produced once and reused by
// everyone forever. It therefore writes no `generated_segments` row, attaches to
// no user, belongs to no session, and does not touch the 30s/45s per-session
// dynamic budget — that budget governs speech generated *during* a session, and
// charging a one-off production render against it would be meaningless.
//
// NOTHING IT PRODUCES IS PLAYABLE YET. Synthesis is not approval. The rendition
// row is written by the finalise step with `approved = false`, and a human
// approves the recording separately from the content.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { createElevenLabsProvider, SynthesisError } from "../_shared/elevenlabs.ts";
import { forbidden, isOperator } from "../_shared/operator-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AUDIO_BUCKET = "intervention-audio";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fail = (failure: string, detail?: Record<string, unknown>) =>
  json({ ok: false, failure, ...(detail ?? {}) });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail("method_not_allowed");

  // OPERATOR ONLY, by verified JWT claim rather than by string equality with a
  // secret. The gateway has already checked the signature (this function has no
  // `[functions.*]` block, so `verify_jwt` defaults to true), which is what
  // makes reading the claim safe. See `_shared/operator-auth.ts`.
  //
  // Anon and authenticated users carry their own roles and are refused, so
  // nobody holding the key from the app bundle can reach a paid provider here.
  if (!isOperator(req)) return forbidden();

  let body: {
    module_key?: unknown;
    locale?: unknown;
    voice_profile?: unknown;
    version?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }

  // IDENTIFIERS ONLY. There is no `text` parameter and no way to add one
  // without changing this contract: the caller says WHICH approved script, and
  // the server fetches it. Arbitrary text cannot reach the provider through
  // this endpoint because there is nowhere to put it.
  const moduleKey = String(body.module_key ?? "");
  const locale = String(body.locale ?? "");
  const voiceProfile = String(body.voice_profile ?? "");
  const requestedVersion =
    typeof body.version === "number" ? body.version : null;

  if (!moduleKey || !locale || !voiceProfile) return fail("bad_request");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- The language must be real and content-ready -------------------------
  //
  // No cross-language fallback, here or anywhere. Generating an English script
  // and filing it as Spanish is exactly the mixed-language failure the composer
  // refuses to produce, and it would be worse arriving through production.
  const { data: localeRow } = await admin
    .from("locales")
    .select("id, is_content_ready")
    .eq("id", locale)
    .maybeSingle();

  const localeReady = (localeRow as { is_content_ready?: boolean } | null)?.is_content_ready;
  if (!localeRow) return fail("unknown_locale");
  if (!localeReady) return fail("locale_not_content_ready");

  // ---- The module -----------------------------------------------------------
  const { data: moduleRow } = await admin
    .from("intervention_modules")
    .select("id, module_key, is_active, approved")
    .eq("module_key", moduleKey)
    .maybeSingle();

  const module = moduleRow as
    | { id: string; module_key: string; is_active: boolean; approved: boolean }
    | null;

  if (!module) return fail("unknown_module");
  if (!module.is_active) return fail("module_inactive");

  // ---- The approved localised script ---------------------------------------
  //
  // This is the text that will be spoken, and it comes from the database rather
  // than from the request. Content approval is checked here; it is separate
  // from, and prior to, approving the recording that results.
  let versionQuery = admin
    .from("intervention_module_versions")
    .select("id, version, technique_key, locale, approved_at, withdrawn_at")
    .eq("module_id", module.id)
    .eq("locale", locale);

  if (requestedVersion !== null) versionQuery = versionQuery.eq("version", requestedVersion);

  const { data: versionRows } = await versionQuery.order("version", { ascending: false });

  const versions = (versionRows ?? []) as {
    id: string;
    version: number;
    technique_key: string;
    locale: string;
    approved_at: string | null;
    withdrawn_at: string | null;
  }[];

  const version = versions[0];
  if (!version) return fail("unknown_version");
  if (version.locale !== locale) return fail("locale_mismatch");
  if (version.withdrawn_at !== null) return fail("version_withdrawn");
  if (version.approved_at === null) return fail("content_not_approved");

  // The wording itself. Held on the version row as the approved localised
  // script; without it there is nothing legitimate to speak.
  const { data: scriptRow } = await admin
    .from("intervention_module_versions")
    .select("script_text")
    .eq("id", version.id)
    .maybeSingle();

  const script = (scriptRow as { script_text?: string } | null)?.script_text ?? "";
  if (!script.trim()) return fail("no_approved_script");

  // ---- Resolve the provider voice, server-side -----------------------------
  //
  // The operator names an ELSEA profile. A provider voice id is never sent in a
  // request, never copied into a command, and never leaves this function.
  const { data: profileRow } = await admin
    .from("voice_profiles")
    .select("id, is_active")
    .eq("id", voiceProfile)
    .maybeSingle();

  const profile = profileRow as { id: string; is_active: boolean } | null;
  if (!profile) return fail("unknown_voice_profile");
  if (!profile.is_active) return fail("voice_profile_unavailable");

  const { data: mappingRow } = await admin
    .from("provider_voice_mappings")
    .select("provider, provider_voice_id, is_active")
    .eq("voice_profile", voiceProfile)
    .eq("locale", locale)
    .eq("is_active", true)
    .maybeSingle();

  const mapping = mappingRow as
    | { provider: string; provider_voice_id: string; is_active: boolean }
    | null;

  // Fails closed. An unmapped voice is not quietly rendered in some other one.
  if (!mapping) return fail("no_provider_mapping");
  if (mapping.provider !== "elevenlabs") return fail("unsupported_provider");

  // ---- Synthesise ----------------------------------------------------------
  //
  // Raw provider output, stored under `staging/`. Not a master, not a rendition,
  // and deliberately nowhere near the paths the composer signs.
  const stagingPath = `staging/${locale}/${voiceProfile}/${moduleKey}.v${version.version}.mp3`;

  const store = async (path: string, bytes: Uint8Array) => {
    const { error } = await admin.storage
      .from(AUDIO_BUCKET)
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error("upload failed");
  };

  // The adapter derives its own path from the cache key, so the key IS the
  // staging path here. Nothing a person typed is involved: it is built from a
  // module key, a locale, a voice and a version number.
  const provider = createElevenLabsProvider(
    (key) => (key === "ELEVENLABS_VOICE_ID" ? mapping.provider_voice_id : Deno.env.get(key)),
    async (_derived, bytes) => store(stagingPath, bytes)
  );

  let result;
  try {
    result = await provider.synthesise({
      text: script,
      voice: voiceProfile,
      characterCount: script.length,
      cacheKey: `${locale}:${voiceProfile}:${moduleKey}:v${version.version}`,
      // Production render, not session speech: this is not measured against the
      // per-session dynamic budget, which governs speech generated during a
      // session. A duration is measured properly by the finalise step.
      estimatedSeconds: 0,
    });
  } catch (error) {
    const failure = error instanceof SynthesisError ? error.failure : "provider_error";
    // Our vocabulary only. No secret, no provider body, no script.
    return fail(failure);
  }

  return json({
    ok: true,
    module_key: moduleKey,
    locale,
    voice_profile: voiceProfile,
    version: version.version,
    module_version_id: version.id,
    staging_path: stagingPath,
    characters: result.billedCharacters,
    // Explicitly NOT a rendition and NOT playable. The finalise step converts to
    // specification, measures the real duration, and writes the rendition row
    // with approved = false for a human to approve.
    rendition_written: false,
    approved: false,
    next: "scripts/finalise-master.mjs",
  });
});
