// supabase/functions/_shared/types.ts
//
// The session-engine domain types, owned by the SERVER side.
//
// Direction of dependency matters here. `_shared` must never import from
// `src/`: it has to load in Deno, where the `@/` alias does not exist, and
// pulling app code into an Edge Function bundle would be backwards. So the
// shared side owns these definitions and the client re-exports them as TYPES
// ONLY, which babel erases — one definition, nothing shipped.
//
// Keep this file dependency-free, like the rest of `_shared`.

/**
 * The twelve approved product-level families.
 *
 * Canonical form is lower case, like every other identifier in the schema.
 * Upper case is a display treatment and never reaches the database, the API or
 * the domain model.
 *
 * These are TAXONOMY SLOTS. The technique that fills one is authored and
 * approved outside engineering (S4).
 */
export const MODULE_FAMILIES = [
  'orient',
  'regulate',
  'ground',
  'release',
  'reframe',
  'focus',
  'activate',
  'prepare',
  'transition',
  'settle',
  'sleep',
  'close',
] as const;

export type ModuleFamily = (typeof MODULE_FAMILIES)[number];

/** A reusable piece of library audio. Generated or produced once. */
export type InterventionModule = {
  id: string;
  moduleKey: string;
  family: ModuleFamily;
  techniqueKey: string;
  storagePath: string;
  durationSeconds: number;
  intensity: number;
  requiresHeadphones: boolean;
  isBed: boolean;
};

/**
 * One phase of a recipe.
 *
 * `isProvisional` carries S14: the drafted floors are provisional pending
 * clinical review, and code that treats one as settled is a bug.
 */
export type RecipePhase = {
  transitionKey: string;
  ordinal: number;
  phase: string;
  minSeconds: number;
  maxSeconds: number;
  isProvisional: boolean;
};

export type SegmentLayer = 'foreground' | 'bed';

/** Where dynamic speech may appear. Deliberately only two places. */
export const SPEECH_SLOTS = ['opening', 'closing'] as const;
export type SpeechSlot = (typeof SPEECH_SLOTS)[number];

/**
 * The structured facts a dynamic line may be built from.
 *
 * This is the complete set. There is no field for what the person wrote, which
 * is the point: the type makes the S3 boundary unforgeable rather than relying
 * on a caller to remember it.
 */
export type SpeechContext = {
  slot: SpeechSlot;
  transitionKey: string;
  stateCurrent: string;
  stateTarget: string;
  /** A closed tag from the interpreter, never free text. */
  contextTag: string | null;
  intensity: number;
};

export type SpeechRequest = {
  slot: SpeechSlot;
  scope: 'global' | 'situation' | 'personal';
  cacheKey: string;
  text: string;
  estimatedSeconds: number;
};

export type ManifestSegment =
  | {
      kind: 'module';
      ordinal: number;
      layer: SegmentLayer;
      offsetSeconds: number;
      durationSeconds: number;
      moduleId: string;
      moduleKey: string;
      /** Resolved by the composer, so the client never reads a module table. */
      storagePath: string;
      phase: string;
    }
  | {
      kind: 'generated';
      ordinal: number;
      layer: SegmentLayer;
      offsetSeconds: number;
      durationSeconds: number;
      speech: SpeechRequest;
    }
  | {
      kind: 'silence';
      ordinal: number;
      layer: SegmentLayer;
      offsetSeconds: number;
      durationSeconds: number;
      phase: string;
    };

/**
 * The whole session, as references.
 *
 * Note what is absent: any path to a rendered session file. Rule 2 is a
 * property of this shape, not a policy someone has to remember.
 */
export type SessionManifest = {
  transitionKey: string;
  durationSeconds: number;
  recipeVersion: number;
  /** Budget audit. Sum of the generated segments. */
  dynamicSeconds: number;
  segments: ManifestSegment[];
};

export type CompositionFailure =
  | 'no_recipe'
  | 'library_empty'
  | 'phase_unfilled'
  | 'budget_exceeded'
  | 'duration_unreachable';

export type CompositionResult =
  | { ok: true; manifest: SessionManifest }
  | { ok: false; failure: CompositionFailure };

/** Per-person, per-module outcome tally. A count, not a model. */
export type ModuleEffectiveness = {
  moduleId: string;
  positive: number;
  total: number;
};
