import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSessionFlow } from '@/state/session-flow';

/**
 * Route protection.
 *
 * The app must survive being entered anywhere — a reload in development, a
 * deep link, a back press into a screen whose state has since been cleared.
 * Rather than let a screen read a null and crash, each one declares what it
 * needs, and this sends the person somewhere sensible when it is missing.
 *
 * `interpretation` additionally requires that the safety gate has passed for
 * the current input. That check is what stops someone reaching Screen 04 by
 * navigating straight to `/interpretation`: the flag is written in exactly one
 * place, on a `session` result from the server, and nothing else can set it.
 *
 * Returns whether the screen may render. Callers render nothing while false —
 * the redirect happens on the next frame.
 */
export type FlowRequirement = 'safe_interpretation' | 'session' | 'run';

export function useFlowGuard(requirement: FlowRequirement): boolean {
  const { interpretation, selectedSession, run, safetyCleared } = useSessionFlow();

  const satisfied =
    requirement === 'safe_interpretation'
      ? Boolean(interpretation) && safetyCleared
      : requirement === 'session'
        ? Boolean(selectedSession)
        : Boolean(run);

  useEffect(() => {
    if (satisfied) return;

    // Recovery targets are chosen so the person lands somewhere that makes
    // sense rather than at the very start every time.
    const target =
      requirement === 'run' ? '/today' : requirement === 'session' ? '/time' : '/whats-going-on';

    router.replace(target);
  }, [satisfied, requirement]);

  return satisfied;
}
