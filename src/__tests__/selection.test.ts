import { selectSession } from '@/lib/catalogue';
import { bandFor, loadPatterns } from '@/lib/patterns';

/**
 * Session selection and the personalisation layer.
 *
 * Selection has to stay inside the approved catalogue, respect the time the
 * person said they had, and prefer what has actually worked for them — without
 * ever inventing a session when none is eligible.
 */

const CATALOGUE = [
  { id: 's300', transition_key: 'wound_up_home', duration_seconds: 300, intensity: 2, requires_headphones: false },
  { id: 's420', transition_key: 'wound_up_home', duration_seconds: 420, intensity: 2, requires_headphones: false },
  { id: 's600', transition_key: 'wound_up_home', duration_seconds: 600, intensity: 2, requires_headphones: false },
  { id: 's900', transition_key: 'wound_up_home', duration_seconds: 900, intensity: 2, requires_headphones: false },
];

/** A minimal stand-in for the query builder shapes these modules use. */
function makeSupabase(options: {
  catalogue?: typeof CATALOGUE;
  catalogueError?: boolean;
  workedSessionIds?: string[];
  runs?: Record<string, unknown>[];
}) {
  return {
    from(table: string) {
      if (table === 'sessions_catalogue') {
        const result = options.catalogueError
          ? { data: null, error: new Error('network') }
          : { data: options.catalogue ?? CATALOGUE, error: null };
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ order: () => Promise.resolve(result) }) }),
          }),
        };
      }

      if (table === 'session_outcomes') {
        const data = (options.workedSessionIds ?? []).map((id) => ({
          outcome: 'yes',
          user_sessions: { session_id: id },
        }));
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data, error: null }) }) }),
            }),
          }),
        };
      }

      if (table === 'user_sessions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: options.runs ?? [], error: null }),
              }),
            }),
          }),
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: jest.fn(),
  callInterpret: jest.fn(),
}));

const { getSupabase } = jest.requireMock('@/lib/supabase') as { getSupabase: jest.Mock };

beforeEach(() => {
  getSupabase.mockReset();
});

describe('session selection', () => {
  it('picks the longest session inside the chosen range', async () => {
    getSupabase.mockReturnValue(makeSupabase({}));

    // 'medium' is 300-600 seconds.
    const result = await selectSession('wound_up_home', 'medium', null);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.session.durationSeconds).toBe(600);
    expect(result.personalised).toBe(false);
  });

  it('never returns a session longer than the person asked for', async () => {
    getSupabase.mockReturnValue(makeSupabase({}));

    // 'short' is 120-300 seconds.
    const result = await selectSession('wound_up_home', 'short', null);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.session.durationSeconds).toBeLessThanOrEqual(300);
  });

  it('falls back to the shortest session when unsure', async () => {
    getSupabase.mockReturnValue(makeSupabase({}));

    const result = await selectSession('wound_up_home', 'unsure', null);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    // A first experience should never run longer than someone expected.
    expect(result.session.durationSeconds).toBe(300);
  });

  it('prefers a session the person has said worked', async () => {
    getSupabase.mockReturnValue(makeSupabase({ workedSessionIds: ['s420'] }));

    // 420 is not the longest in 'long', but it is the one that worked.
    const result = await selectSession('wound_up_home', 'medium', 'user-1');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.session.id).toBe('s420');
    expect(result.personalised).toBe(true);
  });

  it('reports rather than invents when nothing is eligible', async () => {
    getSupabase.mockReturnValue(makeSupabase({ catalogue: [] }));

    const result = await selectSession('wound_up_home', 'medium', null);

    expect(result).toEqual({ ok: false, failure: 'none_eligible' });
  });

  it('reports a network failure rather than guessing', async () => {
    getSupabase.mockReturnValue(makeSupabase({ catalogueError: true }));

    const result = await selectSession('wound_up_home', 'medium', null);

    expect(result).toEqual({ ok: false, failure: 'network' });
  });

  it('works signed out, without personalisation', async () => {
    getSupabase.mockReturnValue(makeSupabase({ workedSessionIds: ['s420'] }));

    const result = await selectSession('wound_up_home', 'medium', null);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.personalised).toBe(false);
  });
});

describe('patterns', () => {
  it('reports no data for a signed-out person rather than inventing any', async () => {
    getSupabase.mockReturnValue(makeSupabase({}));

    const patterns = await loadPatterns(null);

    expect(patterns.totalRuns).toBe(0);
    expect(patterns.hasEnoughData).toBe(false);
    expect(patterns.mostRecent).toBeNull();
  });

  it('will not call a handful of sessions a pattern', async () => {
    getSupabase.mockReturnValue(
      makeSupabase({
        runs: [
          { id: 'r1', session_id: 's300', transition_key: 'wound_up_home', duration_seconds: 300, status: 'completed', started_at: '2026-09-01', session_outcomes: [{ outcome: 'yes' }] },
          { id: 'r2', session_id: 's300', transition_key: 'wound_up_home', duration_seconds: 300, status: 'completed', started_at: '2026-09-02', session_outcomes: [{ outcome: 'yes' }] },
        ],
      })
    );

    const patterns = await loadPatterns('user-1');

    expect(patterns.totalRuns).toBe(2);
    expect(patterns.hasEnoughData).toBe(false);
  });

  it('counts transitions and outcomes once there is enough', async () => {
    const run = (id: string, outcome: string | null, seconds: number) => ({
      id,
      session_id: `s${seconds}`,
      transition_key: 'wound_up_home',
      duration_seconds: seconds,
      status: 'completed',
      started_at: '2026-09-01',
      session_outcomes: outcome ? [{ outcome }] : [],
    });

    getSupabase.mockReturnValue(
      makeSupabase({
        runs: [
          run('r1', 'yes', 180),
          run('r2', 'yes', 180),
          run('r3', 'not_really', 900),
          run('r4', 'partly', 900),
        ],
      })
    );

    const patterns = await loadPatterns('user-1');

    expect(patterns.hasEnoughData).toBe(true);
    expect(patterns.totalRuns).toBe(4);
    expect(patterns.transitionCounts).toEqual([{ transition: 'wound_up_home', count: 4 }]);

    const short = patterns.durationOutcomes.find((row) => row.band === 'under_5');
    expect(short).toEqual({ band: 'under_5', positive: 2, total: 2 });
  });
});

describe('duration bands', () => {
  it('bands by the boundaries the ranges use', () => {
    expect(bandFor(180)).toBe('under_5');
    expect(bandFor(300)).toBe('five_to_ten');
    expect(bandFor(600)).toBe('five_to_ten');
    expect(bandFor(900)).toBe('over_ten');
  });
});
