/**
 * ELSEA domain types.
 *
 * These mirror the closed vocabularies the Edge Function and the database
 * already use. They are deliberately unions of literals rather than `string`:
 * the whole product rests on the idea that states, transitions and outcomes
 * come from an approved catalogue and cannot be invented at runtime.
 */

/** Where someone is now. Matches STATES_CURRENT in supabase/functions/interpret. */
export const STATES_CURRENT = [
  'wound_up',
  'anxious',
  'scattered',
  'flat',
  'angry',
  'overwhelmed',
  'tired_wired',
  'nervous',
  'low_energy',
  'neutral',
] as const;

/** Where they need to be. Matches STATES_TARGET in the same function. */
export const STATES_TARGET = [
  'home',
  'focused',
  'ready',
  'sleep',
  'activated',
  'settled',
] as const;

export type StateCurrent = (typeof STATES_CURRENT)[number];
export type StateTarget = (typeof STATES_TARGET)[number];

/** The five V1 transitions. Keys are the canonical database keys. */
export const TRANSITION_KEYS = [
  'wound_up_home',
  'scattered_focused',
  'nervous_ready',
  'wired_sleep',
  'flat_go',
] as const;

export type TransitionKey = (typeof TRANSITION_KEYS)[number];

export function isTransitionKey(value: unknown): value is TransitionKey {
  return typeof value === 'string' && (TRANSITION_KEYS as readonly string[]).includes(value);
}

/**
 * The Edge Function's response. Three shapes, one discriminant.
 *
 * `support` is the safety diversion. `picker` is the non-AI fallback — it is
 * reached when interpretation is unavailable or unsure, and is a safe path,
 * not an error. `session` is the only shape that carries an interpretation.
 */
export type InterpretResult =
  | { route: 'support' }
  | { route: 'picker'; reason: string }
  | {
      route: 'session';
      transition_key: string;
      session_id: string;
      duration_seconds: number;
      state_current: string;
      state_target: string;
      context_tag: string | null;
      taxonomy_version: number;
    };

/** The interpretation, once validated against the closed vocabularies. */
export type Interpretation = {
  transitionKey: TransitionKey;
  sessionId: string;
  durationSeconds: number;
  stateCurrent: StateCurrent;
  stateTarget: StateTarget;
  contextTag: string | null;
  /** How this transition was arrived at. Recorded so corrections are visible. */
  origin: RunOrigin;
};

export type RunOrigin = 'interpreted' | 'corrected' | 'picker' | 'quick_return';

/** The four approved V1 time choices. `unsure` lets ELSEA decide. */
export const DURATION_CHOICES = ['short', 'medium', 'long', 'unsure'] as const;
export type DurationChoice = (typeof DURATION_CHOICES)[number];

/**
 * Each choice as a second range, used to filter the catalogue. `unsure` has no
 * bounds — selection falls back to the catalogue's own default behaviour.
 */
export const DURATION_RANGE: Record<DurationChoice, { min: number; max: number } | null> = {
  short: { min: 120, max: 300 },
  medium: { min: 300, max: 600 },
  long: { min: 600, max: 1200 },
  unsure: null,
};

/** A session from the approved catalogue. */
export type CatalogueSession = {
  id: string;
  transitionKey: string;
  durationSeconds: number;
  intensity: number;
  requiresHeadphones: boolean;
};

/** One audio segment of a catalogue session. */
export type SessionSegment = {
  id: string;
  ordinal: number;
  storagePath: string;
  durationSeconds: number;
};

/** An attempt at a session. */
export type RunStatus = 'started' | 'completed' | 'ended_early' | 'abandoned';

export type SessionRun = {
  id: string;
  sessionId: string;
  transitionKey: string;
  durationSeconds: number;
  status: RunStatus;
  elapsedSeconds: number;
  startedAt: string;
  endedAt: string | null;
};

/** Controlled outcome values. Never store the presentation text. */
export const OUTCOMES = ['yes', 'partly', 'not_really'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/**
 * How the audio engine is doing. Distinct from the flow state: a session can
 * be `active` in the product while the player is still `loading`.
 */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'failed';

/**
 * Failure kinds, kept apart internally so the product can respond correctly
 * even though the person only ever sees a calm, non-technical message.
 */
export type ElseaFailure =
  | 'network'
  | 'safety'
  | 'interpretation'
  | 'selection'
  | 'audio'
  | 'persistence'
  | 'unknown';
