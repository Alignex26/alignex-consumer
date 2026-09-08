/**
 * THE ELSEA PRODUCT FLOW.
 *
 * One explicit model of the product's lifecycle, so it can be read rather than
 * inferred from which screen happens to push which route.
 *
 * This is not a second navigation system. Expo Router remains authoritative
 * for navigation; this describes the *product* states and which routes render
 * them, and gives route guards something to check against. Screens still call
 * `router.push`, but they do it through `routeForPhase`, so the map below is
 * the single description of the flow.
 *
 * The critical property encoded here: nothing can reach INTERPRETATION except
 * out of SAFETY_CHECK. See `canEnter` and §11 of the specification.
 */

export const PHASES = [
  'arrival',
  'input',
  'safety_check',
  'support',
  'interpretation',
  'correction',
  'time_selection',
  'audio_prep',
  'session_opening',
  'session_active',
  'session_paused',
  'early_exit',
  'arrival_result',
  'outcome',
  'outcome_detail',
  'learning',
  'home',
  'quick_return',
  'paywall',
  'free_limit',
  'error',
  'offline',
] as const;

export type Phase = (typeof PHASES)[number];

/**
 * Where each phase lives. Paths must match the files under `src/app`.
 *
 * `session_paused` and `early_exit` have no route of their own on purpose:
 * paused is a state of the active session, and early exit is a confirmation
 * presented over it. Making them separate screens would turn one experience
 * into three.
 */
export const PHASE_ROUTE: Record<Exclude<Phase, 'session_paused' | 'early_exit'>, string> = {
  arrival: '/',
  input: '/whats-going-on',
  safety_check: '/understanding',
  support: '/support',
  interpretation: '/interpretation',
  correction: '/correction',
  time_selection: '/time',
  audio_prep: '/audio-prep',
  session_opening: '/session-opening',
  session_active: '/session',
  arrival_result: '/arrival',
  outcome: '/outcome',
  outcome_detail: '/outcome-detail',
  learning: '/learning',
  home: '/today',
  quick_return: '/quick-return',
  paywall: '/paywall',
  free_limit: '/free-limit',
  error: '/error',
  offline: '/offline',
};

export function routeForPhase(phase: Exclude<Phase, 'session_paused' | 'early_exit'>): string {
  return PHASE_ROUTE[phase];
}

/**
 * What each phase is allowed to move to.
 *
 * Read this as the product's grammar. The entries that matter most:
 *
 *   input        → safety_check ONLY. There is no edge from input to
 *                  interpretation, which is what makes the gate unskippable
 *                  in the flow model as well as on the server.
 *   safety_check → time_selection (safe and understood), correction (safe
 *                  but not understood well enough to act on), support
 *                  (diverted), or error (the gate itself failed — fail
 *                  closed, never onward).
 *   support      → arrival | home. It never continues into the session path.
 *
 * `interpretation` is no longer on the main path: target + time absorbed the
 * confirm step, so the gate routes straight there. The phase and its route
 * remain for the correction flow and for recovery.
 */
export const ALLOWED_NEXT: Record<Phase, readonly Phase[]> = {
  arrival: ['input', 'home'],
  input: ['safety_check'],
  safety_check: ['time_selection', 'correction', 'support', 'error', 'offline'],
  // A safety diversion is a terminus for this attempt. It leads out of the
  // flow, never further into it.
  support: ['arrival', 'home'],
  interpretation: ['correction', 'time_selection'],
  correction: ['time_selection'],
  time_selection: ['audio_prep', 'paywall', 'free_limit', 'error'],
  audio_prep: ['session_opening'],
  session_opening: ['session_active'],
  session_active: ['session_paused', 'early_exit', 'arrival_result', 'error'],
  session_paused: ['session_active', 'early_exit'],
  early_exit: ['session_active', 'outcome'],
  arrival_result: ['outcome'],
  outcome: ['outcome_detail', 'learning'],
  outcome_detail: ['learning'],
  learning: ['home'],
  home: ['input', 'quick_return', 'paywall'],
  quick_return: ['audio_prep', 'input'],
  paywall: ['home', 'audio_prep'],
  free_limit: ['paywall', 'home'],
  error: ['arrival', 'home', 'input'],
  offline: ['arrival', 'home', 'input'],
};

export function canEnter(from: Phase, to: Phase): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

/**
 * Phases that must not be rendered without the state they depend on.
 *
 * Route guards use this so that a reload, a deep link or a back-button press
 * into the middle of the flow recovers calmly instead of crashing on a null.
 * The value is what the guard requires to be present.
 */
export const PHASE_REQUIRES: Partial<Record<Phase, 'interpretation' | 'session' | 'run'>> = {
  interpretation: 'interpretation',
  correction: 'interpretation',
  time_selection: 'interpretation',
  audio_prep: 'session',
  session_opening: 'session',
  session_active: 'session',
  arrival_result: 'run',
  outcome: 'run',
  outcome_detail: 'run',
};
