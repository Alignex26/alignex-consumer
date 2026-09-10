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
// THE SAME composer the tests exercise. Calling `planPhases` directly and
// assembling the manifest here would leave the bed, the ordinals and the
// manifest wrapper duplicated — tests green, production subtly different.
import { compose } from "../_shared/compose.ts";
// Recording WHAT was composed, so that a freshness policy has a history to read
// when one is decided. This applies no policy: nothing here deprioritises a
// module, and no recency weighting is active. See the migration
// `20260909180000_persist_fingerprint.sql`.
import { manifestFingerprint } from "../_shared/novelty.ts";
import { BUDGET_NORMAL_SECONDS } from "../_shared/speech.ts";
import type {
  InterventionModule,
  ManifestSegment,
  ModuleFamily,
  RecipePhase,
  SessionManifest,
} from "../_shared/types.ts";

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

/** The private bucket holding approved intervention masters. */
const AUDIO_BUCKET = "intervention-audio";

/**
 * How long a playable URL stays valid.
 *
 * Long enough for the longest session plus a retry or a pause-and-resume; far
 * short of permanent, so a leaked URL is not a leaked library. Two hours.
 */
const SIGNED_URL_TTL_SECONDS = 7200;

type PhaseRow = { ordinal: number; phase: string; min_seconds: number; max_seconds: number };

type ModuleRow = {
  id: string;
  module_key: string;
  family: string;
  technique_key: string;
  storage_path: string;
  duration_seconds: number;
  intensity: number;
  requires_headphones: boolean;
  is_bed: boolean;
  /** The CURRENT content version. Part of a manifest's identity: replacing a
   *  module's audio makes a session built from it a different experience. */
  version: number;
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

const toModule = (row: ModuleRow): InterventionModule => ({
  id: row.id,
  moduleKey: row.module_key,
  family: row.family as ModuleFamily,
  techniqueKey: row.technique_key,
  storagePath: row.storage_path,
  durationSeconds: row.duration_seconds,
  intensity: row.intensity,
  requiresHeadphones: row.requires_headphones,
  isBed: row.is_bed,
});

/** Domain manifest -> wire. The only thing this function does that the
 *  shared composer does not, because the wire shape is snake_case. */
function toWire(
  segment: ManifestSegment,
  signedUrls: Map<string, string>,
): Record<string, unknown> {
  const base = {
    kind: segment.kind,
    ordinal: segment.ordinal,
    layer: segment.layer,
    offset_seconds: segment.offsetSeconds,
    duration_seconds: segment.durationSeconds,
  };

  if (segment.kind === "module") {
    return {
      ...base,
      module_id: segment.moduleId,
      module_key: segment.moduleKey,
      // The signed URL, not the storage path. The client cannot reach the
      // bucket, and the path would tell it nothing except what the library is
      // called.
      audio_url: signedUrls.get(segment.storagePath) ?? null,
      phase: segment.phase,
    };
  }

  if (segment.kind === "silence") return { ...base, phase: segment.phase };

  // Generated speech carries no path yet; no provider is wired.
  return base;
}

/**
 * Records what was composed.
 *
 * ONLY FOR A SIGNED-IN PERSON. This endpoint is callable by anyone holding the
 * public key, so persisting every anonymous call would let a stranger write
 * unbounded rows. It also would not buy anything: the point of storing a
 * manifest is to join it to a run and an outcome, and those only exist for
 * someone signed in.
 *
 * BEST-EFFORT, ALWAYS. A failure here returns null and the session proceeds
 * without a manifest id. Bookkeeping must never cost somebody their session,
 * and the gap stays visible in the data as a run with no manifest rather than
 * being hidden.
 *
 * If the segments fail to insert, the manifest row is removed again. A
 * manifest with no segments is not a smaller record, it is a false one.
 */
async function persistManifest(
  admin: ReturnType<typeof createClient>,
  userId: string | null,
  manifest: SessionManifest,
  fingerprint: string,
): Promise<string | null> {
  if (!userId) return null;

  try {
    // One transaction, server-side. The manifest and its segments commit
    // together or not at all.
    //
    // This replaced two separate inserts with a hand-written compensating
    // delete when the second failed — but that delete is itself a write that
    // can fail, so a dropped connection between the two left an orphan
    // manifest with no segments. Postgres does the rollback properly.
    const { data, error } = await admin.rpc("persist_session_manifest", {
      p_user_id: userId,
      p_transition_key: manifest.transitionKey,
      p_duration_seconds: manifest.durationSeconds,
      p_recipe_version: manifest.recipeVersion,
      p_dynamic_seconds: manifest.dynamicSeconds,
      p_fingerprint: fingerprint,
      p_segments: manifest.segments.map((segment) => ({
        ordinal: segment.ordinal,
        kind: segment.kind,
        module_id: segment.kind === "module" ? segment.moduleId : null,
        // Generated speech needs its `generated_segments` row first. Nothing
        // produces speech yet; the table's check constraint rejects a
        // generated segment without one, and the whole transaction rolls back.
        generated_id: null,
        layer: segment.layer,
        offset_seconds: segment.offsetSeconds,
        duration_seconds: segment.durationSeconds,
      })),
    });

    if (error || !data) return null;
    return data as string;
  } catch {
    // Bookkeeping must never cost somebody their session. The gap stays
    // visible in the data as a run with no manifest rather than hidden.
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, failure: "method_not_allowed" }, 405);

  let body: {
    transition_key?: unknown;
    duration_seconds?: unknown;
    voice_profile?: unknown;
    locale?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, failure: "bad_request" }, 400);
  }

  const transitionKey = String(body.transition_key ?? "");
  const durationSeconds = Number(body.duration_seconds ?? 0);

  // The voice the caller asked for. A saved preference is read from the
  // database below and wins over this; the body is only how a signed-out
  // person, or one who has just chosen on the picker, expresses a choice.
  // Unrecognised values are ignored rather than rejected: a voice this build
  // does not know about is a reason to use the default, not to fail a session.
  const requestedVoice =
    typeof body.voice_profile === "string" ? body.voice_profile : null;

  const requestedLocale =
    typeof body.locale === "string" ? body.locale : null;

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

  // ---- Which language ------------------------------------------------------
  //
  // A LANGUAGE IS NEVER FALLEN BACK FROM. If somebody asks for Spanish and no
  // complete approved Spanish library exists, the Spanish experience is
  // unavailable — it does not quietly become English, and it never becomes a
  // session with some of each. A mixed-language session would be a worse
  // failure than no session, because nobody would report it as a bug.
  //
  // Only a CONTENT-READY locale is honoured. `is_enabled` is the product
  // intention; `is_content_ready` is whether a complete approved library
  // actually exists, and only the second can be composed from.
  const { data: localeRows } = await admin
    .from("locales")
    .select("id, is_enabled, is_content_ready")
    .eq("is_content_ready", true);

  const readyLocales = (localeRows ?? []) as {
    id: string;
    is_enabled: boolean;
    is_content_ready: boolean;
  }[];

  let savedLocale: string | null = null;

  // ---- Which voice ---------------------------------------------------------
  //
  // A saved preference is authoritative for a signed-in person: it is what
  // they chose, and a stale client should not override it. Everything falls
  // back to the profile marked default, so an unknown or retired voice
  // resolves rather than failing.
  const { data: profileRows } = await admin
    .from("voice_profiles")
    .select("id, is_default")
    .eq("is_active", true);

  const profiles = (profileRows ?? []) as { id: string; is_default: boolean }[];
  const defaultVoice = profiles.find((p) => p.is_default)?.id ?? "warm";

  let savedVoice: string | null = null;
  if (userId) {
    const { data } = await admin
      .from("user_preferences")
      .select("voice_profile, locale")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = data as { voice_profile?: string; locale?: string } | null;
    savedVoice = prefs?.voice_profile ?? null;
    savedLocale = prefs?.locale ?? null;
  }

  const known = (v: string | null) =>
    v !== null && profiles.some((p) => p.id === v) ? v : null;

  const voice = known(savedVoice) ?? known(requestedVoice) ?? defaultVoice;

  // A saved preference wins, then the request, then English. Whichever is
  // chosen, it must be content-ready: an unavailable language FAILS rather than
  // resolving to a different one.
  const asked = savedLocale ?? requestedLocale ?? "en";
  const localeReady = readyLocales.some((l) => l.id === asked);

  if (!localeReady) {
    // Named distinctly so this is never mistaken for an empty library. The
    // caller learns the language is unavailable, not that ELSEA is broken.
    return fail("locale_unavailable");
  }

  const locale = asked;

  // ---- The recipe ---------------------------------------------------------
  const { data: phaseRows } = await admin
    .from("recipe_phases")
    .select("ordinal, phase, min_seconds, max_seconds")
    .eq("transition_key", transitionKey)
    .order("ordinal", { ascending: true });

  const rows = (phaseRows ?? []) as PhaseRow[];
  if (rows.length === 0) return fail("no_recipe");

  const phases: RecipePhase[] = rows.map((r) => ({
    transitionKey: transitionKey,
    ordinal: r.ordinal,
    phase: r.phase,
    minSeconds: r.min_seconds,
    maxSeconds: r.max_seconds,
    // Provisional until clinical review (S14); carried, never assumed.
    isProvisional: true,
  }));

  const { data: familyRows } = await admin
    .from("recipe_phase_families")
    .select("phase, family")
    .eq("transition_key", transitionKey);

  const familiesByPhase = new Map<string, string[]>();
  for (const row of (familyRows ?? []) as { phase: string; family: string }[]) {
    const list = familiesByPhase.get(row.phase) ?? [];
    list.push(row.family);
    familiesByPhase.set(row.phase, list);
  }

  // ---- The library --------------------------------------------------------
  const { data: moduleRows } = await admin
    .from("intervention_modules")
    .select(
      "id, module_key, family, technique_key, storage_path, duration_seconds, intensity, requires_headphones, is_bed, version",
    )
    .eq("is_active", true)
    .eq("approved", true);

  const modules = (moduleRows ?? []) as ModuleRow[];
  if (modules.length === 0) return fail("library_empty");

  // ---- Which recording of each module -------------------------------------
  //
  // A module's identity is its technique, its wording and its approval. None of
  // that changes because a different person read it. So the module is chosen
  // first, on its own merits, and only then does the voice decide WHICH
  // RECORDING of it plays.
  //
  // BOTH approvals must hold. The module's flag says the content is approved;
  // the rendition's says this recording of it is. A bad take of approved
  // wording is not playable, and approving a module does not bless every future
  // recording of it.
  const { data: renditionRows } = await admin
    .from("module_renditions")
    .select("module_id, voice_profile, locale, storage_path, duration_seconds")
    .eq("approved", true)
    .eq("is_active", true)
    // THE LANGUAGE BOUNDARY. Filtering here means a rendition in another
    // language is never a candidate, so the voice fallback below cannot cross
    // one even by accident. Voice falls back; language does not.
    .eq("locale", locale)
    .in("voice_profile", [voice, defaultVoice])
    .in("module_id", modules.map((m) => m.id));

  const renditions = ((renditionRows ?? []) as {
    module_id: string;
    voice_profile: string;
    locale: string;
    storage_path: string;
    duration_seconds: number;
  }[])
    // Belt and braces. The query already filters, and a rendition from another
    // language must not survive a future refactor of that query either.
    .filter((r) => r.locale === locale);

  // Requested voice wins; the default is the fallback. Resolved per module, so
  // a library where only some modules have been recorded in the second voice
  // still composes — those modules simply play in the default voice rather than
  // dropping out of the session.
  const audioFor = new Map<string, string>();
  for (const r of renditions) {
    if (r.voice_profile === voice) audioFor.set(r.module_id, r.storage_path);
    else if (!audioFor.has(r.module_id)) audioFor.set(r.module_id, r.storage_path);
  }

  // A module with no approved rendition in either voice has nothing to play.
  // It is removed BEFORE selection rather than substituted afterwards: the
  // allocator must never choose something that cannot sound, and nothing
  // unapproved is ever put in its place.
  const playable = modules.filter((m) => audioFor.has(m.id));
  if (playable.length === 0) return fail("library_empty");

  // ---- This person's history ---------------------------------------------
  let effectiveness: { moduleId: string; positive: number; total: number }[] = [];
  if (userId) {
    const { data } = await admin
      .from("module_effectiveness")
      .select("module_id, positive, total")
      .eq("user_id", userId);

    const rows = (data ?? []) as { module_id: string; positive: number; total: number }[];
    effectiveness = rows.map((r) => ({
      moduleId: r.module_id,
      positive: r.positive,
      total: r.total,
    }));
  }

  // ---- Compose ------------------------------------------------------------
  //
  // Nothing about the budget comes from the caller, and no speech is requested:
  // no provider is wired, so a session speaks nothing and bills nothing. That
  // is also the guardrail — narration must be impossible by default.
  //
  // A module qualifies on FAMILY ELIGIBILITY, never on merely existing. A phase
  // whose families match nothing approved cannot be filled and the composition
  // fails, which is correct: better no session than an unapproved one.
  // Rendition paths, not the deprecated per-module one. Durations stay the
  // module's: the allocator plans with the canonical length so the SAME
  // techniques are chosen whichever voice is playing. Only the recording
  // differs, which is the whole point.
  const library = playable.map((row) => ({
    ...toModule(row),
    storagePath: audioFor.get(row.id)!,
  }));
  const modulesByPhase: Record<string, InterventionModule[]> = {};

  for (const phase of phases) {
    const eligible = familiesByPhase.get(phase.phase) ?? [];
    modulesByPhase[phase.phase] = library.filter(
      (m) => !m.isBed && eligible.includes(m.family),
    );
  }

  const result = compose({
    transitionKey,
    durationSeconds,
    phases,
    modulesByPhase,
    bed: library.find((m) => m.isBed) ?? null,
    effectiveness,
    speech: [],
  });

  if (!result.ok) return fail(result.failure);

  const { manifest } = result;

  // Resolve every module's audio to a short-lived signed URL. The bucket is
  // private and has no client policy, so a storage PATH is useless to the app —
  // only these URLs are playable, and only for a couple of hours.
  //
  // A module whose audio cannot be signed is not playable. Rather than hand the
  // client a segment it will silently render as silence, the whole composition
  // fails: better no session than one with holes the person cannot explain.
  const paths = [
    ...new Set(
      manifest.segments
        .filter((seg) => seg.kind === "module")
        .map((seg) => (seg as { storagePath: string }).storagePath),
    ),
  ];

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await admin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    for (const entry of urls ?? []) {
      if (entry.signedUrl && !entry.error) signed.set(entry.path ?? "", entry.signedUrl);
    }
  }

  if (signed.size !== paths.length) return fail("audio_unavailable");

  // The composition's identity, built from the module versions actually used.
  // Recorded, not acted upon: no recency penalty is applied anywhere in this
  // function, and none will be until the lookback and weighting are decided.
  const versions = new Map(playable.map((row) => [row.id, row.version]));
  const fingerprint = manifestFingerprint(manifest, versions);

  const manifestId = await persistManifest(admin, userId, manifest, fingerprint);

  return json({
    ok: true,
    manifest: {
      manifest_id: manifestId,
      transition_key: manifest.transitionKey,
      // What was actually composed, which can be under the request when every
      // phase is at its ceiling. Reporting the request would be a lie.
      duration_seconds: manifest.durationSeconds,
      recipe_version: manifest.recipeVersion,
      dynamic_seconds: manifest.dynamicSeconds,
      exceptional_speech: manifest.dynamicSeconds > BUDGET_NORMAL_SECONDS,
      segments: manifest.segments.map((seg) => toWire(seg, signed)),
    },
  });
});
