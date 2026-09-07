/**
 * ELSEA™ design tokens.
 *
 * Scoped deliberately to what the production screens built so far actually use.
 * This is not a full design system — tokens are added as screens are approved.
 *
 * The Expo starter's `theme.ts` is left untouched; it still serves the template
 * screens under /starter.
 */

export const ElseaColor = {
  // --- The field -------------------------------------------------------
  /** Base. Near-black indigo. */
  ink: '#0E0A18',
  /** Deep indigo. */
  deep: '#17102A',
  /** Dark violet. */
  fieldMid: '#211237',
  aubergine: '#34184F',
  purple: '#5A2C88',
  /** Bright violet — the light in the lower-mid bloom. */
  bloom: '#8450D7',
  lilac: '#B792F4',
  /** Pale lilac. */
  pale: '#EDE4FA',

  // --- Type ------------------------------------------------------------
  text: '#FAF8FA',
  wordmark: '#F7F3FC',

  // --- Screen 01 action: pale ------------------------------------------
  surface: '#EEE5F7',
  surfacePressed: '#DCD0EC',
  onSurface: '#2B1840',

  // --- Screen 02 action: violet ----------------------------------------
  actionViolet: '#8850E8',
  /** Pressed step of the same hue. Not specified; derived. */
  actionVioletPressed: '#7A45D2',
  onActionViolet: '#FFFFFF',

  // --- Screen 02 listening surface: a light field in the dark ----------
  inputSurface: '#EDE4FA',
  inputText: '#372149',
  /** Placeholder and the microphone glyph on the light surface. */
  inputMuted: '#4C3463',

  /** Used only as a low-alpha hairline. */
  lift: '#FFFFFF',
} as const;

/** Text alphas, as specified. Kept named so no raw rgba() appears in components. */
export const ElseaTextAlpha = {
  primary: 1,
  /** Supporting copy, on `pale`. */
  supporting: 0.76,
  /** Secondary text action. */
  action: 0.72,
  /** by ALIGNEX, on `pale`. */
  provenance: 0.68,
  /** Helper line, on `pale`. */
  helper: 0.72,
  /** Continue label while dormant, on `pale`. */
  disabledLabel: 0.45,
  /** Placeholder, on `inputMuted`. */
  placeholder: 0.55,
} as const;

/** Non-text alphas. */
export const ElseaSurfaceAlpha = {
  /** Listening surface fill, on `inputSurface`. */
  inputFill: 0.9,
  /** Listening surface hairline, on `lift`. */
  inputBorder: 0.2,
  /** Continue while dormant, on `actionViolet`. */
  actionDisabled: 0.24,
} as const;

export const ElseaSpace = {
  screenX: 24,
  /** Distance from the top safe-area boundary to the brand lockup. */
  brandTop: 78,
  /** Minimum clearance above the bottom safe-area boundary. */
  actionsBottom: 24,
  headlineToSupporting: 20,
  primaryToSecondary: 11,
  wordmarkToProvenance: 10,

  // Screen 02
  /** Back control offset below the top safe-area inset. */
  backTop: 8,
  /** Heading group offset below the top safe-area inset. */
  headingGroupTop: 78,
  headingToSupporting: 16,
  supportingToInput: 28,
  /** Listening surface padding. Bottom clears the microphone control. */
  inputPaddingTop: 22,
  inputPaddingX: 22,
  inputPaddingBottom: 56,
  inputToHelper: 18,
  /** Microphone control inset within the listening surface. */
  micRight: 12,
  micBottom: 10,
} as const;

export const ElseaType = {
  /**
   * The spec's starting point was 38/44. Measured, that does not hold the
   * mandated two-line break: "Change how you feel." needs ~383pt set in Inter
   * Semi Bold at 38pt, and ~356-368pt in SF Pro Display Semibold, against a
   * content width of 345pt on a 393pt iPhone and 327pt on a 375pt one. At 38pt
   * the first line wraps and the headline becomes three ragged lines.
   *
   * 34/40 keeps the two lines intact on every supported width with margin for
   * SF Pro's exact metrics. Raise this if it proves narrower on device — it is
   * the only place the value lives.
   */
  /**
   * The locked two-line break is the requirement; this is the largest size
   * that holds it. Measured on device at 3x density, "Change how you feel."
   * wraps to a third line at both 38 and 36 on 390pt and 393pt widths, and
   * holds two lines at 34 on every width. (430pt is wide enough for 36.)
   * Leading stays at 44 so the vertical rhythm and every offset below the
   * headline are unchanged.
   */
  headlineSize: 34,
  headlineLeading: 44,
  supportingSize: 17,
  supportingLeading: 24,

  // Screen 02
  headingSize: 38,
  headingLeading: 44,
  inputSize: 17,
  inputLeading: 25,
  helperSize: 15,
  helperLeading: 21,
  buttonSize: 17,
  buttonLeading: 22,
} as const;

export const ElseaRadius = {
  action: 18,
  /** Screen 02's Continue button. */
  continueAction: 20,
  /** Listening surface. */
  input: 22,
} as const;

export const ElseaSize = {
  actionHeight: 58,
  minTouchTarget: 44,
  headlineMaxWidth: 330,
  supportingMaxWidth: 330,
  /** Screen 02 */
  supportingQuietMaxWidth: 320,
  micGlyph: 20,
  backGlyph: 20,
} as const;

/**
 * Screen 02's listening surface, sized proportionally rather than by a set of
 * device-shaped constants: roughly a quarter of the usable height, bounded so
 * it is never cramped on a short phone nor cavernous on a tall one.
 *
 * While the keyboard is up the same proportion is taken of what is left, and
 * the floor drops to `inputMinKeyboard` — the surface gives ground, but the
 * person can always see several lines of what they are writing.
 */
export const ElseaInputSize = {
  preferredRatio: 0.25,
  min: 170,
  max: 224,
  /** Proportion of the space remaining once the keyboard is showing. */
  keyboardRatio: 0.34,
  /** Hard floor. The surface never goes below this, keyboard or not. */
  minKeyboard: 150,
  /** Clearance kept between the action region and the top of the keyboard. */
  keyboardClearance: 14,
} as const;

/**
 * Screen 01 brand lockup. Locked values — the wordmark does not step with
 * viewport size, because a brand mark that changes size is a different mark.
 */
export const ElseaArrivalBrand = {
  markSize: 26,
  markLeading: 32,
  markTracking: 7,
  markWeight: '300',
  provenanceSize: 9,
  provenanceTracking: 3,
  trademarkSize: 7,
} as const;

/**
 * Screen 01 composition.
 *
 * These are *relationships*, not screen coordinates. The headline has no top
 * offset at all — it is placed by the flexible spaces either side of it, which
 * is what keeps the composition intact across viewport heights.
 */
export const ElseaArrivalLayout = {
  wordmarkToProvenance: 12,
  supportingRightInset: 8,
  /**
   * How the free vertical space is split above and below the message region.
   * 46/39 puts the headline at roughly 43% down the usable area on the
   * canonical 393 x 852 frame — the reference keeps real negative space above
   * the message, but not the cavern an even split produced.
   *
   * Because the larger share sits above the headline, a shorter viewport takes
   * more out of the space above it than below — which is the required
   * behaviour, achieved by the ratio rather than by a special case.
   */
  spaceAboveMessage: 46,
  spaceBelowMessage: 39,
  /** The message never gets pushed flush against the action region. */
  minSpaceBelowMessage: 24,
} as const;

/**
 * Screen 01's palette, scoped to the arrival screen.
 *
 * Deliberately separate from `ElseaColor`: Screen 02's appearance is locked and
 * must not shift, and this screen's reference uses a colder, deeper base than
 * the shared field.
 */
export const ElseaArrivalColor = {
  baseBlackIndigo: '#08071A',
  deepNavy: '#0C0A24',
  deepViolet: '#17103B',
  aubergine: '#28134F',
  purple: '#5425A6',
  brightViolet: '#7C42E8',
  luminousLilac: '#B58AFF',
  paleLilac: '#EADFFF',
  offWhite: '#FAF8FC',
  secondaryText: '#C9BDD5',
  ctaText: '#241332',
  /** Ambient mid-stop between navy and deep violet. */
  ambientMid: '#0D0925',
  /** Ambient base at the very bottom. */
  ambientFoot: '#100A2A',
} as const;

/**
 * Screen 01's curved artwork, expressed relative to the viewport.
 *
 * The reference geometry (a 760pt circle at -430 / 350 on a 393 x 852 frame)
 * is where these fractions come from, but the numbers themselves are no longer
 * used: the artwork is a separate responsive system from the interface, and
 * scales with the viewport so its visible arc keeps the same relationship to
 * the message region on every frame.
 */
export const ElseaArrivalForm = {
  /** diameter = max(width x widthFactor, usableHeight x usableHeightFactor). */
  diameter: { widthFactor: 1.85, usableHeightFactor: 0.8 },
  /**
   * Circle centre. X is a fraction of viewport width (negative: the centre sits
   * off the left edge, so only the upper-right arc crosses the screen). Y is a
   * fraction of the usable height, measured from the top safe-area boundary.
   *
   * Sat lower and further off-screen than the first pass: the brightest part of
   * the rim now falls around the supporting copy rather than cutting through
   * the headline, which has to stay on the dark navy field.
   */
  center: { xFactor: -0.191, yFactor: 0.95 },
  /** Backlight: same centre, slightly larger, carrying the bloom. */
  backlight: { scale: 1.08, opacity: 0.3 },
  /** Lower atmospheric field behind the action region. */
  lowerField: {
    widthFactor: 1.4,
    leftFactor: -0.2,
    usableHeightFactor: 0.55,
    bottom: 20,
    opacity: 0.18,
  },
} as const;

/** Decorative atmosphere layer opacities. Only Layer A ever changes. */
export const ElseaField = {
  layerAEmpty: 0.28,
  layerAHeard: 0.34,
  layerB: 0.34,
  layerC: 0.16,
} as const;

/**
 * Entry motion. Total arrival lands at ~640ms.
 * Values are milliseconds.
 */
export const ElseaMotion = {
  brandDuration: 380,
  brandDelay: 40,
  heroDuration: 420,
  heroDelay: 140,
  heroTravel: 8,
  actionsDuration: 380,
  actionsDelay: 260,
  pressDuration: 120,
  /**
   * The field lifting once there is something real in the input. Slow enough
   * to be felt rather than noticed. Never pulses, never per-keystroke.
   */
  fieldLift: 600,

  /** Screen 02 arrives more quietly than Screen 01 — it is a continuation. */
  contentDuration: 300,
  contentDelay: 60,
  contentTravel: 6,
} as const;

/** Caps so Dynamic Type scales without collapsing the layout. */
export const ElseaFontScaleCap = {
  wordmark: 1.2,
  headline: 1.3,
  supporting: 1.5,
  action: 1.4,
  heading: 1.3,
  input: 1.4,
  helper: 1.4,
} as const;

/**
 * Returns an rgba() string for a hex token at a given alpha.
 * Keeps colour maths in one place rather than scattering literals through JSX.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Height-class spacing.
 *
 * Vertical rhythm only. Typography is not in this table: heading size is a
 * function of available *width* (see `ElseaArrivalHeadline` and
 * `ElseaHeadingScale`), and the brand lockup does not step at all. Height
 * decides how much room the composition has, not how large the type is.
 *
 * Screen 02's typography is not in this table — it is locked and identical
 * across classes; only its spacing responds.
 */
export const ElseaBreakpoint = {
  compact: {
    // Screen 01
    brandMarginTop: 36,
    headlineToSupporting: 24,
    supportingSize: 15,
    supportingLeading: 21,
    ctaHeight: 52,
    ctaToAccount: 14,
    // Screen 02 — header rhythm only
    backToHeading: 12,
    headingToSupporting: 9,
    supportingToInput: 21,
  },
  standard: {
    brandMarginTop: 56,
    headlineToSupporting: 24,
    supportingSize: 15,
    supportingLeading: 21,
    ctaHeight: 54,
    ctaToAccount: 18,
    backToHeading: 16,
    headingToSupporting: 13,
    supportingToInput: 25,
  },
  tall: {
    brandMarginTop: 70,
    headlineToSupporting: 24,
    supportingSize: 15,
    supportingLeading: 21,
    ctaHeight: 54,
    ctaToAccount: 18,
    backToHeading: 16,
    headingToSupporting: 13,
    supportingToInput: 25,
  },
} as const;

/**
 * SCREEN 01 headline.
 *
 * Width controls this, never height: what decides whether the headline holds
 * its locked two-line composition is how much horizontal room the first
 * sentence has, not how tall the phone is.
 *
 * The composition is two locked lines — "Change how you feel." and "Not who
 * you are." — and neither sentence may break internally on a standard or wide
 * screen. `standardFallback` is the one step down to take if the first
 * sentence ever fails to fit before any wrapping is allowed.
 */
export const ElseaArrivalHeadline = {
  narrow: { size: 27, leading: 32 },
  standard: { size: 29, leading: 34 },
  wide: { size: 31, leading: 36 },
  standardFallback: { size: 28, leading: 34 },
  weight: '600',
  letterSpacing: -0.4,
  color: '#FAF8FC',
} as const;

/** The CTA label does not step: it is the same voice at every size. */
export const ElseaActionType = {
  size: 15,
  leading: 20,
} as const;

/** Floor for the action region's bottom padding when there is no home indicator. */
export const ElseaActionBottomMin = 12;

/**
 * SHARED RESPONSIVE HEADING SCALE.
 *
 * A locked ELSEA rule, intended for every screen that follows: heading size
 * responds to available *width*, because width is what decides whether a
 * heading wraps. Three steps, chosen by width class — never by device name,
 * never continuously, and never by shrinking the interface to keep a heading
 * on one line.
 *
 * A heading takes one line when it fits and two when it does not. Everything
 * beneath it moves down with it, which is only possible because nothing below
 * a heading is positioned by coordinate.
 */
export const ElseaHeadingScale = {
  narrow: { size: 25, leading: 30 },
  standard: { size: 27, leading: 32 },
  wide: { size: 29, leading: 34 },
} as const;

export const ElseaHeadingStyle = {
  weight: '600',
  letterSpacing: -0.35,
  color: '#FAF8FC',
  /** A heading may wrap to two lines. It is never truncated or ellipsised. */
  maxLines: 2,
} as const;

/**
 * SCREEN 02 — locked reference values.
 *
 * Scoped to this screen so Screen 01's locked appearance cannot be disturbed
 * by a change made here. Everything keyed by width class is a typographic or
 * horizontal decision; everything keyed by height class is vertical.
 */
export const ElseaS02Color = {
  /** Field. */
  base: '#070719',
  atmosphereTop: '#0B0922',
  atmosphereMid: '#140A32',
  atmosphereLow: '#1D0D46',
  atmosphereViolet: '#3C147B',
  violetTrace: '#6B32D1',

  /** Listening surface. */
  inputSurface: '#EEE8F7',
  inputBorder: 'rgba(255, 255, 255, 0.32)',
  inputBorderFocused: 'rgba(181, 138, 255, 0.72)',
  placeholder: '#8D79AF',
  inputText: '#39254E',

  /** Secondary prompt. */
  prompt: '#C7BDD7',

  /** Shortcut chips. */
  chipSurface: 'rgba(53, 31, 91, 0.74)',
  chipBorder: 'rgba(146, 103, 226, 0.48)',
  chipText: '#F3EDF9',
  chipSelectedSurface: 'rgba(92, 45, 164, 0.82)',
  chipSelectedBorder: '#8F5CF2',
  chipSelectedText: '#FFFFFF',
  moreSurface: 'rgba(53, 31, 91, 0.56)',
  moreBorder: 'rgba(146, 103, 226, 0.34)',
  moreText: '#BEB1D2',

  /** Continue. */
  ctaFrom: '#7542E8',
  ctaTo: '#9A48F5',
  ctaSolid: '#8347EF',
  ctaLabel: '#FFFFFF',
  ctaDisabledSurface: 'rgba(131, 71, 239, 0.22)',
  ctaDisabledLabel: 'rgba(255, 255, 255, 0.38)',
} as const;

/** Vertical rhythm and sizes that step with width class. */
export const ElseaS02Metric = {
  narrow: {
    backToHeading: 10,
    headingToInput: 18,
    inputHeight: 156,
    inputToPrompt: 18,
    placeholderSize: 14,
    placeholderLeading: 20,
  },
  standard: {
    backToHeading: 12,
    headingToInput: 20,
    inputHeight: 166,
    inputToPrompt: 21,
    placeholderSize: 15,
    placeholderLeading: 21,
  },
  wide: {
    backToHeading: 14,
    headingToInput: 22,
    inputHeight: 176,
    inputToPrompt: 22,
    placeholderSize: 15,
    placeholderLeading: 21,
  },
} as const;

/** Fixed Screen 02 values that do not step. */
export const ElseaS02 = {
  backTop: 6,
  backGlyph: 19,
  inputRadius: 17,
  inputPadding: 18,
  promptSize: 13,
  promptLeading: 18,
  chipsTop: 12,
  chipGap: 8,
  chipHeight: 34,
  chipPaddingX: 14,
  chipRadius: 17,
  chipTextSize: 12,
  ctaHeight: 54,
  ctaRadius: 18,
  ctaTextSize: 15,
  ctaTextLeading: 20,
  /** Minimum clearance below the action region. */
  ctaBottom: 16,
  /** Clearance kept between the action region and the keyboard. */
  ctaKeyboardClearance: 12,
  /** Floors for the listening surface. */
  inputMinCompact: 150,
  inputMinKeyboard: 145,
} as const;

/** The eight shortcut states, in reference order. */
export const ELSEA_SHORTCUTS = [
  'Stressed',
  'Anxious',
  'Low',
  'Overwhelmed',
  'Tired',
  'Wired',
  'Distracted',
  'Flat',
] as const;

export type ElseaShortcut = (typeof ELSEA_SHORTCUTS)[number];
