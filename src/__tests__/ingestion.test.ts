/// <reference types="node" />

import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { costRowFor, segmentMix, type RateCard } from '../../supabase/functions/_shared/cost';

import { composeFor, DURATIONS, RECIPES } from './composition-proof.test';

/**
 * CONTENT INGESTION, COST TELEMETRY, AND THE SILENCE REPORT.
 *
 * The validator is exercised as a real subprocess rather than by importing its
 * internals, because the thing that must work is the command a person will
 * actually run before an import.
 */

const VALIDATOR = join(__dirname, '..', '..', 'scripts', 'modules-validate.mjs');

/** A structurally valid record. Not content: `technique_key` is a stand-in. */
const valid = (over: Record<string, unknown> = {}) => ({
  module_key: 'probe_module',
  family: 'orient',
  technique_key: 'PENDING_CLINICAL',
  storage_path: 'modules/orient/probe_module.m4a',
  duration_seconds: 20,
  intensity: 5,
  // The approved wording. Required since the master generator was built: it is
  // what a server speaks, and a version with no script cannot be generated
  // from. A stand-in here, like technique_key above.
  script_text: 'A structurally valid stand-in. Not content.',
  // Content approval is a different fact from playability, and both are
  // required explicitly. See approval-separation.test.ts.
  content_approved: false,
  requires_headphones: false,
  is_bed: false,
  approved: false,
  ...over,
});

function validate(records: unknown[]): { code: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'elsea-'));
  const file = join(dir, 'manifest.json');
  writeFileSync(file, JSON.stringify(records));
  try {
    const output = execFileSync(process.execPath, [VALIDATOR, file], { encoding: 'utf8' });
    return { code: 0, output };
  } catch (error) {
    const e = error as { status: number; stdout?: string; stderr?: string };
    return { code: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the module validator', () => {
  it('passes a structurally sound record', () => {
    expect(validate([valid()]).code).toBe(0);
  });

  it('rejects an unknown family', () => {
    const r = validate([valid({ family: 'breathing' })]);
    expect(r.code).toBe(1);
    expect(r.output).toContain('not one of the twelve approved families');
  });

  it('rejects a storage path outside the private bucket layout', () => {
    for (const path of [
      'https://example.com/audio.m4a',
      '/modules/orient/x.m4a',
      'modules/../secrets.m4a',
      'public/orient/x.m4a',
    ]) {
      const r = validate([valid({ storage_path: path })]);
      expect(r.code).toBe(1);
      expect(r.output).toContain('storage_path');
    }
  });

  it('rejects a path filed under the wrong family', () => {
    const r = validate([valid({ family: 'close', storage_path: 'modules/orient/probe_module.m4a' })]);
    expect(r.code).toBe(1);
  });

  it('rejects a duplicate module key', () => {
    const r = validate([valid(), valid()]);
    expect(r.code).toBe(1);
    expect(r.output).toContain('duplicate module_key');
  });

  it('rejects the placeholder technique_key', () => {
    // The marker used throughout the specs for content that does not exist.
    // It must never reach the database looking like an authored technique.
    const r = validate([valid({ technique_key: 'CONTENT_AUTHORING_REQUIRED' })]);
    expect(r.code).toBe(1);
    expect(r.output).toContain('content has not been authored');
  });

  it('rejects a missing or non-boolean approval', () => {
    expect(validate([valid({ approved: undefined })]).code).toBe(1);
    expect(validate([valid({ approved: 'yes' })]).code).toBe(1);
  });

  it('rejects an approved module with no audio when audio is being checked', () => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-'));
    const file = join(dir, 'm.json');
    writeFileSync(file, JSON.stringify([valid({ approved: true })]));
    let code = 0;
    try {
      execFileSync(process.execPath, [VALIDATOR, file, '--audio-dir', dir], { encoding: 'utf8' });
    } catch (error) {
      code = (error as { status: number }).status;
    }
    expect(code).toBe(1);
  });

  it('reports missing media tools as skipped, never as passed', () => {
    // A check that could not run must not read as a check that succeeded.
    const r = validate([valid()]);
    if (r.output.includes('SKIPPED')) {
      expect(r.output).toContain('not passed');
    }
  });
});

describe('the importer refuses to act without being told to', () => {
  const IMPORTER = readFileSync(join(__dirname, '..', '..', 'scripts', 'modules-import.mjs'), 'utf8');

  it('is dry-run unless --commit is given', () => {
    expect(IMPORTER).toContain("const commit = args.includes('--commit');");
    expect(IMPORTER).toContain('Dry run. Nothing written, nothing uploaded.');
  });

  it('validates before it writes anything', () => {
    expect(IMPORTER.indexOf('modules-validate.mjs')).toBeLessThan(IMPORTER.indexOf('--- credentials'));
  });

  it('never infers approval', () => {
    // Approval is the clinical gate. It is copied from the input and never
    // defaulted, upgraded or assumed.
    expect(IMPORTER).toContain('approved: m.approved === true');
    expect(IMPORTER).not.toContain('approved: true,');
  });

  it('uploads to the private bucket only', () => {
    expect(IMPORTER).toContain("const BUCKET = 'intervention-audio';");
    expect(IMPORTER).not.toContain('/public/');
  });

  it('takes the service key from the environment, never from a file', () => {
    expect(IMPORTER).toContain('process.env.SUPABASE_SERVICE_ROLE_KEY');
    expect(IMPORTER).toContain('do not add it to .env');
  });
});

describe('cost telemetry is ready but dormant', () => {
  const card: RateCard = {
    pricingVersion: '2026-01-01.test',
    currency: 'USD',
    ratesPerMillion: {
      llm_input_token: 1,
      llm_output_token: 10,
      tts_character: 100,
      delivery_byte: 0.0001,
    },
  };

  const composed = composeFor('nervous_ready', 600);
  if (!composed.ok) throw new Error('fixture failed');
  const { manifest } = composed;

  it('derives the segment mix from the manifest, not from a caller', () => {
    // The reuse ratio is the economic thesis. A hand-supplied number would be
    // the first thing to drift from what was actually composed.
    const mix = segmentMix(manifest);
    expect(mix.library).toBe(manifest.segments.filter((s) => s.kind === 'module').length);
    expect(mix.generated).toBe(0);
  });

  it('costs a session with no generation at nothing but delivery', () => {
    const row = costRowFor('m-1', 'u-1', manifest, {
      llm: null, tts: null, deliveryBytes: 5_000_000, cachedSegments: 0,
    }, card);

    expect(row.tts_cost_micros).toBe(0);
    expect(row.llm_cost_micros).toBe(0);
    expect(row.total_variable_cost_micros).toBe(500);
  });

  it('prices real usage when it eventually exists', () => {
    const row = costRowFor('m-1', 'u-1', manifest, {
      llm: { provider: 'p', model: 'm', inputTokens: 400, outputTokens: 60 },
      tts: { provider: 'p', model: 'v', characters: 400, seconds: 30 },
      deliveryBytes: 5_000_000,
      cachedSegments: 0,
    }, card);

    expect(row.llm_cost_micros).toBe(1000);
    expect(row.tts_cost_micros).toBe(40_000);
    expect(row.total_variable_cost_micros).toBe(41_500);
    expect(row.pricing_version).toBe('2026-01-01.test');
  });

  it('keeps every figure an integer', () => {
    const row = costRowFor('m-1', null, manifest, {
      llm: null, tts: null, deliveryBytes: 1234, cachedSegments: 0,
    }, card);
    for (const key of ['llm_cost_micros', 'tts_cost_micros', 'delivery_cost_micros', 'total_variable_cost_micros']) {
      expect(Number.isInteger(row[key] as number)).toBe(true);
    }
  });

  it('refuses to price against a broken rate card', () => {
    const broken = { ...card, ratesPerMillion: { ...card.ratesPerMillion, tts_character: Number.NaN } };
    expect(() =>
      costRowFor('m-1', 'u-1', manifest, { llm: null, tts: null, deliveryBytes: 0, cachedSegments: 0 }, broken)
    ).toThrow(/cannot price/);
  });

  it('is not called from the production composer', () => {
    // Dormant on purpose: with nothing generated the row would be all zeros,
    // and a table of zero-cost rows looks like telemetry while saying nothing.
    const composer = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'functions', 'compose', 'index.ts'), 'utf8'
    );
    expect(composer).not.toContain('costRowFor');
  });
});

describe('silence report — SILENCE ACCEPTANCE DECISION REQUIRED', () => {
  it('reports silence for every recipe and duration', () => {
    const rows: string[] = ['  recipe               dur   total  module  silence   %'];
    for (const recipe of RECIPES) {
      for (const seconds of DURATIONS) {
        const result = composeFor(recipe, seconds);
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('unreachable');

        const total = result.manifest.durationSeconds;
        const silence = result.manifest.segments
          .filter((s) => s.kind === 'silence')
          .reduce((n, s) => n + s.durationSeconds, 0);
        const spoken = total - silence;

        rows.push(
          `  ${recipe.padEnd(20)} ${String(seconds).padStart(4)} ${String(total).padStart(6)} ` +
          `${String(spoken).padStart(7)} ${String(silence).padStart(8)} ${String(Math.round(silence / total * 100)).padStart(3)}%`
        );

        // No target is asserted. There is no approved threshold, and inventing
        // one here would turn a product decision into a test.
        expect(silence).toBeGreaterThanOrEqual(0);
        expect(spoken).toBeGreaterThan(0);
      }
    }
    console.log('\n' + rows.join('\n') + '\n');
  });
});

describe('the audio spec agrees with the tooling', () => {
  /**
   * The spec is what a voice producer works from; the validator is what
   * actually runs. When they disagree, the producer follows the document and
   * every delivered file fails — or worse, an approved module arrives with no
   * findable audio and the import stops halfway through a tranche.
   *
   * This happened: the spec specified `<family>_<key>_<seconds>s.m4a` while the
   * tooling looked for `<module_key>.m4a`. Nothing caught it, because nothing
   * compared the two.
   */
  const SPEC = readFileSync(join(__dirname, '..', '..', 'docs', 'audio-production-spec.md'), 'utf8');
  const VALIDATOR_SOURCE = readFileSync(VALIDATOR, 'utf8');

  it('names delivered files the way the tooling looks for them', () => {
    // The tooling resolves audio as basename(storage_path), and storage_path is
    // modules/<family>/<module_key>.m4a — so the file is <module_key>.m4a.
    expect(VALIDATOR_SOURCE).toContain('basename(m.storage_path');
    expect(SPEC).toContain('`<module_key>.m4a`');
  });

  it('no longer specifies the pattern that nothing implemented', () => {
    // The old pattern may still appear in the correction note explaining why it
    // was wrong — that is history, not a specification. What must not survive
    // is the naming ROW still asserting it.
    const namingRow = SPEC.split('\n').find((line) => line.startsWith('| Naming |'));
    expect(namingRow).toBeDefined();
    expect(namingRow).toContain('<module_key>.m4a');
    expect(namingRow).not.toContain('<seconds>s');
  });

  it('states the same storage path the validator enforces', () => {
    // Built without a literal backslash so the assertion cannot drift from the
    // source through escaping alone.
    const pattern = ['^modules', '[a-z]+', '[a-z0-9_]+'].join('\\/');
    expect(VALIDATOR_SOURCE).toContain(pattern);
    expect(SPEC).toContain('modules/<family>/<module_key>.m4a');
  });
});

describe('a skipped audio check is never an import-ready pass', () => {
  /**
   * Found by exercising the pipeline end to end with a fixture.
   *
   * Without ffprobe the only thing verified about a file is that it exists and
   * is not empty -- a text file renamed `.m4a` passes. The validator was
   * nonetheless printing "PASS -- nothing blocking import", which contradicts
   * its own stated principle that a skipped check is never reported as a pass,
   * and is exactly how non-conforming masters would reach the private bucket
   * and fail on someone's device after a tranche had been recorded.
   *
   * The contract is now three-valued:
   *   0  records valid; audio either verified or never claimed
   *   1  records invalid
   *   2  records valid, audio NOT verified
   */
  const withAudio = (records: unknown[], files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'elsea-audio-'));
    const audio = join(dir, 'audio');
    mkdirSync(audio);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(audio, name), body);
    const file = join(dir, 'manifest.json');
    writeFileSync(file, JSON.stringify(records));
    try {
      const output = execFileSync(process.execPath, [VALIDATOR, file, '--audio-dir', audio], {
        encoding: 'utf8',
      });
      return { code: 0, output };
    } catch (error) {
      const e = error as { status: number; stdout?: string; stderr?: string };
      return { code: e.status, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  const hasFfprobe = (() => {
    try {
      execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  it('exits 0 when no audio directory is given, claiming nothing about audio', () => {
    // Records-only validation is a legitimate use and must stay clean.
    expect(validate([valid()]).code).toBe(0);
  });

  it('does not report an unverified master as import-ready', () => {
    const result = withAudio([valid()], { 'probe_module.m4a': 'not audio' });

    if (hasFfprobe) {
      // With ffprobe present the text file is properly rejected as bad media.
      expect(result.code).toBe(1);
      return;
    }

    // Without it, the records are valid but nothing about the audio is known.
    expect(result.code).toBe(2);
    expect(result.output).toContain('audio itself was NOT verified');
    expect(result.output).not.toContain('nothing blocking import');
  });

  it('still names what it skipped rather than staying quiet', () => {
    const result = withAudio([valid()], { 'probe_module.m4a': 'not audio' });
    if (hasFfprobe) return;
    expect(result.output).toContain('SKIPPED');
  });

  it('reports invalid records as a failure, not as unverified audio', () => {
    // Exit 1 must win over exit 2: a bad record is a hard failure whether or
    // not the audio could be checked.
    const result = withAudio([valid({ family: 'invented' })], { 'probe_module.m4a': 'x' });
    expect(result.code).toBe(1);
  });

  it('the importer refuses to commit unverified audio unless overridden', () => {
    const IMPORTER = join(__dirname, '..', '..', 'scripts', 'modules-import.mjs');
    const source = readFileSync(IMPORTER, 'utf8');

    // The guard applies to --commit only: a dry run writes nothing, so seeing
    // the plan with unchecked audio is useful rather than dangerous.
    expect(source).toContain('audioUnverified && commit && !allowUnverified');
    expect(source).toContain('--allow-unverified-audio');
    expect(source).toContain('error?.status === 2');
  });
});
