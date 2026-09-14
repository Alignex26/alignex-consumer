//
// THE MASTERING STAGE, on its own.
//
// Extracted from finalise-master.mjs so that the thing under test is the thing
// that runs. A test that rebuilds the filter chain in its own words proves only
// that the test author can write a filter chain; this project has already been
// bitten several times by checks that confirmed the wrong thing.
//
// No network, no database, no provider. ffmpeg and ffprobe only.

import { spawnSync } from 'node:child_process';

/** From docs/audio-production-spec.md. Not varied, and not widened. */
export const SPEC = {
  sampleRate: 44100,
  channels: 1,
  bitrate: '96k',
  loudness: -16,
  loudnessTolerance: 1,

  /**
   * THE SPECIFICATION CEILING. A published master must measure at or under this.
   * Every gate below still checks against it.
   */
  truePeak: -1,

  /**
   * WHAT MASTERING AIMS FOR, which is lower — and this distinction is the whole
   * fix.
   *
   * loudnorm's true-peak limiting acts on PCM, before AAC encoding. A lossy
   * encoder reconstructs a slightly different waveform and can put inter-sample
   * peaks above what went in, so aiming exactly at the ceiling lands just over
   * it. Measured on a deliberately hard source: aiming at -1 produced -0.04 dBTP
   * after encoding.
   *
   * This is only the FIRST aim. How much an encoder overshoots varies by build,
   * bitrate and signal — 0.22 dB here, 2.94 dB on the machine that produced the
   * first real Clear master — so half a decibel is a reasonable opening bid and
   * nothing more. `masterToSpecification` tightens it against the encoded file
   * when that bid turns out to be wrong.
   *
   * The CHECK is still -1, at every attempt. Only the AIM moves.
   */
  masterTruePeak: -1.5,

  maxEdgeSilence: 0.1,
  silenceThresholdDb: -50,
};

/**
 * CONFORM THE FORMAT FIRST, so nothing between the limiter and the file can move
 * a peak.
 *
 * The chain used to hand the encoder `-ac 1 -ar 44100` and let IT convert, which
 * puts a channel downmix and a resample AFTER loudnorm's true-peak limiter. A
 * downmix can add up to 3 dB and resampling rings; either way the limiter would
 * be protecting a signal that is not the one being encoded.
 *
 * HONESTY ABOUT WHY THIS IS HERE. This was written as the fix for the real Clear
 * master coming back at +1.44 dBTP, on the theory that the staged render was
 * stereo. It was not — the file is mono, 44.1 kHz, and measures identically
 * downmixed, so this change fixed nothing that was actually broken. The tidy
 * arithmetic (a downmix adds +3.01 dB; the master overshot by +2.94) was a
 * coincidence, and a coincidence is not evidence.
 *
 * It is kept because it is correct on its own terms: format conversion after a
 * limiter is a real hazard for any stereo or off-rate render, and one of those
 * will arrive eventually. After this point the signal is already mono 44.1 kHz
 * and the encoder's `-ac`/`-ar` are assertions rather than conversions.
 *
 * The actual cause of +1.44 is in `masterToSpecification`: the encoder itself.
 */
export const CONFORM = [
  `aresample=${SPEC.sampleRate}`,
  'aformat=sample_fmts=fltp:channel_layouts=mono',
].join(',');

/** Trim leading and trailing silence. Applied in both passes, identically. */
export const TRIM = [
  `silenceremove=start_periods=1:start_silence=${SPEC.maxEdgeSilence}:start_threshold=${SPEC.silenceThresholdDb}dB`,
  'areverse',
  `silenceremove=start_periods=1:start_silence=${SPEC.maxEdgeSilence}:start_threshold=${SPEC.silenceThresholdDb}dB`,
  'areverse',
].join(',');

/** Pull the last complete JSON object out of ffmpeg's stderr. */
function lastJson(text) {
  const start = text.lastIndexOf('{');
  const end = text.indexOf('}', start);
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * PASS ONE. Measure the trimmed source.
 *
 * Returns null if the measurement could not be read, which the caller must treat
 * as a refusal — mastering blind is how a file reaches the ceiling by accident.
 */
export function measureForMastering(file) {
  const run = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af',
     `${CONFORM},${TRIM},loudnorm=I=${SPEC.loudness}:TP=${SPEC.masterTruePeak}:LRA=7:print_format=json`,
     '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const parsed = lastJson(`${run.stderr ?? ''}`);
  if (!parsed || !Number.isFinite(Number(parsed.input_i))) return null;
  return parsed;
}

/**
 * PASS TWO. Apply the measurement.
 *
 * Two passes, not one. Single-pass loudnorm estimates as it goes and lands NEAR
 * the target rather than on it — the first Clear master came out at -17.0 LUFS
 * against a -16 target. Feeding pass one's numbers back into pass two makes the
 * result deterministic.
 *
 * WHY `linear=false`, EXPLICITLY.
 *
 * `linear=true` asks loudnorm for one uniform gain, and where that gain cannot
 * satisfy both the loudness and true-peak targets, loudnorm is supposed to notice
 * and fall back to its dynamic mode, which limits transients. We were relying on
 * that fallback. It is an internal decision inside the filter, it is not part of
 * any documented contract, and it has been observed NOT to happen: the first real
 * Clear staged render — mono, 44.1 kHz, -27.52 LUFS, -8.91 dBTP, LRA 2.8 — came
 * out of this chain at +1.44 dBTP against a -1.5 dBTP request.
 *
 * THIS WAS ALSO NOT THE CAUSE. Inspection of the real file showed loudnorm was
 * already in dynamic mode and already delivering exactly -1.50 dBTP; the master
 * still came back at +1.44. So `linear=false` did not fix the reported failure
 * either — see `masterToSpecification` for what did.
 *
 * It is kept because relying on the fallback was never defensible: it is an
 * internal decision with no documented contract, and this source shape always
 * needs peak-constrained processing anyway. Asking for it directly costs nothing
 * when it was going to happen regardless.
 *
 * So the decision is taken away from the filter. This source shape ALWAYS needs
 * peak-constrained processing — the arithmetic below is not close — and asking
 * for it directly costs nothing when it was going to happen anyway.
 *
 *     gain to reach -16 LUFS   = -16 - (-27.52)  = +11.52 dB
 *     resulting unlimited peak = -8.91 + 11.52   = +2.61 dBTP
 *     reduction required                          =  4.11 dB to reach -1.5
 *
 * NO SECOND LIMITER, AND THAT WAS MEASURED, NOT ASSUMED. An `alimiter` stage was
 * added here as a backstop and then removed, because it made correct output
 * worse: on a source loudnorm had already brought to -1.21 dBTP, an alimiter at
 * the -1.5 dB mastering target pushed the encoded result UP to -0.66 dBTP. It
 * limits sample peaks rather than true peaks, so it engages on peaks that were
 * never over, and its attack/release ripple adds inter-sample content the encoder
 * then exaggerates. Oversampling it 4x reduced the damage without removing it
 * (-0.93 dBTP, still over).
 *
 * A stage that corrupts the working path to insure against a path that has never
 * been reproduced is not a safety net. The protection here is a CHECK, not more
 * processing: `verifyMastering` reads what loudnorm says it achieved, before a
 * single byte is encoded, and `problemsWith` measures the finished file. Neither
 * touches the audio.
 */
export function masteringFilter(measured, aim = SPEC.masterTruePeak) {
  return [
    CONFORM,
    TRIM,
    // DYNAMIC, EXPLICITLY. See the note above on why this is not `linear=true`.
    `loudnorm=I=${SPEC.loudness}:TP=${aim}:LRA=7` +
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=false`,
  ].join(',');
}

/**
 * ASK LOUDNORM WHAT IT ACTUALLY DID, before anything is encoded.
 *
 * Pass two run again with `print_format=json`, which makes the filter report its
 * own `normalization_type` and the `output_tp` it believes it achieved. This is
 * the number that was missing when the first real Clear master came back at +1.44
 * dBTP: the chain could see the bad result but had no way to say whether loudnorm
 * had limited and failed, or never limited at all.
 *
 * Costs one extra decode pass and no audio is altered. Returns null if the report
 * could not be read, which the caller must treat as a refusal.
 */
export function verifyMastering(file, filter) {
  const run = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', `${filter}:print_format=json`, '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const parsed = lastJson(`${run.stderr ?? ''}`);
  if (!parsed || !Number.isFinite(Number(parsed.output_tp))) return null;
  return {
    normalizationType: parsed.normalization_type,
    outputLoudness: Number(parsed.output_i),
    outputTruePeak: Number(parsed.output_tp),
  };
}

/** Which ffmpeg is actually running. The same code gave different masters on
 *  different builds, so this belongs in the record next to the numbers. */
export function ffmpegVersion() {
  const run = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return `${run.stdout ?? ''}`.split('\n')[0]?.trim() ?? 'unknown';
}

/** Encode the mastered audio to the delivery format. */
export function encode(source, destination, filter) {
  return spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-af', filter,
     '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', SPEC.bitrate,
     '-ar', String(SPEC.sampleRate), '-ac', String(SPEC.channels), destination],
    { encoding: 'utf8' }
  );
}

/**
 * Measure a finished file.
 *
 * ALWAYS RUN ON THE ENCODED MASTER, never on the source or on intermediate PCM.
 * The encoder is part of what determines the true peak, so a measurement taken
 * before it is a measurement of a different file.
 */
export function measureFinished(file) {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries',
     'stream=codec_name,sample_rate,channels,bit_rate:format=duration',
     '-of', 'json', file],
    { encoding: 'utf8' }
  );

  let stream = {};
  let duration = NaN;
  try {
    const info = JSON.parse(probe.stdout);
    stream = info.streams?.[0] ?? {};
    duration = Number(info.format?.duration);
  } catch { /* reported as unmeasured */ }

  const run = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const parsed = lastJson(`${run.stderr ?? ''}`);

  return {
    duration,
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    bitrate: stream.bit_rate ? Number(stream.bit_rate) : NaN,
    lufs: parsed ? Number(parsed.input_i) : NaN,
    peak: parsed ? Number(parsed.input_tp) : NaN,
  };
}

/**
 * HOW FAR THE AIM MAY BE TIGHTENED, and in what steps.
 *
 * Each rung asks the limiter to hold peaks lower. Loudness is NOT targeted
 * differently: loudnorm is still asked for -16 LUFS at every rung, and the
 * loudness gate is enforced on every attempt. But tightening the peak does cost
 * loudness, so the two constraints close on each other and the usable window can
 * be narrow.
 *
 * THE STEPS USED TO BE 0.5 dB AND THAT WAS TOO COARSE. A real take was refused
 * with both constraints failing on either side of a window it never tried:
 *
 *     aim    encoded LUFS   encoded dBTP
 *    -1.5       -16.82         +0.68     peak fails
 *    -1.6       -16.87         -1.49     PASS        <- never attempted
 *    -1.7       -16.91         -1.55     PASS        <- never attempted
 *    -1.8       -16.96         -1.72     PASS        <- never attempted
 *    -1.9       -17.01         -1.79     loudness fails
 *    -2.0       -17.05         -1.87     loudness fails, by 0.05 dB
 *
 * The old ladder went -1.5, then -2.0, and stopped. Three passing aims sat
 * between them.
 *
 * Note how violently the encoded peak moves: 0.1 dB of aim changed it by 2.17 dB.
 * The encoder is sharply non-linear near its threshold, so a coarse search over
 * it is not a search at all. Hence 0.1 dB resolution where the window lives, and
 * coarser steps below, where the peak is long since safe and only loudness is
 * still in play.
 *
 * It stops at -5: past there loudness leaves tolerance on every take measured,
 * and the honest answer is to refuse rather than publish something quiet.
 */
export const AIM_LADDER = [
  // 0.1 dB resolution through the region where both constraints are live.
  -1.5, -1.6, -1.7, -1.8, -1.9,
  -2.0, -2.1, -2.2, -2.3, -2.4,
  -2.5, -2.6, -2.7, -2.8, -2.9, -3.0,
  // Below here the peak has plenty of room and only loudness decides.
  -3.5, -4.0, -4.5, -5.0,
];

/**
 * MASTER, THEN CHECK THE THING THAT SHIPS — and if the encoder spoiled it, aim
 * lower and do it again.
 *
 * WHY THIS EXISTS. The chain asked loudnorm for -1.5 dBTP, loudnorm delivered
 * exactly -1.5 dBTP and said so, and the encoded AAC came back at +1.44. Verified
 * on the real staged file: mono, 44.1 kHz, correct filter, dynamic mode, every
 * measured value right, three independent measurement routes agreeing. The
 * encoder itself added nearly 3 dB of true peak.
 *
 * An encoder is not obliged to be peak-transparent, and how much it overshoots
 * depends on the build, the bitrate and the signal. On this machine the same
 * source overshoots by 0.22 dB; on the machine that produced that master it
 * overshot by 2.94 dB. Neither number is one we can assume.
 *
 * So the only thing worth trusting is the encoded file, and the only defensible
 * response to an encoder that overshoots is to leave it more room and re-encode.
 * The SPECIFICATION never moves: every attempt is measured against the same
 * -16 LUFS +/-1 and the same -1 dBTP ceiling. What moves is how conservatively
 * the limiter is asked to work, which is a mastering decision, not a tolerance.
 *
 * Returns the first attempt whose ENCODED output satisfies every gate. If the
 * ladder is exhausted, returns the last attempt with its problems intact, so the
 * caller refuses and reports rather than publishing a near-miss.
 */
export function masterToSpecification(source, destination, ceiling) {
  const measured = measureForMastering(source);
  if (measured === null) return { ok: false, failure: 'unmeasurable', attempts: [] };

  const attempts = [];

  for (const aim of AIM_LADDER) {
    const filter = masteringFilter(measured, aim);
    const claimed = verifyMastering(source, filter);
    const encoded = encode(source, destination, filter);

    if (encoded.status !== 0) {
      return { ok: false, failure: 'encode_failed', measured, attempts,
               stderr: `${encoded.stderr ?? ''}`.trim().split('\n').slice(-1)[0] };
    }

    const result = measureFinished(destination);
    const problems = problemsWith(result, ceiling);
    attempts.push({ aim, claimed, result, problems });

    if (problems.length === 0) {
      return { ok: true, measured, aim, claimed, result, problems, attempts };
    }

    // Only a true-peak miss is worth another attempt. A take that runs long, or
    // comes out at the wrong rate, will not be fixed by aiming lower — and
    // neither will loudness, which tightening can only make worse.
    const onlyPeak = problems.every((p) => p.startsWith('true peak'));
    if (!onlyPeak) {
      return { ok: false, measured, aim, claimed, result, problems, attempts };
    }
  }

  const last = attempts[attempts.length - 1];
  return { ok: false, measured, ...last, attempts };
}

/**
 * THE GATES. Unchanged by this fix, and deliberately so.
 *
 * Mastering got better at hitting the specification; the specification did not
 * get easier to hit. An unmeasurable file fails — never passes by default.
 */
export function problemsWith(measured, ceiling) {
  const problems = [];

  if (!Number.isFinite(measured.duration)) problems.push('duration could not be measured');
  else if (measured.duration > ceiling) {
    problems.push(`over ceiling by ${(measured.duration - ceiling).toFixed(2)}s`);
  }

  if (measured.channels !== SPEC.channels) problems.push(`${measured.channels} channels, expected mono`);
  if (measured.sampleRate !== SPEC.sampleRate) problems.push(`sample rate ${measured.sampleRate}`);

  if (!Number.isFinite(measured.lufs)) problems.push('loudness could not be measured');
  else if (Math.abs(measured.lufs - SPEC.loudness) > SPEC.loudnessTolerance) {
    problems.push(`loudness ${measured.lufs.toFixed(1)} LUFS`);
  }

  if (!Number.isFinite(measured.peak)) problems.push('true peak could not be measured');
  else if (measured.peak > SPEC.truePeak) problems.push(`true peak ${measured.peak.toFixed(1)} dBTP`);

  return problems;
}
