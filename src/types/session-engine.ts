import type { StateCurrent, StateTarget, TransitionKey } from '@/types/elsea';

/**
 * ELSEA Session Engine types.
 *
 * Sessions are composed, never stored whole. See docs/session-engine.md.
 *
 * The distinction that matters throughout: a MODULE is library content owned
 * by no session and reusable by everyone, while a GENERATED segment is speech
 * made for one moment and charged per character. The type system keeps them
 * apart so a change can never quietly move cost from the first into the second.
 */

/**
 * The twelve approved product-level families.
 *
 * Re-exported from the shared allocator rather than restated, so the app, the
 * server-side composer and the tests all read one list. Canonical form is
 * lower case, like every other identifier in the schema; upper case is a
 * display treatment only and never reaches the database or the domain model.
 *
 * `bed` is not a family. A bed is a LAYER, marked by `isBed`, and still
 * belongs to one of the twelve.
 */
import type { ModuleFamily } from '../../supabase/functions/_shared/allocate';

export { MODULE_FAMILIES, type ModuleFamily } from '../../supabase/functions/_shared/allocate';

/** A reusable piece of library audio. Generated or produced once, played forever. */
export type InterventionModule = {
  id: string;
  moduleKey: string;
  family: ModuleFamily;
  /** A taxonomy slot. The clinical content filling it is approved elsewhere. */
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
 * `isProvisional` carries S14 forward: the drafted floors are provisional
 * pending clinical review. Code that treats a provisional floor as settled is
 * a bug, so the flag travels with the data rather than living in a comment.
 */
export type RecipePhase = {
  transitionKey: TransitionKey;
  ordinal: number;
  phase: string;
  minSeconds: number;
  maxSeconds: number;
  isProvisional: boolean;
};

export type SegmentLayer = 'foreground' | 'bed';

/** Where dynamic speech is allowed to appear. Deliberately only two places. */
export const SPEECH_SLOTS = ['opening', 'closing'] as const;
export type SpeechSlot = (typeof SPEECH_SLOTS)[number];

/**
 * A request for dynamic speech.
 *
 * `text` is built from STRUCTURED STATE only — never from what the person
 * wrote. That is S3, and it is also what keeps the situation cache from
 * becoming a store of user writing.
 *
 * `cacheKey` is derived, never supplied, for the same reason.
 */
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
      /**
       * Resolved by the server-side composer, so the client never reads
       * `intervention_modules` — that table is proprietary and service-role
       * only.
       */
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
      /** Which phase the silence belongs to, so it is never a mystery gap. */
      phase: string;
    };

/**
 * The whole session, as references.
 *
 * Note what is absent: any path to a rendered session file. Rule 2 is a
 * property of this shape, not a policy someone has to remember.
 */
export type SessionManifest = {
  transitionKey: TransitionKey;
  durationSeconds: number;
  recipeVersion: number;
  /** Budget audit. Sum of the generated segments, recorded so drift is visible. */
  dynamicSeconds: number;
  segments: ManifestSegment[];
};

export type CompositionFailure =
  /** The transition has no phase structure. */
  | 'no_recipe'
  /** No approved, active modules for this transition. Expected until content lands. */
  | 'library_empty'
  /** A phase has no module short enough to fill it. */
  | 'phase_unfilled'
  /** Dynamic speech exceeded the ceiling. Rejected, never trimmed silently. */
  | 'budget_exceeded'
  /** The requested duration cannot satisfy the recipe's floors. */
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

/**
 * The structured facts a dynamic line may be built from.
 *
 * This is the complete set. There is no field for what the person wrote, which
 * is the point: the type makes the S3 boundary unforgeable rather than relying
 * on a caller to remember it.
 */
export type SpeechContext = {
  slot: SpeechSlot;
  transitionKey: TransitionKey;
  stateCurrent: StateCurrent;
  stateTarget: StateTarget;
  /** A closed tag from the interpreter, never free text. */
  contextTag: string | null;
  intensity: number;
};
