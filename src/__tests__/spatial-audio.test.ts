/// <reference types="node" />

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { buildTimeline } from '../audio/timeline';
import {
  EMPTY_SOUND_LAYER,
  MAX_SWEEPS,
  sweepPointsFor,
  SWEEP_GAIN,
  RESOLVE_GAIN,
} from '../audio/sound-layer';
import type { SessionManifest } from '../../supabase/functions/_shared/types';

import { composeFor } from './composition-proof.test';

/**
 * THE SOUND LAYER — ambient bed and spatial movement.
 *
 * The layer is stereo audio generated offline by
 * `scripts/generate-sound-assets.mjs` and played as an OVERLAY. There is no
 * runtime panning anywhere in this project, which is what keeps the device side
 * to "start a file, stop a file".
 *
 * The property this suite exists to protect: **the sound layer cannot change
 * what a session is.** Not its duration, not its cues, not its completion. It
 * is decoration over a timeline that remains authoritative, and if every asset
 * is missing the session is exactly the voice-only session it was before.
 */

const root = join(__dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

/**
 * Source with comments removed.
 *
 * The distinction matters more here than usual. This file's assertions are
 * mostly of the form "the sound layer never touches X" — and the sound layer's
 * own documentation says, at length, that it never touches X. Asserting against
 * raw text cannot tell those apart, and fails on the disclaimer.
 */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const PLAYER = read('src', 'audio', 'use-manifest-player.ts');
const TIMELINE = read('src', 'audio', 'timeline.ts');
const SOUND_LAYER_SRC = read('src', 'audio', 'sound-layer.ts');
const GENERATOR = read('scripts', 'generate-sound-assets.mjs');

const manifestFor = (recipe: string, seconds: number): SessionManifest => {
  const result = composeFor(recipe, seconds);
  if (!result.ok) throw new Error(`fixture failed to compose: ${recipe} ${seconds}`);
  return result.manifest;
};

describe('the spatial layer cannot change session duration', () => {
  /**
   * The structural guarantee, not a behavioural hope. `buildTimeline` takes a
   * manifest and nothing else — the sound layer is not one of its inputs and
   * cannot be. A sweep is fire-and-forget on its own player.
   */
  it('the timeline module knows nothing about the sound layer', () => {
    expect(TIMELINE).not.toContain('sound-layer');
    expect(TIMELINE).not.toContain('sweep');
    expect(TIMELINE).not.toContain('SoundLayer');
  });

  it('every composed duration is exactly the requested one, layer or no layer', () => {
    for (const recipe of ['nervous_ready', 'wound_up_home', 'wired_sleep']) {
      for (const seconds of [300, 600, 900, 1200]) {
        const built = buildTimeline(manifestFor(recipe, seconds));
        expect(built.ok).toBe(true);
        if (!built.ok) continue;
        expect(built.timeline.totalSeconds).toBe(seconds);
      }
    }
  });

  it('sweep points are cue indices inside the session, never extra cues', () => {
    const built = buildTimeline(manifestFor('nervous_ready', 600));
    if (!built.ok) throw new Error('fixture failed');

    const before = built.timeline.cues.length;
    const points = sweepPointsFor(built.timeline);

    // Computing them adds nothing to the timeline.
    expect(built.timeline.cues.length).toBe(before);
    for (const index of points) {
      expect(index).toBeGreaterThan(0);
      expect(index).toBeLessThan(built.timeline.cues.length);
    }
  });

  it('the spatial player is never consulted for timing', () => {
    // Advancing reads the active foreground player's status and the composed
    // cue length. If the spatial player could gate progression, a sweep that
    // failed to load would stall the session.
    const tick = PLAYER.slice(PLAYER.indexOf('The tick:'));
    const tickBody = tick.slice(0, tick.indexOf('// ---- '));
    expect(tickBody).not.toContain('spatialPlayer');
  });
});

describe('sweeps fall on phase boundaries', () => {
  it('only ever lands on a phase boundary', () => {
    for (const seconds of [300, 600, 900, 1200]) {
      const built = buildTimeline(manifestFor('nervous_ready', seconds));
      if (!built.ok) throw new Error('fixture failed');
      const cues = built.timeline.cues;
      for (const index of sweepPointsFor(built.timeline)) {
        expect(cues[index].phase).not.toBeNull();
        expect(cues[index].phase).not.toBe(cues[index - 1].phase);
      }
    }
  });

  it('is used sparingly — at most two in any session', () => {
    // A movement at every boundary stops being a transition and becomes a tic.
    for (const recipe of ['nervous_ready', 'wound_up_home', 'flat_go']) {
      for (const seconds of [300, 600, 900, 1200]) {
        const built = buildTimeline(manifestFor(recipe, seconds));
        if (!built.ok) continue;
        expect(sweepPointsFor(built.timeline).length).toBeLessThanOrEqual(MAX_SWEEPS);
      }
    }
  });

  it('never sweeps into the closing phase', () => {
    // Movement immediately before the centred resolve reads as a mistake.
    for (const seconds of [600, 1200]) {
      const built = buildTimeline(manifestFor('nervous_ready', seconds));
      if (!built.ok) throw new Error('fixture failed');
      const cues = built.timeline.cues;
      const lastPhase = cues[cues.length - 1].phase;
      for (const index of sweepPointsFor(built.timeline)) {
        expect(cues[index].phase).not.toBe(lastPhase);
      }
    }
  });

  it('never marks the opening cue', () => {
    // Nothing is being transitioned from at the start of a session.
    for (const seconds of [300, 600, 900, 1200]) {
      const built = buildTimeline(manifestFor('nervous_ready', seconds));
      if (!built.ok) continue;
      expect(sweepPointsFor(built.timeline)).not.toContain(0);
    }
  });

  it('produces fewer sweeps than cues — it is a transition, not a tic', () => {
    const built = buildTimeline(manifestFor('nervous_ready', 1200));
    if (!built.ok) throw new Error('fixture failed');
    const points = sweepPointsFor(built.timeline);
    expect(points.length).toBeLessThan(built.timeline.cues.length);
  });

  it('handles a timeline with no phases at all', () => {
    const manifest = manifestFor('nervous_ready', 300);
    const stripped: SessionManifest = {
      ...manifest,
      segments: manifest.segments.map((s) =>
        s.kind === 'module' || s.kind === 'silence' ? { ...s, phase: '' } : s
      ),
    };
    const built = buildTimeline(stripped);
    if (!built.ok) throw new Error('fixture failed');
    // Empty phases are equal to each other, so nothing is a boundary.
    expect(sweepPointsFor(built.timeline)).toEqual([]);
  });
});

describe('every layer stops together', () => {
  it('pause stops voice, bed and spatial layer', () => {
    const paused = PLAYER.slice(PLAYER.indexOf('if (!wantsPlay)'));
    const block = paused.slice(0, 600);
    for (const player of ['playerA', 'playerB', 'bedPlayer', 'spatialPlayer']) {
      expect(block).toContain(player);
    }
  });

  it('unmounting — which is how early exit leaves — stops every layer', () => {
    const cleanup = PLAYER.slice(PLAYER.indexOf('Cleanup'));
    const block = cleanup.slice(0, 700);
    for (const player of ['playerA', 'playerB', 'bedPlayer', 'spatialPlayer']) {
      expect(block).toContain(player);
    }
  });

  it('backgrounding pauses rather than abandons', () => {
    expect(PLAYER).toContain("if (next !== 'active') setWantsPlay(false)");
  });
});

describe('the session survives the layer being absent', () => {
  it('an empty layer has every field null', () => {
    expect(EMPTY_SOUND_LAYER.bedUri).toBeNull();
    expect(EMPTY_SOUND_LAYER.sweepUri).toBeNull();
    expect(EMPTY_SOUND_LAYER.resolveUri).toBeNull();
  });

  it('asset resolution never throws, whatever the bundler does', () => {
    // A checkout that has not run the generator, or a test environment with no
    // asset transformer, must degrade to null rather than crash on import.
    expect(SOUND_LAYER_SRC).toContain('try {');
    expect(SOUND_LAYER_SRC).toContain('return null;');
  });

  it('each spatial trigger is guarded on its asset', () => {
    expect(PLAYER).toContain('if (!wantsPlay || !soundLayer.sweepUri) return;');
    expect(PLAYER).toContain('if (!soundLayer.resolveUri) return;');
  });

  it('a manifest bed still wins over the bundled one', () => {
    // Approved content chosen for the recipe outranks generic sound design.
    expect(PLAYER).toContain('setBedUri(bed ?? soundLayer.bedUri)');
  });

  it('voice-only playback remains valid: duration holds with no layer', () => {
    for (const seconds of [300, 1200]) {
      const built = buildTimeline(manifestFor('nervous_ready', seconds));
      if (!built.ok) throw new Error('fixture failed');
      expect(built.timeline.totalSeconds).toBe(seconds);
      // Nothing in the timeline references the layer.
      for (const cue of built.timeline.cues) {
        expect(['module', 'generated', 'silence']).toContain(cue.source.kind);
      }
    }
  });
});

describe('the sound layer is not intervention content', () => {
  it('never enters intervention_modules', () => {
    // Code, not commentary: the module documents at length that it stays out of
    // that table, and the documentation must not satisfy the test.
    expect(codeOnly(SOUND_LAYER_SRC)).not.toContain('intervention_modules');
    expect(codeOnly(GENERATOR)).not.toContain('INSERT');
    expect(codeOnly(GENERATOR)).not.toContain('supabase');
  });

  it('is not written to the private audio bucket', () => {
    // Stronger than code-only here: the existing client-source guard in
    // approval-gate.test.ts forbids this literal anywhere under src/, comments
    // included, so the sound layer must not contain it at all.
    expect(SOUND_LAYER_SRC).not.toContain('intervention-audio');
    expect(codeOnly(GENERATOR)).not.toContain('intervention-audio');
    // It writes to the app bundle instead.
    expect(GENERATOR).toContain("join('assets', 'audio', 'sound-design')");
  });

  it('the importer does not know these assets exist', () => {
    const importer = read('scripts', 'modules-import.mjs');
    for (const key of [
      'nervous_ready_bed_v1',
      'spatial_sweep_soft_v1',
      'centre_resolve_soft_v1',
      'sound-layer',
    ]) {
      expect(importer).not.toContain(key);
    }
  });

  it('the composer does not know these assets exist', () => {
    const composer = read('supabase', 'functions', 'compose', 'index.ts');
    for (const key of ['sound-layer', 'sweep', 'spatial']) {
      expect(composer).not.toContain(key);
    }
  });

  it('carries no technique, approval or clinical field', () => {
    for (const field of ['technique_key', 'approved', 'intensity']) {
      expect(codeOnly(SOUND_LAYER_SRC)).not.toContain(field);
    }
  });
});

describe('no therapeutic or frequency claims', () => {
  /**
   * The tonal content is sound design. A carrier frequency is an engineering
   * parameter and must never be described as doing anything to anybody.
   */
  /**
   * Only tokens that cannot appear innocently.
   *
   * Words like "heals" and "treats" are deliberately absent from this list:
   * both files use them in explicit denials — "nothing here treats, entrains or
   * heals anything" — and a test that forbids the word outright would forbid
   * the disclaimer along with the claim.
   */
  const CLAIMS = [
    '432', '528', 'solfeggio', 'binaural', 'entrainment',
    'brainwave', 'theta wave', 'alpha wave', 'chakra', 'dna',
  ];

  it('the generator makes no claim', () => {
    const lower = GENERATOR.toLowerCase();
    for (const claim of CLAIMS) expect(lower).not.toContain(claim);
  });

  it('the sound layer module makes no claim', () => {
    const lower = SOUND_LAYER_SRC.toLowerCase();
    for (const claim of CLAIMS) expect(lower).not.toContain(claim);
  });

  it('states plainly that frequencies are engineering parameters', () => {
    expect(GENERATOR).toContain('ENGINEERING PARAMETERS');
    expect(SOUND_LAYER_SRC).toContain('engineering parameters');
  });
});

describe('existing constraints are unchanged', () => {
  it('the voice specification is untouched', () => {
    const spec = read('docs', 'audio-production-spec.md');
    expect(spec).toContain('AAC-LC');
    expect(spec).toContain('**Mono**');
    expect(spec).toContain('44 100 Hz');
    expect(spec).toContain('**−16 LUFS**');
    expect(spec).toContain('**−1 dBTP**');
  });

  it('the validator still requires mono for intervention modules', () => {
    const validator = read('scripts', 'modules-validate.mjs');
    expect(validator).toContain('channels: 1');
    expect(validator).toContain('expected mono');
  });

  it('the decision engine still does not ship to the device', () => {
    expect(SOUND_LAYER_SRC).not.toContain('_shared/allocate');
    expect(SOUND_LAYER_SRC).not.toContain('_shared/compose');
  });

  it('headphones are not required for the session to function', () => {
    // Stereo is naturally stronger on headphones; nothing is gated on them.
    expect(PLAYER).not.toContain('requiresHeadphones');
    expect(SOUND_LAYER_SRC).toContain('nothing is gated on headphones');
  });

  it('gains are declared as engineering defaults, not approved values', () => {
    expect(SOUND_LAYER_SRC).toContain('not an approved');
    expect(SWEEP_GAIN).toBeGreaterThan(0);
    expect(SWEEP_GAIN).toBeLessThanOrEqual(1);
    expect(RESOLVE_GAIN).toBeGreaterThan(0);
    expect(RESOLVE_GAIN).toBeLessThanOrEqual(1);
  });
});

describe('the generated assets', () => {
  const dir = join(root, 'assets', 'audio', 'sound-design');
  const names = [
    'nervous_ready_bed_v1.m4a',
    'spatial_sweep_soft_v1.m4a',
    'centre_resolve_soft_v1.m4a',
  ];

  it('are generated by a deterministic script, not hand-made', () => {
    expect(existsSync(join(root, 'scripts', 'generate-sound-assets.mjs'))).toBe(true);
    expect(GENERATOR).toContain('ffmpeg');
  });

  it('are stereo by specification — the layer has no purpose in mono', () => {
    expect(GENERATOR).toContain('channels: 2');
  });

  it('are mastered under the voice reference', () => {
    // The spoken modules are -16 LUFS. This layer is deliberately quieter, so
    // it is present without competing with the words.
    expect(GENERATOR).toContain('loudnessTarget: -26');
  });

  it('exist, or the layer degrades to voice-only', () => {
    // Not a failure if absent: the guards above cover that. Reported so the
    // state is visible in the run.
    const present = names.filter((n) => existsSync(join(dir, n)));
    if (present.length !== names.length) {
      console.log(
        `\n  sound layer: ${present.length}/${names.length} assets present.` +
        `\n  Run: node scripts/generate-sound-assets.mjs\n`
      );
    }
    expect(present.length === 0 || present.length === names.length).toBe(true);
  });
});

describe('the bed loops without touching the timeline', () => {
  it('is set to loop, so one asset covers every duration', () => {
    // 20 s of audio under a 1200 s session. Looping is what makes a single
    // asset serve 300, 600, 900 and 1200 without duration variants.
    expect(PLAYER).toContain('setLooping(bedPlayer, true)');
  });

  it('looping changes nothing about how long a session runs', () => {
    // The bed is not a cue and has no place in the timeline, so its length and
    // the session's length are unrelated by construction.
    for (const seconds of [300, 600, 900, 1200]) {
      const built = buildTimeline(manifestFor('nervous_ready', seconds));
      if (!built.ok) throw new Error('fixture failed');
      expect(built.timeline.totalSeconds).toBe(seconds);
    }
  });

  it('ducks under the foreground rather than stopping', () => {
    expect(PLAYER).toContain('BED_GAIN_DUCKED');
    expect(PLAYER).toContain('BED_GAIN');
  });
});

describe('resume does not restart what is already running', () => {
  it('keeps position rather than seeking on resume', () => {
    // Resuming must not seek: audio holds its own currentTime and a silent cue
    // holds its accumulator. Seeking would jump the session backwards.
    expect(PLAYER).toContain('const resuming = startedCue.current === cueIndex;');
    expect(PLAYER).toContain('if (uri) activePlayer.play();');
  });

  it('the bed is driven by one player for the whole session', () => {
    // A second bed player, or one created per cue, is how two beds end up
    // playing over each other after a resume.
    const beds = PLAYER.match(/const bedPlayer = useAudioPlayer/g) ?? [];
    expect(beds.length).toBe(1);
  });

  it('the spatial layer has exactly one player too', () => {
    const spatial = PLAYER.match(/const spatialPlayer = useAudioPlayer/g) ?? [];
    expect(spatial.length).toBe(1);
  });

  it('a sweep fires on the cue changing, not on every tick', () => {
    // Keyed on cueIndex. Were it inside the 200 ms tick, a sweep would retrigger
    // five times a second for the length of a phase.
    expect(PLAYER).toContain('}, [wantsPlay, cueIndex, sweepPoints,');
  });
});

describe('a sound-design failure never costs the session', () => {
  /**
   * The fallback order that matters:
   *
   *   voice + bed + spatial  ->  voice + bed  ->  voice only
   *
   * and never "back to the silent catalogue". The catalogue fallback is chosen
   * on the COMPOSITION failing, which is a different thing entirely from an
   * ambient asset failing to load.
   */
  it('the catalogue fallback turns on the manifest, not on the sound layer', () => {
    const session = read('src', 'app', 'session.tsx');
    expect(session).toContain('composition.manifest');
    // The session screen has no notion of the sound layer at all, so it cannot
    // fall back because of one.
    expect(session).not.toContain('soundLayer');
    expect(session).not.toContain('sweep');
  });

  it('every spatial call is wrapped so a throw cannot escape', () => {
    const start = PLAYER.indexOf('The spatial layer');
    const end = PLAYER.indexOf('Interruptions');
    const block = PLAYER.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // Both triggers guarded, so a refused or missing asset cannot throw out of
    // the effect and take the session with it.
    expect((block.match(/try/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(block).toContain('still a session');
  });

  it('a missing bed leaves the voice untouched', () => {
    // bedUri null simply means no bed is started; cues are unaffected.
    expect(PLAYER).toContain('if (bedUri) {');
  });
});

describe('no user text reaches the sound layer', () => {
  it('the sound layer takes no text of any kind', () => {
    // It has three URI fields and nothing else. There is no field for what
    // somebody wrote, and no way to add one without changing the type.
    expect(SOUND_LAYER_SRC).toContain('bedUri: string | null');
    expect(SOUND_LAYER_SRC).toContain('sweepUri: string | null');
    expect(SOUND_LAYER_SRC).toContain('resolveUri: string | null');
    for (const forbidden of ['situationText', 'freeText', 'userText', 'transcript']) {
      expect(SOUND_LAYER_SRC).not.toContain(forbidden);
    }
  });

  it('asset filenames are fixed constants, never built from input', () => {
    // A filename assembled from anything the person typed would put their words
    // into a cache key by another route.
    expect(SOUND_LAYER_SRC).toContain('nervous_ready_bed_v1.m4a');
    expect(SOUND_LAYER_SRC).not.toContain('${');
  });

  it('the generator writes fixed filenames only', () => {
    for (const key of [
      'nervous_ready_bed_v1',
      'spatial_sweep_soft_v1',
      'centre_resolve_soft_v1',
    ]) {
      expect(GENERATOR).toContain(key);
    }
  });
});

describe('no recipe or selection logic moved client-side', () => {
  it('the sound layer holds no recipe knowledge', () => {
    for (const forbidden of [
      'recipe_phases', 'recipe_phase_families', 'transitionKey',
      'allocate', 'effectiveness',
    ]) {
      expect(SOUND_LAYER_SRC).not.toContain(forbidden);
    }
  });

  it('sweep placement reads the timeline it was given, and nothing else', () => {
    // It takes a Timeline — already public to the client — and returns indices.
    // It never queries, never selects, and never sees a recipe.
    expect(SOUND_LAYER_SRC).toContain('export function sweepPointsFor(timeline: Timeline)');
    expect(SOUND_LAYER_SRC).not.toContain('supabase');
  });
});
