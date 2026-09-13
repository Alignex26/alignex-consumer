import type { SynthesisRequest, SynthesisResult, VoiceProvider } from './provider.ts';

/**
 * ElevenLabs, behind the existing provider boundary.
 *
 * EVERYTHING VENDOR-SPECIFIC STOPS HERE. The endpoint, the header name, the
 * request body, the audio format and the failure modes are all confined to this
 * file. The rest of ELSEA asks for speech through `VoiceProvider` and would not
 * notice this being replaced — which is Rule 7, and the reason the boundary was
 * written before any provider existed.
 *
 * CONFIGURATION COMES FROM THE ENVIRONMENT, NEVER FROM DOMAIN LOGIC. The voice
 * and the model are Edge Function secrets. Embedding a model id in composition
 * would make changing model a code change, and would put a vendor's vocabulary
 * into ELSEA's domain.
 *
 * NOTHING HERE DECIDES WHAT TO SAY OR WHETHER TO SAY IT. The text arrives
 * already built from structured state, already budgeted, already keyed. This
 * file turns text into bytes.
 */

/** The three secrets. Read at call time so a missing one fails loudly, once. */
type ElevenLabsConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  /** Absent unless ELEVENLABS_SPEED is set. Absent means the request body is
   *  byte-identical to what it was before pace was configurable. */
  speed?: number;
  /** Set when the operator has confirmed the configured model honours speed,
   *  which lets a model absent from the known-good list be adopted without a
   *  code change. */
  speedSupported?: boolean;
};

export type ProviderFailure =
  | 'not_configured'
  | 'auth_failed'
  | 'invalid_voice'
  | 'invalid_model'
  | 'rate_limited'
  | 'timeout'
  | 'bad_audio'
  | 'storage_failed'
  | 'speed_unsupported'
  | 'speed_out_of_range'
  | 'provider_error';

export class SynthesisError extends Error {
  readonly failure: ProviderFailure;

  constructor(failure: ProviderFailure, detail?: string) {
    // The detail is ours, never the vendor's raw body and never any input.
    // A provider error message can echo the submitted text back, which would
    // put speech content into a log by accident.
    super(`[ELSEA] speech ${failure}${detail ? `: ${detail}` : ''}`);
    this.name = 'SynthesisError';
    this.failure = failure;
  }
}

/**
 * Reads configuration, or says precisely what is missing.
 *
 * Names only. A value is never returned in an error, logged, or included in
 * anything that leaves this process.
 */
export function readConfig(env: (key: string) => string | undefined): ElevenLabsConfig {
  const apiKey = env('ELEVENLABS_API_KEY');
  const voiceId = env('ELEVENLABS_VOICE_ID');
  const modelId = env('ELEVENLABS_MODEL_ID');

  const missing = [
    apiKey ? null : 'ELEVENLABS_API_KEY',
    voiceId ? null : 'ELEVENLABS_VOICE_ID',
    modelId ? null : 'ELEVENLABS_MODEL_ID',
  ].filter((n): n is string => n !== null);

  if (missing.length > 0) {
    throw new SynthesisError('not_configured', `missing ${missing.join(', ')}`);
  }

  const speedSupported = env('ELEVENLABS_SPEED_SUPPORTED') === 'true';

  const rawSpeed = env('ELEVENLABS_SPEED');
  if (rawSpeed === undefined || rawSpeed.trim() === '') {
    return { apiKey: apiKey!, voiceId: voiceId!, modelId: modelId!, speedSupported };
  }

  const speed = Number(rawSpeed);
  if (!Number.isFinite(speed)) {
    throw new SynthesisError('not_configured', 'ELEVENLABS_SPEED is not a number');
  }

  return { apiKey: apiKey!, voiceId: voiceId!, modelId: modelId!, speed, speedSupported };
}

/**
 * Decides the pace for one request, and refuses rather than send something the
 * model will ignore.
 *
 * Returns undefined when nothing asked for a change, which is what keeps the
 * default behaviour byte-identical: no `voice_settings` is sent at all.
 */
export function resolveSpeed(
  config: ElevenLabsConfig,
  requested: number | undefined
): number | undefined {
  const speed = requested ?? config.speed;
  if (speed === undefined || speed === SPEED_NORMAL) return undefined;

  if (!Number.isFinite(speed) || speed < SPEED_MIN || speed > SPEED_MAX) {
    throw new SynthesisError('speed_out_of_range', `${SPEED_MIN}-${SPEED_MAX}`);
  }

  if (!config.speedSupported && !SPEED_CAPABLE_MODELS.has(config.modelId)) {
    // The model id is a configuration value, not a credential, and naming it is
    // the whole use of this error: it says exactly what to change, and
    // ELEVENLABS_SPEED_SUPPORTED=true is the way to override this judgement
    // without touching code.
    throw new SynthesisError('speed_unsupported', config.modelId);
  }

  return speed;
}

/** Writes rendered audio somewhere private. Injected so this file never
 *  imports a storage client and can be driven in a test. */
export type AudioStore = (path: string, bytes: Uint8Array) => Promise<void>;

/**
 * DELIVERY PACE.
 *
 * ElevenLabs carries this as `voice_settings.speed`, a multiple of the voice's
 * normal speaking rate. It is NOT universal across their models — the v3 line
 * takes direction through inline audio tags instead and ignores the field — so
 * sending it blind produces audio at the original pace, with a 200 response and
 * nothing anywhere to explain the result.
 *
 * WHY A LIST OF MODEL IDS LIVES HERE, given that the model is configuration.
 *
 * The rule this sits against is that no model id belongs in code, so that
 * changing model is never a code change. That rule is about CHOOSING a model,
 * and nothing here chooses one: the model still comes from the environment and
 * this file has no default and no fallback.
 *
 * What this is instead is vendor knowledge — which models honour which field —
 * and vendor knowledge is precisely what this file exists to contain. Keeping it
 * out would mean either sending the field blind, or asking ELSEA's domain to know
 * about ElevenLabs model families. Both are worse.
 *
 * AND IT IS NOT A GATE ON ADOPTION. `ELEVENLABS_SPEED_SUPPORTED=true` overrides
 * the list, so a new speed-capable model can be adopted by configuration alone.
 * The list is the safe default, not the authority.
 */
const SPEED_CAPABLE_MODELS = new Set([
  'eleven_multilingual_v2',
  'eleven_turbo_v2',
  'eleven_turbo_v2_5',
  'eleven_flash_v2',
  'eleven_flash_v2_5',
]);

/** The provider's accepted range. Outside it the request is rejected. */
const SPEED_MIN = 0.7;
const SPEED_MAX = 1.2;

/** Pace is unchanged unless something asks for a different one. */
export const SPEED_NORMAL = 1.0;

const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

/** Generous enough for a long line, short enough that a hung provider does not
 *  hold a session open. */
const TIMEOUT_MS = 30_000;

/**
 * Maps a provider status onto our own vocabulary.
 *
 * Deliberately does not pass the vendor's message through: their error bodies
 * can quote the submitted text back, and that text would then reach a log.
 */
function failureFor(status: number): ProviderFailure {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 404) return 'invalid_voice';
  if (status === 422) return 'invalid_model';
  if (status === 429) return 'rate_limited';
  return 'provider_error';
}

export function createElevenLabsProvider(
  env: (key: string) => string | undefined,
  store: AudioStore,
  fetchImpl: typeof fetch = fetch
): VoiceProvider {
  return {
    id: 'elevenlabs',

    async synthesise(request: SynthesisRequest): Promise<SynthesisResult> {
      const config = readConfig(env);

      // The caller owns the budget and has already enforced it. This is a
      // backstop against a future path that forgets: a provider call is the
      // point where money is spent, so it refuses obviously unbounded input
      // rather than trusting that somebody checked.
      if (!request.text || request.characterCount <= 0) {
        throw new SynthesisError('provider_error', 'empty request');
      }

      // Resolved before the call, so an unsupported or out-of-range pace costs
      // nothing. A provider call is where money is spent.
      const speed = resolveSpeed(config, request.speed);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetchImpl(
          `${ENDPOINT}/${encodeURIComponent(config.voiceId)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'xi-api-key': config.apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text: request.text,
              model_id: config.modelId,
              // Only present when a pace was actually asked for. With no speed
              // configured and none requested this object is absent and the
              // body is exactly what it was before pace existed.
              ...(speed === undefined ? {} : { voice_settings: { speed } }),
            }),
          }
        );
      } catch (error) {
        const aborted = (error as { name?: string })?.name === 'AbortError';
        throw new SynthesisError(aborted ? 'timeout' : 'provider_error');
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Status only. The body is not read, so it cannot be logged.
        throw new SynthesisError(failureFor(response.status), `status ${response.status}`);
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        throw new SynthesisError('bad_audio', 'empty response');
      }

      // The path is derived from the cache key, which is derived entirely from
      // structured state. Nothing a person typed can reach a storage path.
      const path = `generated/${request.voice}/${request.cacheKey}.mp3`;

      try {
        await store(path, bytes);
      } catch {
        throw new SynthesisError('storage_failed');
      }

      return {
        storagePath: path,
        // The provider does not return a duration, and decoding here would mean
        // shipping a decoder into an Edge Function. The estimate the budget was
        // enforced against is carried forward and the real length is measured
        // where the file can be read.
        durationSeconds: request.estimatedSeconds,
        // What was submitted, which is what is billed — including any output
        // later discarded. Measured, never assumed from the estimate.
        billedCharacters: request.text.length,
      };
    },
  };
}
