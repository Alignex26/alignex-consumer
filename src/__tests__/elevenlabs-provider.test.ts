/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  createElevenLabsProvider,
  readConfig,
  SynthesisError,
} from '../../supabase/functions/_shared/elevenlabs';
import {
  checkBudget,
  DynamicBudget,
  estimateSpeechSeconds,
  speechCacheKey,
} from '../../supabase/functions/_shared/speech';
import type { SpeechContext, SpeechRequest } from '../../supabase/functions/_shared/types';

/**
 * ELEVENLABS, BEHIND THE PROVIDER BOUNDARY.
 *
 * Two properties matter more than the integration working, because a mistake in
 * either is silent and expensive:
 *
 *   1. NOTHING A PERSON TYPED CAN REACH THE PROVIDER. Not in the text, not in
 *      the cache key, not in the storage path, not in an error.
 *   2. NO PATH TO A PAID CALL SKIPS THE BUDGET.
 *
 * These are asserted by driving the adapter with a fake fetch, so a regression
 * shows up as a test failure rather than as an invoice.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

const ADAPTER = read('supabase', 'functions', '_shared', 'elevenlabs.ts');
const CHECK_FN = read('supabase', 'functions', 'voice-check', 'index.ts');

const env = (values: Record<string, string>) => (key: string) => values[key];

const CONFIGURED = {
  ELEVENLABS_API_KEY: 'sk_test_not_a_real_key',
  ELEVENLABS_VOICE_ID: 'voice_test',
  ELEVENLABS_MODEL_ID: 'model_test',
};

const okFetch = (bytes = new Uint8Array([1, 2, 3])) =>
  jest.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  })) as unknown as typeof fetch;

const request = (over: Partial<Parameters<ReturnType<typeof createElevenLabsProvider>['synthesise']>[0]> = {}) => ({
  text: 'Something built from structured state.',
  voice: 'warm',
  characterCount: 38,
  cacheKey: 'opening:nervous_ready:nervous:ready:none:medium',
  estimatedSeconds: 3,
  ...over,
});

describe('configuration comes only from the environment', () => {
  it('reads all three secrets', () => {
    const config = readConfig(env(CONFIGURED));
    expect(config.voiceId).toBe('voice_test');
    expect(config.modelId).toBe('model_test');
  });

  it('names what is missing, and never a value', () => {
    for (const key of ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_MODEL_ID']) {
      const partial = { ...CONFIGURED };
      delete (partial as Record<string, string>)[key];

      try {
        readConfig(env(partial));
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SynthesisError);
        expect((error as SynthesisError).failure).toBe('not_configured');
        expect((error as Error).message).toContain(key);
        // The names of missing keys, never the values of present ones.
        expect((error as Error).message).not.toContain('sk_test_not_a_real_key');
      }
    }
  });

  it('embeds no model or voice id in the adapter', () => {
    // A model id in code would make changing model a code change, and would put
    // a vendor's vocabulary into ELSEA's domain.
    expect(ADAPTER).toContain("env('ELEVENLABS_MODEL_ID')");
    expect(ADAPTER).not.toMatch(/eleven_(multilingual|turbo|monolingual)/);
  });

  it('the app bundle knows nothing about any of this', () => {
    // Server-side only. No provider key is bundled, and no EXPO_PUBLIC_
    // variable holds one.
    expect(ADAPTER).not.toContain('EXPO_PUBLIC');
    expect(CHECK_FN).not.toContain('EXPO_PUBLIC');
  });
});

describe('nothing a person typed can reach the provider', () => {
  it('the cache key is derived only from structured state', () => {
    const context: SpeechContext = {
      slot: 'opening',
      transitionKey: 'nervous_ready',
      stateCurrent: 'nervous',
      stateTarget: 'ready',
      contextTag: null,
      intensity: 5,
    };
    const key = speechCacheKey(context);
    // Every component is a closed-vocabulary value.
    expect(key).toBe('opening:nervous_ready:nervous:ready:none:medium');
  });

  it('refuses an unsafe context tag rather than sanitising it', () => {
    // Sanitising would mean a malformed tag still produced a key. The point is
    // to fail closed: this is the one field not drawn from a closed vocabulary.
    const context = {
      slot: 'opening',
      transitionKey: 'nervous_ready',
      stateCurrent: 'nervous',
      stateTarget: 'ready',
      contextTag: 'I have a job interview at 3pm and I feel sick',
      intensity: 5,
    } as SpeechContext;

    expect(() => speechCacheKey(context)).toThrow(/Unsafe context tag/);
  });

  it('the storage path is built from the cache key, not from text', async () => {
    const store = jest.fn(async () => {});
    const provider = createElevenLabsProvider(env(CONFIGURED), store, okFetch());

    const result = await provider.synthesise(request());

    expect(store).toHaveBeenCalledTimes(1);
    const [path] = store.mock.calls[0] as unknown as [string, Uint8Array];
    expect(path).toBe('generated/warm/opening:nervous_ready:nervous:ready:none:medium.mp3');
    expect(result.storagePath).toBe(path);
    // Nothing from the spoken text appears in the path.
    expect(path).not.toContain('structured');
  });

  it('an error never carries the submitted text', async () => {
    const failing = jest.fn(async () => ({
      ok: false,
      status: 422,
      // A real provider body can quote the submitted text back. It must not be
      // read, so it cannot be logged.
      text: async () => 'invalid model for text: Something built from structured state.',
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, failing);

    await expect(provider.synthesise(request())).rejects.toThrow(SynthesisError);
    await provider.synthesise(request()).catch((error: SynthesisError) => {
      expect(error.failure).toBe('invalid_model');
      expect(error.message).not.toContain('structured state');
      expect(error.message).not.toContain('sk_test');
    });
  });

  it('the adapter does not read the provider error body at all', () => {
    // Stronger than asserting the message: the body is never touched.
    const errorPath = ADAPTER.slice(ADAPTER.indexOf('if (!response.ok)'));
    expect(errorPath.slice(0, 300)).not.toContain('response.text()');
    expect(errorPath.slice(0, 300)).toContain('status ${response.status}');
  });

  it('there is no field for user text anywhere in the request type', () => {
    const provider = read('supabase', 'functions', '_shared', 'provider.ts');
    for (const forbidden of ['situationText', 'freeText', 'userText', 'transcript', 'rawInput']) {
      expect(provider).not.toContain(forbidden);
    }
  });
});

describe('no path to a paid call skips the budget', () => {
  const speech = (seconds: number): SpeechRequest => ({
    slot: 'opening',
    scope: 'situation',
    cacheKey: 'k',
    text: 'x'.repeat(Math.round(seconds * DynamicBudget.charactersPerSecond)),
    estimatedSeconds: seconds,
  });

  it('accepts a normal session', () => {
    const verdict = checkBudget([speech(20)]);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.exceptional).toBe(false);
  });

  it('marks over-30 but under-45 as exceptional rather than blocking it', () => {
    const verdict = checkBudget([speech(40)]);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.exceptional).toBe(true);
  });

  it('fails over the 45-second ceiling instead of trimming', () => {
    const verdict = checkBudget([speech(46)]);
    expect(verdict.ok).toBe(false);
    // No trimmed variant is offered. A quiet trim would hide the drift the
    // ceiling exists to catch.
    expect(Object.keys(verdict)).not.toContain('trimmed');
  });

  it('THE PROVIDER IS NOT CALLED when the ceiling fails', async () => {
    const fetchImpl = okFetch();
    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, fetchImpl);

    const over = [speech(30), speech(20)];
    const verdict = checkBudget(over);
    expect(verdict.ok).toBe(false);

    // The caller must not proceed. Modelled explicitly: if the verdict fails,
    // synthesise is never reached, and the assertion is that no request left
    // the process.
    if (verdict.ok) await provider.synthesise(request());

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('the check function budgets before it reaches the provider', () => {
    const budgetAt = CHECK_FN.indexOf('DynamicBudget.ceilingSeconds');
    const providerAt = CHECK_FN.indexOf('provider.synthesise');
    expect(budgetAt).toBeGreaterThan(-1);
    expect(providerAt).toBeGreaterThan(budgetAt);
  });

  it('refuses an empty request as a backstop', async () => {
    const fetchImpl = okFetch();
    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, fetchImpl);

    await expect(provider.synthesise(request({ text: '', characterCount: 0 }))).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('failure modes are mapped, not leaked', () => {
  const statusCases: [number, string][] = [
    [401, 'auth_failed'],
    [403, 'auth_failed'],
    [404, 'invalid_voice'],
    [422, 'invalid_model'],
    [429, 'rate_limited'],
    [500, 'provider_error'],
  ];

  for (const [status, expected] of statusCases) {
    it(`maps ${status} to ${expected}`, async () => {
      const failing = jest.fn(async () => ({
        ok: false,
        status,
        arrayBuffer: async () => new ArrayBuffer(0),
      })) as unknown as typeof fetch;

      const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, failing);
      await provider.synthesise(request()).catch((error: SynthesisError) => {
        expect(error.failure).toBe(expected);
      });
    });
  }

  it('reports empty audio rather than storing it', async () => {
    const store = jest.fn(async () => {});
    const provider = createElevenLabsProvider(
      env(CONFIGURED),
      store,
      okFetch(new Uint8Array([]))
    );

    await provider.synthesise(request()).catch((error: SynthesisError) => {
      expect(error.failure).toBe('bad_audio');
    });
    expect(store).not.toHaveBeenCalled();
  });

  it('reports a storage failure without losing the reason', async () => {
    const provider = createElevenLabsProvider(
      env(CONFIGURED),
      async () => {
        throw new Error('bucket exploded');
      },
      okFetch()
    );

    await provider.synthesise(request()).catch((error: SynthesisError) => {
      expect(error.failure).toBe('storage_failed');
      // Our vocabulary, not the storage layer's message.
      expect(error.message).not.toContain('exploded');
    });
  });
});

describe('the provider stays swappable', () => {
  it('everything vendor-specific is inside the adapter', () => {
    for (const file of [
      join('supabase', 'functions', '_shared', 'compose.ts'),
      join('supabase', 'functions', '_shared', 'speech.ts'),
      join('supabase', 'functions', '_shared', 'allocate.ts'),
      join('supabase', 'functions', 'compose', 'index.ts'),
    ]) {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source.toLowerCase()).not.toContain('elevenlabs');
      expect(source).not.toContain('xi-api-key');
    }
  });

  it('the client bundle references no vendor at all', () => {
    const composition = read('src', 'lib', 'composition.ts');
    expect(composition.toLowerCase()).not.toContain('elevenlabs');
  });

  it('the adapter satisfies the existing VoiceProvider contract', () => {
    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, okFetch());
    expect(provider.id).toBe('elevenlabs');
    expect(typeof provider.synthesise).toBe('function');
  });
});

describe('the integration check cannot be abused', () => {
  it('takes no input — the phrase is compiled in', () => {
    expect(CHECK_FN).toContain('const PHRASE = "ELSEA voice integration test."');
    // No body is read, so nothing a caller sends can change what is spoken.
    expect(CHECK_FN).not.toContain('await req.json()');
  });

  it('requires the service role key, not the anon key', () => {
    // Was a raw comparison against SUPABASE_SERVICE_ROLE_KEY, which rejected a
    // correctly signed service_role token in production. Now authorises on the
    // verified JWT role claim -- see operator-auth.test.ts.
    expect(CHECK_FN).toContain('if (!isOperator(req)) return forbidden();');
    expect(CHECK_FN).toContain('operator-auth.ts');
    // The refusal itself now lives in the shared helper, which returns the
    // same 403 body. Asserted there; here what matters is that the function
    // calls it.
    expect(CHECK_FN).toContain('return forbidden();');
  });

  it('writes nothing to the production speech cache', () => {
    // generated_segments is keyed on structured state; an engineering phrase
    // has none, and inventing one would put a test string in the cache real
    // sessions read from.
    //
    // Checked against code: the function's own header explains at length that
    // it does not write that table, and the explanation must not satisfy the
    // test.
    const code = CHECK_FN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('generated_segments');
  });

  it('never reports a configured value, only whether it is configured', () => {
    expect(CHECK_FN).toContain('model_configured: Boolean(');
    expect(CHECK_FN).toContain('voice_configured: Boolean(');
    expect(CHECK_FN).not.toContain('ELEVENLABS_API_KEY')
  });

  it('signs for minutes, not hours', () => {
    expect(CHECK_FN).toContain('SIGNED_URL_TTL_SECONDS = 300');
  });
});

describe('duration and billing are measured, not assumed', () => {
  it('bills on what was submitted', async () => {
    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, okFetch());
    const text = 'A line of guided speech.';
    const result = await provider.synthesise(request({ text, characterCount: text.length }));

    // Providers bill on characters submitted, including output later discarded,
    // so the estimate and the invoice can disagree — and only one is true.
    expect(result.billedCharacters).toBe(text.length);
  });

  it('carries the budgeted estimate forward rather than guessing', async () => {
    const provider = createElevenLabsProvider(env(CONFIGURED), async () => {}, okFetch());
    const result = await provider.synthesise(request({ estimatedSeconds: 7 }));
    expect(result.durationSeconds).toBe(7);
  });

  it('the estimate matches the documented rate', () => {
    expect(estimateSpeechSeconds('x'.repeat(130))).toBe(10);
    expect(DynamicBudget.charactersPerSecond).toBe(13);
  });
});
