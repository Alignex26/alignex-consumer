import { router } from 'expo-router';

/**
 * Every destination the ELSEA flow hands off to, declared in one place.
 *
 * `available: false` means the screen has not been built yet, so navigation is
 * skipped rather than falling through to a placeholder. Enabling a route later
 * is a one-line change here and nothing else moves.
 *
 * The paths mirror `PHASE_ROUTE` in `@/flow/product-flow`, which is where the
 * product lifecycle itself is described. This file is only about navigation.
 */

type RouteSpec = {
  readonly href: string;
  readonly available: boolean;
};

export const ElseaRoute = {
  /** Screen 01 */
  arrival: { href: '/', available: true },
  /** Screen 02 — What's going on? */
  situation: { href: '/whats-going-on', available: true },
  /** Screen 03 — Understanding. Runs the safety pipeline. */
  understanding: { href: '/understanding', available: true },
  /** Safety diversion. Outside the intervention flow. */
  support: { href: '/support', available: true },
  /** Screen 04 */
  interpretation: { href: '/interpretation', available: true },
  /** Screen 05 */
  correction: { href: '/correction', available: true },
  /** Screen 06 */
  time: { href: '/time', available: true },
  /** Screen 07 */
  audioPrep: { href: '/audio-prep', available: true },
  /** Screen 08 */
  sessionOpening: { href: '/session-opening', available: true },
  /** Screen 09, plus paused and early exit as states within it */
  session: { href: '/session', available: true },
  /** Screen 12 */
  arrivalResult: { href: '/arrival', available: true },
  /** Screen 13 */
  outcome: { href: '/outcome', available: true },
  /** Screen 14 */
  outcomeDetail: { href: '/outcome-detail', available: true },
  /** Screen 15 */
  learning: { href: '/learning', available: true },
  /** Screen 16 */
  today: { href: '/today', available: true },
  /** Screen 17 */
  quickReturn: { href: '/quick-return', available: true },
  /** Screen 18 */
  you: { href: '/you', available: true },
  /** Screen 19 */
  patterns: { href: '/patterns', available: true },
  /** Screen 20 */
  audioPreferences: { href: '/audio-preferences', available: true },
  /** Screen 21 */
  notifications: { href: '/notifications', available: true },
  signIn: { href: '/sign-in', available: true },
  /** Screen 22 */
  account: { href: '/account', available: true },
  /** Screen 23 */
  paywall: { href: '/paywall', available: true },
  /** Screen 24 */
  freeLimit: { href: '/free-limit', available: true },
  /** Screen 25 */
  error: { href: '/error', available: true },
  /** Screen 26 */
  offline: { href: '/offline', available: true },
} as const satisfies Record<string, RouteSpec>;

export type ElseaRouteName = keyof typeof ElseaRoute;

type Href = Parameters<typeof router.push>[0];

/**
 * Navigates to a declared ELSEA route, or does nothing (with a dev warning) if
 * that screen has not been built yet. Deliberately does not fall through to a
 * placeholder — no dummy customer-visible screens.
 */
export function navigateTo(name: ElseaRouteName): void {
  const route = ElseaRoute[name];

  if (!route.available) {
    if (__DEV__) {
      console.warn(
        `[ELSEA] Route "${name}" (${route.href}) is not built yet — navigation skipped.`
      );
    }
    return;
  }

  // Typed routes only know about screens that exist on disk, so the generated
  // route union cannot contain a path until its file lands. This is the single
  // place that gap is bridged.
  router.push(route.href as Href);
}

/**
 * Replaces rather than pushes. Used where going "back" would return someone to
 * a screen that no longer makes sense — out of a session, or out of support.
 */
export function replaceWith(name: ElseaRouteName): void {
  const route = ElseaRoute[name];
  if (!route.available) return;
  router.replace(route.href as Href);
}
