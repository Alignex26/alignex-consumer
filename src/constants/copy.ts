/**
 * Every user-facing string in the ELSEA flow, in one place.
 *
 * A dedicated wording pass follows the functional build, so each block carries
 * its review status. The status markers are for us — they are never rendered,
 * with the single deliberate exception of `SupportCopy.developmentNotice`,
 * which must be impossible to miss in development precisely because the real
 * copy has not been written.
 *
 *   LOCKED                        approved, do not change without instruction
 *   PRODUCT COPY REVIEW REQUIRED  temporary structural wording
 *   SAFETY REVIEW REQUIRED        must be written/approved by a reviewer with
 *                                 crisis experience before release
 */

import type { DurationChoice, Outcome, StateCurrent, StateTarget, TransitionKey } from '@/types/elsea';

/** LOCKED — Screens 01 and 02 are approved and are not touched by this build. */
export const ArrivalCopy = {
  headlineLineOne: 'Change how you feel.',
  headlineLineTwo: 'Not who you are.',
  primaryAction: 'Tell me what’s going on',
  accountAction: 'I already have an account',
} as const;

/** LOCKED */
export const SituationCopy = {
  heading: 'What’s going on?',
  prompt: 'Or choose how you feel right now:',
  moreOptions: 'More options',
  primaryAction: 'Continue',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 03, Understanding. */
export const UnderstandingCopy = {
  heading: 'Got it.',
  supporting: 'Understanding what you need…',
} as const;

/**
 * SAFETY REVIEW REQUIRED — Screen, Support.
 *
 * There is no approved crisis or support copy in this repository, and none may
 * be invented: wording here has to be written or signed off by someone with
 * crisis experience, and the resources have to be correct for the person's
 * region. What ships below is a development placeholder that says so plainly.
 *
 * `developmentNotice` is the one string in this file that is deliberately
 * shown in the UI. It must remain visible until real copy replaces it, so that
 * this screen can never be mistaken for finished.
 */
export const SupportCopy = {
  developmentNotice: 'SAFETY REVIEW REQUIRED — this screen has no approved copy yet.',
  heading: 'Let’s pause here.',
  supporting:
    'Placeholder. Approved support wording and the correct regional resources have not been added to this repository.',
  action: 'Go back',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 04, Interpretation. */
export const InterpretationCopy = {
  contextLine: 'Here’s what I think is happening.',
  confirm: 'That’s right',
  correct: 'Not quite',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 05, Correction. */
export const CorrectionCopy = {
  heading: 'Let’s get this right.',
  currentLabel: 'Where I am now',
  targetLabel: 'Where I need to be',
  primaryAction: 'Continue',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 06, Time. */
export const TimeCopy = {
  heading: 'How much time do you have?',
  primaryAction: 'Find my session',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — the four approved V1 time options. */
export const DURATION_LABEL: Record<DurationChoice, { title: string; detail: string }> = {
  short: { title: '2–5 minutes', detail: 'A quick reset' },
  medium: { title: '5–10 minutes', detail: 'A deeper shift' },
  long: { title: '10–20 minutes', detail: 'When you have space' },
  unsure: { title: 'Not sure', detail: 'ELSEA will suggest' },
};

/** PRODUCT COPY REVIEW REQUIRED — Screen 07, Audio prep. */
export const AudioPrepCopy = {
  heading: 'Before we start.',
  headphones: 'Headphones are recommended.',
  volume: 'Set your volume somewhere comfortable.',
  primaryAction: 'Begin',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screens 10 and 11, pause and early exit. */
export const SessionCopy = {
  pause: 'Pause',
  resume: 'Resume',
  end: 'End session',
  exitHeading: 'End this session?',
  exitSupporting: 'You can come back to this whenever you want.',
  exitKeepGoing: 'Keep going',
  exitConfirm: 'End session',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 13, Outcome. */
export const OutcomeCopy = {
  heading: 'Did we get you there?',
  detailHeading: 'Anything else worth knowing?',
  detailSkip: 'Skip',
  primaryAction: 'Continue',
} as const;

export const OUTCOME_LABEL: Record<Outcome, string> = {
  yes: 'Yes',
  partly: 'Partly',
  not_really: 'Not really',
};

/** PRODUCT COPY REVIEW REQUIRED — Screen 15, Learning. */
export const LearningCopy = {
  heading: 'Noted.',
  supporting:
    'ELSEA uses what you tell us to choose better next time. It takes a few sessions before that means much.',
  primaryAction: 'Done',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screen 16, Today. */
export const TodayCopy = {
  heading: 'What do you need right now?',
  primaryAction: 'Tell me what’s going on',
  recentLabel: 'Last time',
  quickReturnPrompt: 'Need that again?',
  emptyRecent: 'Nothing yet. Your first session will show up here.',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screens 18 to 21, the personal area. */
export const YouCopy = {
  heading: 'You',
  patterns: 'Your patterns',
  audio: 'Audio preferences',
  notifications: 'Notifications',
  account: 'Account',
  patternsHeading: 'Your patterns',
  patternsEmpty: 'Not enough sessions yet to see anything useful.',
  audioHeading: 'Audio preferences',
  notificationsHeading: 'Notifications',
  accountHeading: 'Account',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screens 22, 23, 24 and sign-in. */
export const AccountCopy = {
  signInHeading: 'Welcome back.',
  signInAction: 'Send me a link',
  signInSent: 'Check your email for a sign-in link.',
  createHeading: 'Keep what works.',
  createSupporting: 'An account saves your sessions so ELSEA can learn what helps you.',
  emailLabel: 'Email address',
  paywallHeading: 'Keep going with ELSEA.',
  freeLimitHeading: 'That’s your free sessions for now.',
} as const;

/** PRODUCT COPY REVIEW REQUIRED — Screens 25 and 26, resilience. */
export const ErrorCopy = {
  heading: 'That didn’t work.',
  supporting: 'Something went wrong on our side. Nothing you did.',
  retry: 'Try again',
  back: 'Go back',
  offlineHeading: 'You’re offline.',
  offlineSupporting: 'ELSEA needs a connection for this. Try again when you’re back.',
} as const;

/**
 * PRODUCT COPY REVIEW REQUIRED — display labels for the closed vocabularies.
 *
 * These live here rather than coming from `transitions.display_name`, because
 * the seeded display names were written to the migration with broken encoding
 * ("Wound up â†’ Home"). That migration has been applied and must not be
 * edited, so the presentation layer owns these strings instead.
 */
export const STATE_CURRENT_LABEL: Record<StateCurrent, string> = {
  wound_up: 'Wound up',
  anxious: 'Anxious',
  scattered: 'Scattered',
  flat: 'Flat',
  angry: 'Angry',
  overwhelmed: 'Overwhelmed',
  tired_wired: 'Tired but wired',
  nervous: 'Nervous',
  low_energy: 'Low on energy',
  neutral: 'Neutral',
};

export const STATE_TARGET_LABEL: Record<StateTarget, string> = {
  home: 'Home',
  focused: 'Focused',
  ready: 'Ready',
  sleep: 'Sleep',
  activated: 'Going',
  settled: 'Settled',
};

export const TRANSITION_LABEL: Record<TransitionKey, string> = {
  wound_up_home: 'Wound up → Home',
  scattered_focused: 'Scattered → Focused',
  nervous_ready: 'Nervous → Ready',
  wired_sleep: 'Wired → Sleep',
  flat_go: 'Flat → Go',
};

/**
 * PRODUCT COPY REVIEW REQUIRED — the human sentence pair shown on Screen 04.
 *
 * Structural placeholders per transition. The Scenario A pair is the one the
 * specification gives; the rest follow its shape so the screen can be built
 * and reviewed as a whole.
 */
export const TRANSITION_READBACK: Record<TransitionKey, { from: string; to: string }> = {
  wound_up_home: { from: 'You’re still carrying work.', to: 'Let’s get you home.' },
  scattered_focused: { from: 'Your attention is everywhere.', to: 'Let’s get you focused.' },
  nervous_ready: { from: 'You’re nervous about what’s next.', to: 'Let’s get you ready.' },
  wired_sleep: { from: 'You’re tired but still switched on.', to: 'Let’s get you down for sleep.' },
  flat_go: { from: 'There’s nothing in the tank.', to: 'Let’s get you moving.' },
};

/**
 * SESSION CONTENT — not global UI copy.
 *
 * These belong to the catalogue rather than the interface: they are the words
 * a particular session opens and closes with. They live here only because the
 * schema has no column for them yet, and the Scenario A pair is the one the
 * specification supplies. The rest follow its shape.
 *
 * PRODUCT COPY REVIEW REQUIRED. If session opening/arrival text is later added
 * to `sessions_catalogue`, read it from there and delete this.
 */
export const SESSION_OPENING: Record<TransitionKey, string> = {
  wound_up_home: 'Let’s leave the day here.',
  scattered_focused: 'Let’s bring it all back to one place.',
  nervous_ready: 'Let’s get you steady.',
  wired_sleep: 'Let’s let the day go.',
  flat_go: 'Let’s find something to move with.',
};

export const SESSION_ARRIVAL: Record<TransitionKey, string> = {
  wound_up_home: 'Welcome home.',
  scattered_focused: 'You’re here.',
  nervous_ready: 'You’re ready.',
  wired_sleep: 'Rest well.',
  flat_go: 'Off you go.',
};

/**
 * PRODUCT DECISION REQUIRED — the optional extra outcome signal (Screen 14).
 *
 * One controlled question with controlled answers, deliberately narrow so it
 * cannot become journaling. Which question earns its place has not been
 * decided; this is a structural placeholder.
 */
export const OUTCOME_DETAIL_CODES = ['too_short', 'too_long', 'right_length'] as const;
export type OutcomeDetailCode = (typeof OUTCOME_DETAIL_CODES)[number];

export const OUTCOME_DETAIL_LABEL: Record<OutcomeDetailCode, string> = {
  too_short: 'It ended too soon',
  right_length: 'The length was right',
  too_long: 'It went on too long',
};
