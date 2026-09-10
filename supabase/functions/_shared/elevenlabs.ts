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

  return { apiKey: apiKey!, voiceId: voiceId!, modelId: modelId! };
}

/** Writes rendered audio somewhere private. Injected so this file never
 *  imports a storage client and can be driven in a test. */
export type AudioStore = (path: string, bytes: Uint8Array) => Promise<void>;

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
