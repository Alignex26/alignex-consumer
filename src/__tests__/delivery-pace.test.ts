/// <reference types="node" />

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  SPEED_NORMAL,
  SynthesisError,
  createElevenLabsProvider,
  resolveSpeed,
} from '../../supabase/functions/_shared/elevenlabs';

/**
 * DELIVERY PACE.
 *
 * All three cast voices were judged slightly too quick, so pace became something
 * the pipeline has to be able to ask for. Three properties matter, and none of
 * them is "the number arrives":
 *
 *   1. ASKING FOR NOTHING CHANGES NOTHING. With no pace configured and none
 *      requested, the request body is byte-identical to what it was before pace
 *      existed. An approved voice must not drift because a feature was added.
 *
 *   2. AN UNSUPPORTED PACE FAILS, LOUDLY AND BEFORE THE CALL. ElevenLabs carries
 *      speed as `voice_settings.speed`, and their v3 line ignores it in favour of
 *      inline audio tags. A model that ignores the field returns 200 and audio at
 *      the original pace — a silent wrong answer that costs a production take to
 *      notice. So the adapter refuses instead of sending it.
 *
 *   3. A PACING TEST CANNOT DESTROY AN APPROVED MASTER. The staging path, the
 *      master path and the decision to write no rendition row all follow from the
 *      same request, so there is no combination of flags that lands a test on a
 *      production path.
 *
 * NO PROVIDER IS CALLED ANYWHERE IN THIS FILE. `fetch` is injected.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const GENERATE = read('supabase', 'functions', 'generate-master', 'index.ts');
const FINALISE = read('scripts', 'finalise-master.mjs');
const ADAPTER = read('supabase', 'functions', '_shared', 'elevenlabs.ts');

/** A model documented to accept voice_settings.speed. */
const SPEED_MODEL = 'eleven_multilingual_v2';

const envWith = (over: Record<string, string | undefined> = {}) => {
  const base: Record<string, string | undefined> = {
    ELEVENLABS_API_KEY: 'k',
    ELEVENLABS_VOICE_ID: 'v',
    ELEVENLABS_MODEL_ID: SPEED_MODEL,
    ...over,
  };
  return (key: string) => base[key];
};

/** Captures the request body without any network involvement. */
function capturing() {
  const sent: { body: Record<string, unknown>; url: string }[] = [];
  const fetchImpl = (async (url: string, init: { body: string }) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

const request = (over: Record<string, unknown> = {}) => ({
  text: 'Settle here for a moment.',
  voice: 'warm',
  characterCount: 25,
  cacheKey: 'en:warm:nr_arrive_short:v1',
  estimatedSeconds: 0,
  ...over,
});

describe('asking for nothing changes nothing', () => {
  it('sends no voice_settings when no pace is configured or requested', async () => {
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(envWith(), async () => {}, fetchImpl);
    await provider.synthesise(request());

    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ text: 'Settle here for a moment.', model_id: SPEED_MODEL });
    expect(sent[0].body).not.toHaveProperty('voice_settings');
  });

  it('treats an explicit 1.0 as no change at all', async () => {
    // Normal speed is the absence of an instruction, not an instruction to be
    // normal. Sending voice_settings here would alter an approved voice.
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(envWith(), async () => {}, fetchImpl);
    await provider.synthesise(request({ speed: SPEED_NORMAL }));
    expect(sent[0].body).not.toHaveProperty('voice_settings');
  });

  it('the configured default is absent until somebody sets it', () => {
    // The three approved voices keep their current delivery until the product
    // owner says otherwise.
    expect(resolveSpeed({ apiKey: 'k', voiceId: 'v', modelId: SPEED_MODEL }, undefined))
      .toBeUndefined();
  });
});

describe('a requested pace is sent, exactly', () => {
  it('carries the value through to voice_settings', async () => {
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(envWith(), async () => {}, fetchImpl);
    await provider.synthesise(request({ speed: 0.88 }));

    expect(sent[0].body).toEqual({
      text: 'Settle here for a moment.',
      model_id: SPEED_MODEL,
      voice_settings: { speed: 0.88 },
    });
  });

  it('is not rounded, clamped or otherwise helpfully adjusted', () => {
    for (const speed of [0.7, 0.75, 0.88, 0.9, 1.15, 1.2]) {
      expect(resolveSpeed({ apiKey: 'k', voiceId: 'v', modelId: SPEED_MODEL }, speed))
        .toBe(speed);
    }
  });

  it('a request overrides the configured default', async () => {
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(
      envWith({ ELEVENLABS_SPEED: '0.95' }), async () => {}, fetchImpl
    );
    await provider.synthesise(request({ speed: 0.88 }));
    expect(sent[0].body.voice_settings).toEqual({ speed: 0.88 });
  });

  it('the configured default applies when nothing is requested', async () => {
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(
      envWith({ ELEVENLABS_SPEED: '0.88' }), async () => {}, fetchImpl
    );
    await provider.synthesise(request());
    expect(sent[0].body.voice_settings).toEqual({ speed: 0.88 });
  });
});

describe('an unsupported pace fails before the call, not after', () => {
  const attempt = (over: Record<string, unknown>, env = envWith()) => {
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(env, async () => {}, fetchImpl);
    return { sent, run: () => provider.synthesise(request(over)) };
  };

  it('refuses a model that does not carry speed', async () => {
    // v3 takes direction through inline audio tags and ignores voice_settings.
    // It would return 200 and audio at the original pace.
    const { sent, run } = attempt({ speed: 0.88 }, envWith({ ELEVENLABS_MODEL_ID: 'eleven_v3' }));
    await expect(run()).rejects.toThrow(SynthesisError);
    expect(sent).toHaveLength(0);
  });

  it('names the model in that failure, because that is the thing to change', () => {
    try {
      resolveSpeed({ apiKey: 'k', voiceId: 'v', modelId: 'eleven_v3' }, 0.88);
      throw new Error('should have refused');
    } catch (error) {
      const e = error as SynthesisError;
      expect(e.failure).toBe('speed_unsupported');
      expect(e.message).toContain('eleven_v3');
    }
  });

  it('refuses a pace outside the provider range, without calling out', async () => {
    for (const speed of [0.5, 0.69, 1.21, 2, 0, -1]) {
      const { sent, run } = attempt({ speed });
      await expect(run()).rejects.toThrow(SynthesisError);
      expect(sent).toHaveLength(0);
    }
  });

  it('refuses a non-numeric configured pace at read time', () => {
    const { fetchImpl } = capturing();
    const provider = createElevenLabsProvider(
      envWith({ ELEVENLABS_SPEED: 'slower' }), async () => {}, fetchImpl
    );
    return expect(provider.synthesise(request())).rejects.toThrow(SynthesisError);
  });

  it('still sends nothing the model was not asked for', () => {
    // The whole body is two keys plus an optional voice_settings. No stray
    // vendor parameters were invented alongside speed.
    const body = ADAPTER.slice(ADAPTER.indexOf('body: JSON.stringify({'));
    expect(body.slice(0, 400)).toContain('text: request.text');
    expect(body.slice(0, 400)).toContain('model_id: config.modelId');
    expect(body.slice(0, 400)).not.toContain('stability');
    expect(body.slice(0, 400)).not.toContain('similarity_boost');
    expect(body.slice(0, 400)).not.toContain('style');
  });
});

describe('nothing about pace touches the script', () => {
  it('the text is passed through untouched', async () => {
    // Pace is a provider setting. Slowing delivery by rewriting punctuation
    // would be changing approved wording, which is not ours to do.
    const { sent, fetchImpl } = capturing();
    const provider = createElevenLabsProvider(envWith(), async () => {}, fetchImpl);
    const text = 'Settle here. Let the next breath be slower than the last.';
    await provider.synthesise(request({ text, speed: 0.88 }));
    expect(sent[0].body.text).toBe(text);
  });

  it('the generator still sends identifiers, and now a number', () => {
    const body = GENERATE.slice(GENERATE.indexOf('let body:'), GENERATE.indexOf('try {'));
    expect(body).toContain('speed?: unknown');
    expect(body).not.toContain('text');
    expect(body).not.toContain('script');
  });

  it('no time-stretching was added anywhere', () => {
    // Explicitly not approved. Pace comes from the provider or not at all.
    const mastering = read('scripts', 'lib', 'mastering.mjs');
    for (const filter of ['atempo', 'rubberband', 'asetrate']) {
      expect(codeOnly(mastering)).not.toContain(filter);
      expect(codeOnly(FINALISE)).not.toContain(filter);
    }
  });
});

describe('a pacing test cannot destroy an approved master', () => {
  it('paced renders stage under their own prefix', () => {
    expect(GENERATE).toContain('`staging/pacing/${locale}/${voiceProfile}/');
  });

  it('the production staging path is used only when no pace was asked for', () => {
    expect(GENERATE).toContain('requestedSpeed === null');
    const block = GENERATE.slice(GENERATE.indexOf('const stagingPath ='));
    expect(block.slice(0, 400)).toContain('requestedSpeed === null');
  });

  it('the speed is part of the staged name, so tests do not overwrite each other', () => {
    expect(GENERATE).toContain('.s${String(requestedSpeed).replace(".", "_")}.mp3');
  });

  it('the cache key separates paced audio from production audio', () => {
    expect(GENERATE).toContain(':s${requestedSpeed}`');
  });

  it('finalise writes a paced master somewhere else entirely', () => {
    expect(FINALISE).toContain('`pacing/${locale}/${voice}/${moduleKey}.s${speedTag}.m4a`');
    expect(FINALISE).toContain('`modules/${locale}/${voice}/${moduleKey}.m4a`');
  });

  it('and writes no rendition row for a pacing test', () => {
    const code = codeOnly(FINALISE);
    expect(code.indexOf('if (pacing) {\n  console.log')).toBeLessThan(code.indexOf('module_renditions'));
    expect(FINALISE).toContain('No rendition row was written and no approved');
  });

  it('the exit happens before the upload as well as before the row', () => {
    const code = codeOnly(FINALISE);
    const guard = code.lastIndexOf('if (pacing)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(code.indexOf('module_renditions'));
  });

  it('source, destination and the skipped row all follow from one flag', () => {
    // There is no separate switch to set wrongly.
    expect(FINALISE).toContain("const speed = pick('--speed')");
    expect(FINALISE).toContain('const pacing = speed !== null');
  });
});

describe('the approved production path is unchanged', () => {
  it('a production render still stages where it always did', () => {
    expect(GENERATE).toContain('`staging/${locale}/${voiceProfile}/${moduleKey}.v${version.version}.mp3`');
  });

  it('generate-master still writes no rendition, paced or not', () => {
    expect(GENERATE).toContain('rendition_written: false');
  });

  it('a production finalise still writes the rendition unapproved', () => {
    expect(FINALISE).toContain('approved: false');
    expect(FINALISE).toContain('approved_at: null');
    expect(codeOnly(FINALISE)).not.toContain('approved: true');
  });

  it('the response says which kind of render it was', () => {
    expect(GENERATE).toContain('pacing_test: requestedSpeed !== null');
  });
});
