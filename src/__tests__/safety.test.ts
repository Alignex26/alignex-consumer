import { checkAndInterpret } from '@/lib/interpret-service';

/**
 * SAFETY TESTS.
 *
 * These cover the one property the product cannot be wrong about: nothing
 * reaches an interpretation unless the server said so, and every failure mode
 * resolves to the diversion rather than onward.
 *
 * The Edge Function is mocked at the module boundary — these test the client's
 * half of the contract. The server's own gate is tested by its own fixtures.
 */

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  callInterpret: jest.fn(),
  getSupabase: jest.fn(() => null),
}));

const { callInterpret } = jest.requireMock('@/lib/supabase') as {
  callInterpret: jest.Mock;
};

const SAFE_RESPONSE = {
  route: 'session',
  transition_key: 'wound_up_home',
  session_id: 'abc-123',
  duration_seconds: 420,
  state_current: 'wound_up',
  state_target: 'home',
  context_tag: 'after_work',
  taxonomy_version: 1,
};

beforeEach(() => {
  callInterpret.mockReset();
});

describe('the safety gate', () => {
  it('interprets only when the server returns a session route', async () => {
    callInterpret.mockResolvedValue(SAFE_RESPONSE);

    const result = await checkAndInterpret('Work was horrific.', null);

    expect(result.kind).toBe('interpreted');
    if (result.kind !== 'interpreted') throw new Error('unreachable');
    expect(result.interpretation.transitionKey).toBe('wound_up_home');
    expect(result.interpretation.origin).toBe('interpreted');
  });

  it('diverts when the gate flags the input', async () => {
    callInterpret.mockResolvedValue({ route: 'support' });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('sends someone to the picker when interpretation was unsure', async () => {
    callInterpret.mockResolvedValue({ route: 'picker', reason: 'low_confidence' });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('needs_picker');
  });

  // ---- FAIL CLOSED -------------------------------------------------------
  // Each of these is a way the check could fail to complete. None of them may
  // produce an interpretation.

  it('fails closed when the function throws', async () => {
    callInterpret.mockRejectedValue(new Error('interpret_unavailable'));

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('fails closed on a malformed response', async () => {
    callInterpret.mockResolvedValue({ nonsense: true });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('fails closed on a null response', async () => {
    callInterpret.mockResolvedValue(null);

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('fails closed when a state is outside the closed vocabulary', async () => {
    callInterpret.mockResolvedValue({ ...SAFE_RESPONSE, state_current: 'despairing' });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('fails closed when the transition key is not one of the five', async () => {
    callInterpret.mockResolvedValue({ ...SAFE_RESPONSE, transition_key: 'invented_thing' });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });

  it('fails closed when the session id is missing', async () => {
    callInterpret.mockResolvedValue({ ...SAFE_RESPONSE, session_id: null });

    const result = await checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });
});

describe('when Supabase is not configured', () => {
  it('fails closed rather than interpreting locally', async () => {
    jest.resetModules();
    jest.doMock('@/lib/supabase', () => ({
      isSupabaseConfigured: false,
      callInterpret: jest.fn(),
      getSupabase: jest.fn(() => null),
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const isolated = require('@/lib/interpret-service') as typeof import('@/lib/interpret-service');
    const result = await isolated.checkAndInterpret('anything', null);

    expect(result.kind).toBe('diverted');
  });
});
