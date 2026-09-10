// supabase/functions/voice-check/index.ts
//
// ONE-OFF INTEGRATION PROOF, not a product endpoint.
//
// Proves the chain that nothing else can prove without spending money on real
// content: Edge Function -> ElevenLabs -> audio -> private storage -> a
// short-lived signed URL.
//
// WHY IT IS SAFE TO HAVE DEPLOYED.
//
//   - It takes NO INPUT. The phrase is a fixed engineering string compiled in.
//     There is no request body, no query parameter and no path segment that can
//     change what is spoken, so it cannot be turned into a way of spending
//     somebody else's credit on arbitrary text.
//   - It requires the SERVICE ROLE key. The public anon key is refused, so a
//     caller holding the key from the app bundle cannot reach it at all.
//   - It writes to a `checks/` prefix in the private bucket, nowhere near
//     intervention masters or the generated-speech cache.
//
// WHAT IT DELIBERATELY DOES NOT DO. It writes no `generated_segments` row. That
// table is the production speech cache, keyed on structured state, and this
// phrase has no state to key on — inventing a context so a test could be cached
// would put an engineering string into the cache real sessions read from.

import { createClient } from "jsr:@supabase/supabase-js@2";

import { createElevenLabsProvider, SynthesisError } from "../_shared/elevenlabs.ts";
import { DynamicBudget, estimateSpeechSeconds } from "../_shared/speech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AUDIO_BUCKET = "intervention-audio";
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The phrase. Fixed, neutral, and not intervention content.
 *
 * It is compiled in rather than accepted from the caller so this endpoint has
 * exactly one thing it can ever say.
 */
const PHRASE = "ELSEA voice integration test.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, failure: "method_not_allowed" }, 405);

  // Service role only. Not callable with the key that ships in the app.
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return json({ ok: false, failure: "forbidden" }, 403);
  }

  const estimatedSeconds = estimateSpeechSeconds(PHRASE);

  // The budget is checked BEFORE the provider is reached, even here, where the
  // phrase is two seconds long and could not possibly exceed it. The point is
  // that no path to a paid call skips the check.
  if (estimatedSeconds > DynamicBudget.ceilingSeconds) {
    return json({ ok: false, failure: "budget_exceeded", estimatedSeconds });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const store = async (path: string, bytes: Uint8Array) => {
    const { error } = await admin.storage
      .from(AUDIO_BUCKET)
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (error) throw new Error("upload failed");
  };

  const provider = createElevenLabsProvider((key) => Deno.env.get(key), store);

  let result;
  try {
    result = await provider.synthesise({
      text: PHRASE,
      voice: "check",
      characterCount: PHRASE.length,
      // Not a real cache key: a fixed name under a separate prefix, so this can
      // never collide with or be mistaken for cached production speech.
      cacheKey: "integration_check",
      estimatedSeconds,
    });
  } catch (error) {
    const failure = error instanceof SynthesisError ? error.failure : "provider_error";
    // The failure vocabulary only. No secret, no vendor body, no input.
    return json({ ok: false, failure });
  }

  const { data: signed } = await admin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(result.storagePath, SIGNED_URL_TTL_SECONDS);

  if (!signed?.signedUrl) {
    return json({ ok: false, failure: "audio_unavailable", stored: true });
  }

  return json({
    ok: true,
    provider: provider.id,
    // The configured model and voice are reported as CONFIGURED or MISSING,
    // never by value: a voice id is not a secret but the habit of printing
    // configuration is how a key eventually gets printed too.
    model_configured: Boolean(Deno.env.get("ELEVENLABS_MODEL_ID")),
    voice_configured: Boolean(Deno.env.get("ELEVENLABS_VOICE_ID")),
    characters: result.billedCharacters,
    estimated_seconds: Number(estimatedSeconds.toFixed(2)),
    storage_path: result.storagePath,
    signed_url_ttl_seconds: SIGNED_URL_TTL_SECONDS,
    signed_url: signed.signedUrl,
  });
});
