/**
 * The analytics boundary.
 *
 * PostHog is not installed or configured in this project, so nothing is sent
 * anywhere yet. This exists so that every call site is already written against
 * a controlled interface: wiring a provider later is a change to `deliver()`
 * alone, and no screen has to be revisited.
 *
 * DATA MINIMISATION — the reason this is a closed union rather than a generic
 * `track(name, props)`:
 *
 *   - event names are a fixed list;
 *   - properties are typed, and every one is an identifier, an enum value or a
 *     number. There is no property anywhere in this file that can hold free
 *     text, so a person's own words cannot be sent by accident;
 *   - `deliver()` runs the payload through a guard that drops anything that
 *     is not a primitive of the expected shape.
 *
 * If you are adding an event: do not add a `string` property that could carry
 * user input. Add a code or an enum.
 */

import type { DurationChoice, Outcome, RunOrigin, TransitionKey } from '@/types/elsea';

/** Screens, as stable identifiers rather than route paths. */
export type ScreenId =
  | 'first_arrival'
  | 'situation'
  | 'understanding'
  | 'support'
  | 'interpretation'
  | 'correction'
  | 'time'
  | 'audio_prep'
  | 'session_opening'
  | 'session_active'
  | 'arrival_result'
  | 'outcome'
  | 'outcome_detail'
  | 'learning'
  | 'today'
  | 'quick_return'
  | 'you'
  | 'patterns'
  | 'audio_preferences'
  | 'notifications'
  | 'sign_in'
  | 'account'
  | 'paywall'
  | 'free_limit'
  | 'error'
  | 'offline';

/**
 * Why a safety check ended the way it did — at the coarsest possible grain.
 *
 * `diverted` says only that the gate sent the person to support. It carries no
 * category, no classification and nothing about what was written. `failed`
 * means the gate itself could not run, which is an operational signal we need.
 */
export type SafetyResult = 'passed' | 'diverted' | 'failed';

export type ElseaEvent =
  | { name: 'screen_viewed'; screen: ScreenId }
  | { name: 'input_started' }
  | { name: 'input_submitted'; hasText: boolean; hasShortcut: boolean }
  | { name: 'safety_check_completed'; result: SafetyResult }
  | { name: 'interpretation_presented'; transition: TransitionKey }
  | { name: 'interpretation_confirmed'; transition: TransitionKey }
  | { name: 'interpretation_corrected'; transition: TransitionKey }
  | { name: 'time_selected'; choice: DurationChoice }
  | { name: 'session_selected'; transition: TransitionKey; durationSeconds: number }
  | { name: 'session_started'; transition: TransitionKey; durationSeconds: number; origin: RunOrigin }
  | { name: 'session_paused'; elapsedSeconds: number }
  | { name: 'session_resumed'; elapsedSeconds: number }
  | { name: 'session_ended_early'; elapsedSeconds: number; durationSeconds: number }
  | { name: 'session_completed'; transition: TransitionKey; durationSeconds: number }
  | { name: 'outcome_recorded'; transition: TransitionKey; outcome: Outcome }
  | { name: 'learning_screen_viewed' }
  | { name: 'quick_return_started'; transition: TransitionKey }
  | { name: 'paywall_viewed' }
  | { name: 'account_created' };

/**
 * Strips anything that is not a primitive before a payload could reach a
 * provider. Belt and braces on top of the type system: the types stop this at
 * compile time, and this stops it if someone reaches for `as any`.
 */
function safeProperties(event: ElseaEvent): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(event)) {
    if (key === 'name') continue;
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      // Every string property in this file is an enum member or an id. A long
      // value means someone has introduced free text; drop it rather than
      // send it.
      out[key] = value.length <= 64 ? value : '[dropped]';
    }
  }
  return out;
}

function deliver(name: string, properties: Record<string, string | number | boolean>): void {
  // CONFIGURATION REQUIRED — no analytics provider is installed. When one is
  // added, send from here and nowhere else.
  void name;
  void properties;
}

export function track(event: ElseaEvent): void {
  deliver(event.name, safeProperties(event));
}

/** Convenience for the most common event, so screens read cleanly. */
export function trackScreen(screen: ScreenId): void {
  track({ name: 'screen_viewed', screen });
}
