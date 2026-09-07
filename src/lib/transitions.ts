import type { StateCurrent, StateTarget, TransitionKey } from '@/types/elsea';

/**
 * The approved mapping from a (current, target) pair to a transition.
 *
 * This mirrors `transitionKeyFor` in `supabase/functions/interpret/index.ts`.
 * It is duplicated rather than shared because the Edge Function runs on Deno
 * and cannot import from the app bundle — but the two must stay in step, so
 * change them together.
 *
 * It exists client-side only for the correction screen, where the person picks
 * the pair themselves. It is not an interpretation path: no free text reaches
 * it, so it does not — and must not — bypass anything.
 */
const TRANSITION_BY_PAIR: Record<string, TransitionKey> = {
  'wound_up|home': 'wound_up_home',
  'angry|home': 'wound_up_home',
  'overwhelmed|home': 'wound_up_home',
  'wound_up|settled': 'wound_up_home',
  'angry|settled': 'wound_up_home',

  'scattered|focused': 'scattered_focused',
  'overwhelmed|focused': 'scattered_focused',

  'nervous|ready': 'nervous_ready',
  'anxious|ready': 'nervous_ready',
  'nervous|settled': 'nervous_ready',

  'tired_wired|sleep': 'wired_sleep',
  'wound_up|sleep': 'wired_sleep',
  'anxious|sleep': 'wired_sleep',

  'flat|activated': 'flat_go',
  'low_energy|activated': 'flat_go',
  'flat|ready': 'flat_go',
};

export function transitionFor(
  current: StateCurrent,
  target: StateTarget
): TransitionKey | null {
  return TRANSITION_BY_PAIR[`${current}|${target}`] ?? null;
}

/**
 * The current states someone can pick on the correction screen, and the
 * targets available for each.
 *
 * Derived from the mapping above rather than written out again, so a pair can
 * never be offered that has no approved transition behind it.
 */
export const SELECTABLE_CURRENT: StateCurrent[] = Array.from(
  new Set(Object.keys(TRANSITION_BY_PAIR).map((pair) => pair.split('|')[0] as StateCurrent))
);

export function targetsFor(current: StateCurrent): StateTarget[] {
  return Object.keys(TRANSITION_BY_PAIR)
    .filter((pair) => pair.startsWith(`${current}|`))
    .map((pair) => pair.split('|')[1] as StateTarget);
}
