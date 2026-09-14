/// <reference types="node" />

import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * MASTERING IS NOT TRANSCODING.
 *
 * The first real Clear master was rejected at -17.0 LUFS and -0.9 dBTP against a
 * -16 LUFS / -1 dBTP specification. Nothing was wrong with the take. The stage
 * whose job is to MOVE audio onto the specification was applying one approximate
 * loudnorm pass aimed exactly at the ceiling, then failing the file for the 0.1 dB
 * miss it had itself introduced. The provider was being asked to hit a mastering
 * target by luck.
 *
 * Two things were wrong, and both sit one level of indirection away from the
 * numbers that were reported:
 *
 *   1. ONE PASS. Single-pass loudnorm estimates as it goes and lands NEAR the
 *      target. Feeding a first pass's measurements back into a second makes the
 *      result deterministic.
 *
 *   2. AIMING AT THE CEILING. loudnorm limits PCM; AAC encoding then reconstructs
 *      a slightly different waveform and can add inter-sample peaks. Aiming at -1
 *      lands just over -1. Mastering now aims at -1.5 so the ENCODED file comes in
 *      under the ceiling.
 *
 * The specification did not move, and a good half of these tests exist to prove
 * exactly that: -16 LUFS +/-1, true peak at or under -1 dBTP, measured after
 * encoding.
 *
 * WHAT IS UNDER TEST IS THE REAL CHAIN. scripts/lib/mastering.mjs is what
 * finalise-master.mjs runs, and it is what these tests run. A test that rebuilt
 * the filter string in its own words would prove only that the filter string can
 * be written twice.
 */

const root = join(__dirname, '..', '..');
const LIB = pathToFileURL(join(root, 'scripts', 'lib', 'mastering.mjs')).href;
const FINALISE = readFileSync(join(root, 'scripts', 'finalise-master.mjs'), 'utf8');
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const TRANSIENT =
  "aevalsrc='0.2533*sin(2*PI*1200*t)*gt(t,3)*lt(t,3.004)':d=11.84:s=44100";

const HF_TRANSIENT =
  "aevalsrc='0.85*sin(2*PI*9000*t)*gt(t,3)*lt(t,3.004)':d=11.84:s=44100";

const has = (bin: string) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
const FFMPEG = has('ffmpeg') && has('ffprobe');
const withFfmpeg = FFMPEG ? describe : describe.skip;

/**
 * Run a snippet against the real library and return the JSON it emits.
 *
 * ffmpeg writes plenty of its own output, so the payload is tagged and the tag is
 * what gets parsed. A run that emits no tagged line throws rather than returning
 * something empty that assertions would quietly accept.
 */
const TAG = '__ELSEA_JSON__';

function run1<T>(body: string): T {
  const source = `import * as M from ${JSON.stringify(LIB)};\n${body}`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const line = out.split('\n').find((l) => l.startsWith(TAG));
  if (line === undefined) throw new Error(`no ${TAG} line in output:\n${out}`);
  return JSON.parse(line.slice(TAG.length)) as T;
}

const emit = (expression: string) => `console.log(${JSON.stringify(TAG)} + JSON.stringify(${expression}));`;

type Measured = {
  duration: number; codec?: string; sampleRate: number; channels: number;
  bitrate: number; lufs: number; peak: number;
};

/**
 * A source with the shape that caused the failure: correct in every respect
 * except that it sits above the true-peak ceiling and off the loudness target.
 *
 * Built rather than committed, because a binary fixture is something nobody can
 * read in a diff. A steady bed carries the loudness and one short transient sets
 * the peak, which is how speech reaches a high crest factor — a 3 ms burst barely
 * moves a 400 ms loudness window but it decides the peak. The transient sits
 * mid-take deliberately: at t=0 the chain's own silence trim clips it, which
 * lowers the very peak this fixture exists to provide.
 *
 * SEEDED, because an unseeded anoisesrc gives different noise every run and the
 * peak moves with it. Unseeded, this fixture measured -0.2 dBTP on one run and
 * -1.7 on the next: the guard below would have passed locally and failed at
 * random later, which is worse than having no guard.
 *
 * NO PROVIDER IS CALLED. This is ffmpeg generating noise and a tone.
 */
function hardSource(dir: string): string {
  const bed = join(dir, 'bed.wav');
  const src = join(dir, 'source.mp3');

  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=d=11.7:c=pink:r=44100:a=0.5:seed=1729',
    '-af', 'highpass=f=90,lowpass=f=6000,tremolo=f=3:d=0.6,loudnorm=I=-17:TP=-6:LRA=7',
    '-ar', '44100', '-ac', '1', bed]);

  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', bed,
    '-f', 'lavfi', '-i', "aevalsrc='0.8500*sin(2*PI*1200*t)*gt(t,3)*lt(t,3.003)':d=11.7:s=44100",
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest:normalize=0',
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', src]);

  return src;
}

/**
 * THE SECOND FAILURE SHAPE: quiet, STEREO, and needing a lot of gain.
 *
 * This is what the first real Clear staged render actually was, and it defeated
 * the first version of the fix completely. The chain handed `-ac 1` to the
 * ENCODER, so the channel downmix happened after loudnorm's limiter:
 *
 *     as delivered (stereo)     -28.67 LUFS   -11.23 dBTP
 *     downmixed to mono first   -28.67 LUFS    -8.22 dBTP
 *                                             +3.01 dB
 *
 * The limiter hit -1.5 dBTP on the stereo signal and the encoder then summed the
 * channels back up to +1.5. The observed master was +1.4 dBTP — a ceiling miss of
 * almost exactly the downmix gain, which is how it was identified.
 *
 * Shaped at a workable level and then attenuated, because attenuation preserves
 * crest factor; that reaches a genuinely quiet source with speech-like dynamics
 * rather than a loud one turned down at the end.
 */
function quietStereoSource(dir: string): string {
  const bed = join(dir, 'sbed.wav');
  const src = join(dir, 'quiet-stereo.mp3');

  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=d=11.7:c=pink:r=44100:a=0.5:seed=4242',
    '-af', 'highpass=f=90,lowpass=f=6000,tremolo=f=3:d=0.6,loudnorm=I=-19.5:TP=-9:LRA=7',
    '-ar', '44100', '-ac', '1', bed]);

  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', bed,
    '-f', 'lavfi', '-i', "aevalsrc='0.70*sin(2*PI*1200*t)*gt(t,3)*lt(t,3.003)':d=11.7:s=44100",
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest:normalize=0,volume=-8dB',
    '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', src]);

  return src;
}

/**
 * THE VERIFIED REAL SOURCE SHAPE.
 *
 * Built from measurements read off the actual first Clear staged render:
 *
 *     mono, 44.1 kHz, 11.84s, -27.52 LUFS, -8.91 dBTP, LRA 2.80
 *
 * Quiet and high-crest: reaching -16 LUFS needs about +11.5 dB, which would put
 * the peak near +2.6 dBTP. No uniform gain satisfies both targets, so this shape
 * REQUIRES peak-constrained processing. That is the whole point of the fixture.
 *
 * LRA is the part the earlier synthetic sources could not produce, and it is why
 * thirty of them passed while the real file failed: tremolo-modulated noise has
 * an LRA near 0.2, and speech has phrases at different levels. The bed here is
 * built from stepped segments, which is what produces a realistic LRA.
 */
function realShapeSource(dir: string): string {
  const steps = [0, -5, -2, -8, -3, -6];
  const parts = steps.map((gain, k) => {
    const f = join(dir, `seg${k}.wav`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `anoisesrc=d=1.9733:c=pink:r=44100:a=0.5:seed=${100 + k}`,
      '-af', `highpass=f=90,lowpass=f=6000,tremolo=f=4:d=0.5,volume=${gain}dB`,
      '-ar', '44100', '-ac', '1', f]);
    return f;
  });

  const list = join(dir, 'segments.txt');
  writeFileSync(list, parts.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

  const bed = join(dir, 'realbed.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', bed]);

  const src = join(dir, 'real-shape.mp3');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', bed,
    '-f', 'lavfi', '-i', TRANSIENT,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest:normalize=0,volume=1.69dB',
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', src]);

  return src;
}

/**
 * A SOURCE THE ENCODER SPOILS.
 *
 * Two conditions have to hold at once, and this is why it took so long to find:
 *
 *   HIGH CREST, so the peak constraint actually binds and loudnorm delivers
 *   exactly the aim rather than landing well under it; and
 *
 *   FULL-BAND content, which a 96 kbps AAC encoder handles badly and then
 *   overshoots.
 *
 * Either alone is harmless. Together, loudnorm reports a clean -1.50 dBTP and the
 * encoded file measures -0.65 — over the ceiling, with nothing wrong anywhere in
 * the chain. That is the shape of the real failure.
 */
function encoderSpoilsSource(dir: string): string {
  const bed = join(dir, 'wide.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=d=11.84:c=white:r=44100:a=0.5:seed=77',
    '-af', 'loudnorm=I=-19:TP=-9:LRA=7', '-ar', '44100', '-ac', '1', bed]);

  const src = join(dir, 'encoder-spoils.mp3');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', bed,
    '-f', 'lavfi', '-i', HF_TRANSIENT,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest:normalize=0,volume=-10dB',
    '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', src]);

  return src;
}

type Outcome = { source: { i: number; tp: number }; result: Measured; problems: string[] };

const masterIt = (src: string, dir: string): Outcome => run1<Outcome>(`
  const m = M.measureForMastering(${JSON.stringify(src)});
  if (m === null) throw new Error('source was unmeasurable');
  const out = ${JSON.stringify(join(dir, 'master.m4a'))};
  const enc = M.encode(${JSON.stringify(src)}, out, M.masteringFilter(m));
  if (enc.status !== 0) throw new Error('encode failed: ' + enc.stderr);
  const result = M.measureFinished(out);
  ${emit(`{
    source: { i: Number(m.input_i), tp: Number(m.input_tp) },
    result,
    problems: M.problemsWith(result, 21),
  }`)}
`);

withFfmpeg('a take above the ceiling is mastered onto the specification', () => {
  let outcome: Outcome;

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-master-'));
    outcome = masterIt(hardSource(dir), dir);
  }, 300_000);

  it('starts from a source that genuinely breaks the specification', () => {
    // Guards the test itself. If the source were already compliant, everything
    // below would pass while proving nothing — which is the exact failure mode
    // this project keeps running into.
    expect(outcome.source.tp).toBeGreaterThan(-1);
    expect(Math.abs(outcome.source.i + 16)).toBeGreaterThan(1);
  });

  it('brings the true peak under the ceiling — the defect itself', () => {
    expect(outcome.result.peak).toBeLessThanOrEqual(-1);
  });

  it('brings the loudness onto target', () => {
    expect(Math.abs(outcome.result.lufs + 16)).toBeLessThanOrEqual(1);
  });

  it('keeps the delivery format', () => {
    expect(outcome.result.codec).toBe('aac');
    expect(outcome.result.sampleRate).toBe(44100);
    expect(outcome.result.channels).toBe(1);
  });

  it('does not shorten the take', () => {
    // Edge silence is trimmed; content is not. Nothing here fades or truncates.
    expect(outcome.result.duration).toBeGreaterThan(11);
    expect(outcome.result.duration).toBeLessThan(12);
  });

  it('passes every gate, so this file would publish', () => {
    expect(outcome.problems).toEqual([]);
  });

  it('decides on the encoded master, not on the source', () => {
    // Different files, different numbers, and it is the master's numbers the
    // gates were given.
    expect(outcome.result.peak).not.toBeCloseTo(outcome.source.tp, 1);
    expect(outcome.result.codec).toBe('aac');
  });
});

withFfmpeg('a quiet STEREO take is mastered onto the specification', () => {
  let outcome: Outcome;

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-stereo-'));
    outcome = masterIt(quietStereoSource(dir), dir);
  }, 300_000);

  it('starts from a source that is quiet enough to need real gain', () => {
    // Guards the fixture: if it did not need substantial gain, the limiter would
    // never engage and the regression would not be reproduced.
    expect(outcome.source.i).toBeLessThan(-24);
    expect(Math.abs(outcome.source.i + 16)).toBeGreaterThan(8);
  });

  it('brings the true peak under the ceiling — the +1.4 dBTP defect', () => {
    expect(outcome.result.peak).toBeLessThanOrEqual(-1);
  });

  it('brings the loudness onto target despite the gain required', () => {
    expect(Math.abs(outcome.result.lufs + 16)).toBeLessThanOrEqual(1);
  });

  it('delivers mono at the specification rate', () => {
    expect(outcome.result.channels).toBe(1);
    expect(outcome.result.sampleRate).toBe(44100);
    expect(outcome.result.codec).toBe('aac');
  });

  it('passes every gate', () => {
    expect(outcome.problems).toEqual([]);
  });
});

describe('nothing may follow the true-peak limiter', () => {
  const filterFor = () =>
    run1<string>(emit(`M.masteringFilter({
      input_i: -28.65, input_tp: -11.23, input_lra: 0.4, input_thresh: -38.65, target_offset: 0.1,
    })`));

  it('the channel layout is settled in the filter graph, not by the encoder', () => {
    expect(run1<string>(emit('M.CONFORM'))).toContain('channel_layouts=mono');
  });

  it('the sample rate is settled there too', () => {
    expect(run1<string>(emit('M.CONFORM'))).toContain('aresample=44100');
  });

  it('conforming happens BEFORE loudnorm', () => {
    const filter = filterFor();
    expect(filter.indexOf('channel_layouts=mono')).toBeLessThan(filter.indexOf('loudnorm'));
    expect(filter.indexOf('aresample=44100')).toBeLessThan(filter.indexOf('loudnorm'));
  });

  it('loudnorm is the LAST filter in the chain', () => {
    // The whole defect in one assertion. A downmix or a resample after the
    // limiter moves peaks the limiter has already signed off on.
    const filter = filterFor();
    expect(filter.slice(filter.indexOf('loudnorm'))).not.toContain(',');
  });

  it('both passes conform identically, so pass one measures what pass two encodes', () => {
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    const passOne = lib.slice(lib.indexOf('export function measureForMastering'));
    expect(passOne.slice(0, 600)).toContain('${CONFORM},${TRIM}');
  });

  it('the encoder still states the format, now as an assertion', () => {
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    const enc = lib.slice(lib.indexOf('export function encode'));
    expect(enc).toContain("'-ar', String(SPEC.sampleRate)");
    expect(enc).toContain("'-ac', String(SPEC.channels)");
  });
});

withFfmpeg('the verified real source shape reaches both targets', () => {
  let outcome: Outcome;

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-real-'));
    outcome = masterIt(realShapeSource(dir), dir);
  }, 300_000);

  it('is the shape that was actually measured off the staged object', () => {
    // Guards the fixture. If it drifts loud, or loses its crest, it stops being
    // the case that failed and everything below proves nothing.
    expect(outcome.source.i).toBeLessThan(-26);
    expect(outcome.source.i).toBeGreaterThan(-29);
    expect(outcome.source.tp).toBeLessThan(-7.5);
    expect(outcome.source.tp).toBeGreaterThan(-10.5);
  });

  it('needs more gain than its peak headroom allows', () => {
    // The arithmetic that makes peak-constrained processing mandatory rather
    // than a matter of taste.
    const gain = -16 - outcome.source.i;
    expect(gain).toBeGreaterThan(10);
    expect(outcome.source.tp + gain).toBeGreaterThan(-1);
  });

  it('lands inside the loudness window', () => {
    expect(outcome.result.lufs).toBeLessThanOrEqual(-15);
    expect(outcome.result.lufs).toBeGreaterThanOrEqual(-17);
  });

  it('lands at or under the true-peak ceiling', () => {
    expect(outcome.result.peak).toBeLessThanOrEqual(-1);
  });

  it('is measured on the encoded AAC, not on PCM', () => {
    expect(outcome.result.codec).toBe('aac');
    expect(outcome.result.sampleRate).toBe(44100);
    expect(outcome.result.channels).toBe(1);
  });

  it('passes every gate', () => {
    expect(outcome.problems).toEqual([]);
  });
});

withFfmpeg('a loudnorm that fails to limit is caught, not published', () => {
  /**
   * The observed failure, forced.
   *
   * The real +1.44 dBTP master has never been reproduced here: sources matched to
   * within 0.1 dB of the real file, on two different ffmpeg builds, all take the
   * dynamic path and land correctly. So rather than guess at a cause, this
   * reproduces the EFFECT — full gain applied with no limiting — by telling
   * loudnorm the peak is far lower than it is, which keeps it in linear mode.
   *
   * The chain must not hand that to the encoder and call it a master.
   */
  it('such a master really does breach the ceiling', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-bad-'));
    const src = realShapeSource(dir);
    const peak = run1<number>(`
      const m = M.measureForMastering(${JSON.stringify(src)});
      const bad = M.CONFORM + ',' + M.TRIM
        + ',loudnorm=I=-16:TP=-1.5:LRA=7:measured_I=' + m.input_i
        + ':measured_TP=-30:measured_LRA=' + m.input_lra
        + ':measured_thresh=' + m.input_thresh
        + ':offset=' + m.target_offset + ':linear=true';
      const out = ${JSON.stringify(join(dir, "bad.m4a"))};
      M.encode(${JSON.stringify(src)}, out, bad);
      ${emit("M.measureFinished(out).peak")}
    `);
    expect(peak).toBeGreaterThan(-1);
  }, 300_000);

  it('the pre-encode check reports what loudnorm actually did', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-claim-'));
    const src = realShapeSource(dir);
    const claimed = run1<{ normalizationType: string; outputTruePeak: number }>(`
      const m = M.measureForMastering(${JSON.stringify(src)});
      ${emit(`M.verifyMastering(${JSON.stringify(src)}, M.masteringFilter(m))`)}
    `);
    expect(claimed).not.toBeNull();
    expect(claimed.normalizationType).toBe('dynamic');
    expect(claimed.outputTruePeak).toBeLessThanOrEqual(-1.5);
  }, 300_000);

  it('the check runs before the encode, inside the loop', () => {
    // Both moved into the library when mastering became a loop. What matters is
    // unchanged: loudnorm is asked what it did before a byte is encoded.
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    const loop = codeOnly(lib.slice(lib.indexOf('export function masterToSpecification')));
    expect(loop.indexOf('verifyMastering(')).toBeLessThan(loop.indexOf('encode(source'));
  });

  it('finalise publishes nothing while any gate is unmet', () => {
    const code = codeOnly(FINALISE);
    expect(code.indexOf('if (problems.length > 0)')).toBeLessThan(code.indexOf('x-upsert'));
    expect(code.indexOf('if (problems.length > 0)')).toBeLessThan(code.indexOf('module_renditions'));
    const block = FINALISE.slice(FINALISE.indexOf('if (problems.length > 0) {'));
    expect(block.slice(0, 900)).toContain('process.exit(1)');
    expect(block.slice(0, 900)).toContain('Nothing was uploaded and no rendition row was written');
  });

  it('an exhausted ladder is reported as a mastering fault, not a bad take', () => {
    expect(FINALISE).toContain('re-generated, not compressed to fit');
    expect(FINALISE).toContain('Every true-peak aim down to the limit of the ladder was tried');
  });

  it('no second limiter was bolted on', () => {
    // An alimiter backstop was tried and removed: on a source loudnorm had
    // already brought to -1.21 dBTP it pushed the encoded result up to -0.66.
    // It limits sample peaks, so it engages on peaks that were never over.
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    expect(codeOnly(lib)).not.toContain('alimiter');
  });
});

withFfmpeg('the encoder gets the last word, so the encoded file is what is checked', () => {
  type Attempt = {
    aim: number;
    claimed: { normalizationType: string; outputTruePeak: number };
    result: Measured;
    problems: string[];
  };
  type Run = { ok: boolean; aim?: number; result: Measured; problems: string[]; attempts: Attempt[] };

  let run: Run;

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-enc-'));
    const src = encoderSpoilsSource(dir);
    run = run1(`
      ${emit(`M.masterToSpecification(${JSON.stringify(src)}, ${JSON.stringify(join(dir, "m.m4a"))}, 21)`)}
    `);
  }, 300_000);

  it('loudnorm does its job perfectly on the first attempt', () => {
    // This is the part that made the real failure so hard to read: there is
    // nothing wrong with the mastering. It hits the aim exactly.
    const first = run.attempts[0];
    expect(first.claimed.normalizationType).toBe('dynamic');
    expect(first.claimed.outputTruePeak).toBeCloseTo(first.aim, 1);
  });

  it('and the encoded file is over the ceiling anyway', () => {
    const first = run.attempts[0];
    expect(first.result.peak).toBeGreaterThan(-1);
    expect(first.problems.some((p) => p.startsWith('true peak'))).toBe(true);
  });

  it('the overshoot is the encoder, added after mastering finished', () => {
    const first = run.attempts[0];
    expect(first.result.peak - first.claimed.outputTruePeak).toBeGreaterThan(0.5);
  });

  it('so mastering aims lower and encodes again', () => {
    expect(run.attempts.length).toBeGreaterThan(1);
    expect(run.attempts[1].aim).toBeLessThan(run.attempts[0].aim);
  });

  it('and the published file meets the ceiling', () => {
    expect(run.ok).toBe(true);
    expect(run.result.peak).toBeLessThanOrEqual(-1);
    expect(run.problems).toEqual([]);
  });

  it('without costing loudness, which is re-checked every attempt', () => {
    expect(Math.abs(run.result.lufs + 16)).toBeLessThanOrEqual(1);
    for (const attempt of run.attempts) {
      expect(attempt.problems.every((p) => !p.startsWith('loudness'))).toBe(true);
    }
  });

  it('delivers the specified format', () => {
    expect(run.result.codec).toBe('aac');
    expect(run.result.sampleRate).toBe(44100);
    expect(run.result.channels).toBe(1);
  });
});

describe('the ladder tightens the aim and never the specification', () => {
  it('every rung is at or below the opening aim', () => {
    const ladder = run1<number[]>(emit('M.AIM_LADDER'));
    const spec = run1<Record<string, number | string>>(emit('M.SPEC'));
    expect(ladder[0]).toBe(spec.masterTruePeak);
    for (const rung of ladder) expect(rung).toBeLessThanOrEqual(Number(spec.masterTruePeak));
  });

  it('the rungs descend', () => {
    const ladder = run1<number[]>(emit('M.AIM_LADDER'));
    for (let i = 1; i < ladder.length; i += 1) expect(ladder[i]).toBeLessThan(ladder[i - 1]);
  });

  it('steps finely enough not to jump over a working aim', () => {
    // THE COST OF GETTING THIS WRONG, measured on a real take that was refused:
    //
    //     -1.5   +0.68 dBTP   peak fails
    //     -1.6   -1.49 dBTP   PASS   <- never attempted
    //     -1.7   -1.55 dBTP   PASS   <- never attempted
    //     -1.8   -1.72 dBTP   PASS   <- never attempted
    //     -1.9   loudness fails
    //     -2.0   loudness fails, by 0.05 dB
    //
    // The ladder went -1.5 then -2.0 and stopped, with three passing aims
    // between them. 0.1 dB of aim moved the encoded peak by 2.17 dB: the encoder
    // is sharply non-linear near its threshold, so a coarse search over it is
    // not a search. Two takes were regenerated before this was understood, and
    // they were probably fine.
    const ladder = run1<number[]>(emit('M.AIM_LADDER'));
    const live = ladder.filter((a) => a >= -3);
    for (let i = 1; i < live.length; i += 1) {
      expect(Number((live[i - 1] - live[i]).toFixed(4))).toBeLessThanOrEqual(0.1);
    }
  });

  it('covers the region where both constraints are live', () => {
    const ladder = run1<number[]>(emit('M.AIM_LADDER'));
    for (const aim of [-1.6, -1.7, -1.8, -1.9, -2.0]) expect(ladder).toContain(aim);
  });

  it('it stops before loudness would fall out of tolerance', () => {
    // Measured on the real source shape: the aim survives to about -5 and then
    // integrated loudness drops below -17. Past that the two requirements
    // genuinely conflict and refusing is the honest answer.
    const ladder = run1<number[]>(emit('M.AIM_LADDER'));
    expect(Math.min(...ladder)).toBeGreaterThanOrEqual(-5);
  });

  it('the gate is identical at every attempt', () => {
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    const loop = lib.slice(lib.indexOf('export function masterToSpecification'));
    expect(loop).toContain('problemsWith(result, ceiling)');
    expect(loop).not.toContain('truePeak =');
    expect(loop).not.toContain('loudnessTolerance =');
  });

  it('only a true-peak miss earns another attempt', () => {
    // Aiming lower cannot fix a take that runs long or comes out at the wrong
    // rate, and it can only make loudness worse.
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    expect(lib).toContain("problems.every((p) => p.startsWith('true peak'))");
  });
});

describe('the validator did not get more forgiving', () => {
  const gates = (over: Partial<Measured>, ceiling = 21) =>
    run1<string[]>(`
      const m = Object.assign(
        { duration: 11.7, codec: 'aac', sampleRate: 44100, channels: 1, bitrate: 96000, lufs: -16, peak: -1.5 },
        ${JSON.stringify(over)}
      );
      ${emit(`M.problemsWith(m, ${ceiling})`)}
    `);

  it('accepts a compliant file', () => {
    expect(gates({})).toEqual([]);
  });

  it('still rejects a true peak over -1, including barely over', () => {
    // -0.9 dBTP is the exact number the real Clear take produced. It must still
    // fail: the fix was to stop PRODUCING that number, not to start accepting it.
    expect(gates({ peak: -0.9 })).toContain('true peak -0.9 dBTP');
    expect(gates({ peak: -0.99 })).not.toEqual([]);
    expect(gates({ peak: 0 })).not.toEqual([]);
  });

  it('accepts a true peak exactly on the ceiling', () => {
    expect(gates({ peak: -1 })).toEqual([]);
  });

  it('still rejects loudness outside the documented tolerance', () => {
    expect(gates({ lufs: -17.5 })).toContain('loudness -17.5 LUFS');
    expect(gates({ lufs: -14.5 })).not.toEqual([]);
    expect(gates({ lufs: -17 })).toEqual([]);
  });

  it('still rejects the wrong channel count and sample rate', () => {
    expect(gates({ channels: 2 })).toContain('2 channels, expected mono');
    expect(gates({ sampleRate: 48000 })).toContain('sample rate 48000');
  });

  it('still rejects a take over its duration ceiling', () => {
    expect(gates({ duration: 22 })).toContain('over ceiling by 1.00s');
  });

  it('fails an unmeasurable file rather than passing it', () => {
    // The loudness check once never executed at all, and printed PASS while not
    // executing. Absence of a measurement is a failure, not a silence.
    expect(gates({ lufs: NaN })).toContain('loudness could not be measured');
    expect(gates({ peak: NaN })).toContain('true peak could not be measured');
    expect(gates({ duration: NaN })).toContain('duration could not be measured');
  });

  it('holds the documented specification values', () => {
    const spec = run1<Record<string, number | string>>(emit('M.SPEC'));
    expect(spec.loudness).toBe(-16);
    expect(spec.loudnessTolerance).toBe(1);
    expect(spec.truePeak).toBe(-1);
    expect(spec.sampleRate).toBe(44100);
    expect(spec.channels).toBe(1);
    expect(spec.bitrate).toBe('96k');
  });
});

describe('the aim moved below the ceiling, and only the aim moved', () => {
  const filterFor = (over: Record<string, number> = {}) =>
    run1<string>(emit(`M.masteringFilter(Object.assign(
      { input_i: -17, input_tp: -0.9, input_lra: 7, input_thresh: -27, target_offset: 0 },
      ${JSON.stringify(over)}
    ))`));

  it('mastering targets a lower true peak than the gate allows', () => {
    const spec = run1<Record<string, number | string>>(emit('M.SPEC'));
    expect(Number(spec.masterTruePeak)).toBeLessThan(Number(spec.truePeak));
  });

  it('the filter aims at the mastering target, never at the ceiling', () => {
    const filter = filterFor();
    expect(filter).toContain('TP=-1.5');
    expect(filter).not.toContain('TP=-1:');
  });

  it('is a second pass, carrying the first pass measurements', () => {
    const filter = filterFor({ target_offset: 0.5 });
    for (const part of ['measured_I=-17', 'measured_TP=-0.9', 'measured_LRA=7',
                        'measured_thresh=-27', 'offset=0.5']) {
      expect(filter).toContain(part);
    }
  });

  it('asks for dynamic mode explicitly, not for a fallback', () => {
    // `linear=true` relied on loudnorm noticing that one uniform gain cannot meet
    // both targets and switching modes by itself. That is an internal decision
    // with no documented contract, and a real take came back at +1.44 dBTP
    // against a -1.5 request -- the signature of full gain with no limiting.
    expect(filterFor()).toContain('linear=false');
    expect(filterFor()).not.toContain('linear=true');
  });

  it('bakes in no fade, no clipping and no blind gain', () => {
    const filter = filterFor();
    expect(filter).not.toContain('afade');
    expect(filter).not.toContain('acrusher');
    expect(filter).not.toContain('volume=');
  });

  it('keeps the delivery sample rate in the chain', () => {
    expect(filterFor()).toContain('aresample=44100');
  });
});

describe('nothing is published on a failure', () => {
  it('the gates run before either write', () => {
    const code = codeOnly(FINALISE);
    // The gates themselves moved into the loop; finalise reads its verdict.
    const gate = code.indexOf('run.problems');
    expect(gate).toBeGreaterThan(-1);
    // Anchored on the upload's own header: `storage/v1/object` alone also
    // matches the DOWNLOAD of the staged render, which is correctly earlier.
    expect(gate).toBeLessThan(code.indexOf('x-upsert'));
    expect(gate).toBeLessThan(code.indexOf('module_renditions'));
  });

  it('a failure exits before the upload and before the rendition row', () => {
    expect(FINALISE).toContain('if (problems.length > 0) {');
    const block = FINALISE.slice(FINALISE.indexOf('if (problems.length > 0) {'), FINALISE.indexOf('PASS —'));
    expect(block).toContain('process.exit(1)');
    expect(block).toContain('Nothing was uploaded and no rendition row was written');
  });

  it('an unmeasurable source stops before anything is encoded', () => {
    expect(FINALISE).toContain('Could not measure the staged render. Nothing was written.');
  });

  it('still writes the rendition unapproved when it does pass', () => {
    expect(FINALISE).toContain('approved: false');
    expect(FINALISE).toContain('approved_at: null');
    expect(codeOnly(FINALISE)).not.toContain('approved: true');
  });
});

describe('re-mastering costs no provider call', () => {
  it('the library talks to ffmpeg and to nothing else', () => {
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    expect(lib).not.toContain('fetch(');
    expect(lib.toLowerCase()).not.toContain('elevenlabs');
    expect(lib).not.toContain('API_KEY');
  });

  it('finalise re-reads the staged render rather than regenerating it', () => {
    // The staged MP3 is the provider's output and it is kept. A mastering defect
    // is fixed by mastering again, not by paying for the take a second time.
    expect(FINALISE).toContain('`staging/${locale}/${voice}/${moduleKey}.v${version.version}.mp3`');
    expect(codeOnly(FINALISE)).not.toContain('ELEVENLABS_API_KEY');
  });

  it('the script runs the library these tests just exercised', () => {
    expect(FINALISE).toContain("from './lib/mastering.mjs'");
    // One entry point now: the whole master-encode-measure-retry cycle is the
    // library's, so the script cannot assemble a different one by accident.
    expect(FINALISE).toContain('masterToSpecification(rawFile, masterFile, ceiling)');
    expect(codeOnly(FINALISE)).not.toContain('masteringFilter(');
    expect(codeOnly(FINALISE)).not.toContain('encode(rawFile');
  });
});

describe('the duration ceiling scales past the first five modules', () => {
  it('no longer refuses a module it has never heard of', () => {
    // The ceilings were a hardcoded map of exactly the five original module
    // keys. The SIXTH module in a 47-module catalogue hit it immediately:
    // authored, approved and imported correctly, then rejected with
    // `Unknown module`. A list of five keys cannot carry the library.
    expect(FINALISE).not.toContain('Unknown module "${moduleKey}"');
    expect(FINALISE).toContain('async function ceilingFor(');
  });

  it('keeps the five agreed ceilings exactly as agreed', () => {
    // These are product decisions and do NOT match any formula: `reframe` is 40
    // where the tightest accepting phase allows 30, and `orient` is 21 where the
    // tightest allows 20. Deriving them would silently retighten `reframe` by
    // ten seconds on content already approved at 40.
    const block = FINALISE.slice(FINALISE.indexOf('const CEILINGS = {'));
    for (const [key, seconds] of [
      ['nr_arrive_short', 21], ['nr_regulate_short', 45], ['nr_reframe_short', 40],
      ['nr_prepare_short', 45], ['nr_close_short', 11],
    ] as const) {
      expect(block).toContain(`${key}: ${seconds}`);
    }
  });

  it('an explicit entry always wins over the derived value', () => {
    const fn = FINALISE.slice(FINALISE.indexOf('async function ceilingFor('));
    expect(fn.slice(0, 200)).toContain('if (key in CEILINGS) return CEILINGS[key]');
  });

  it('derives from the tightest slot the family has to serve', () => {
    // A phase is only guaranteed its minimum allocation, so a module at or under
    // the smallest `min_seconds` of any accepting phase fits every slot it could
    // be selected for. A looser ceiling would admit a module that then cannot be
    // placed in the tightest recipe — a failure only discovered when a session
    // refuses to compose.
    const fn = FINALISE.slice(FINALISE.indexOf('async function ceilingFor('));
    expect(fn).toContain('recipe_phase_families?family=eq.');
    expect(fn).toContain('min_seconds');
    expect(fn).toContain('Math.min(...mins)');
  });

  it('refuses rather than guesses when no phase accepts the family', () => {
    const fn = FINALISE.slice(FINALISE.indexOf('async function ceilingFor('));
    expect(fn).toContain('No recipe phase accepts the');
    expect(fn).toContain('process.exit(2)');
  });

  it('the ceiling is still enforced, not merely computed', () => {
    const lib = readFileSync(join(root, 'scripts', 'lib', 'mastering.mjs'), 'utf8');
    expect(lib).toContain('over ceiling by');
    expect(FINALISE).toContain('await ceilingFor(moduleKey, moduleFamily)');
  });
});

describe('one module, one locale, one voice — Warm is not touched', () => {
  it('operates on exactly the voice named on the command line', () => {
    expect(FINALISE).toContain("pick('--voice')");
    expect(codeOnly(FINALISE)).not.toMatch(/for\s*\(\s*const\s+\w+\s+of\s+(MODULES|VOICES|LOCALES)/);
  });

  it('every path it writes is scoped to that one voice', () => {
    // Two destinations now — a production master and an isolated pacing test —
    // and both carry the single requested voice.
    expect(FINALISE).toContain('`modules/${locale}/${voice}/${moduleKey}.m4a`');
    expect(FINALISE).toContain('`pacing/${locale}/${voice}/${moduleKey}.s${speedTag}.m4a`');
    expect(FINALISE).toContain('voice_profile: voice');
  });

  it('a pacing test cannot write to the production master path', () => {
    // The destination follows from the same flag as the source and the skipped
    // rendition row, so there is no way to set one without the others.
    expect(FINALISE).toContain('const pacing = speed !== null');
    const block = FINALISE.slice(FINALISE.indexOf('const masterPath'));
    expect(block.slice(0, 300)).toContain('pacing');
  });

  it('the rendition upsert is keyed so it cannot overwrite another voice', () => {
    expect(FINALISE).toContain('on_conflict=module_id,locale,version,voice_profile');
  });
});
