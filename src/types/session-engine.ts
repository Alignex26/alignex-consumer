import type { StateCurrent, StateTarget, TransitionKey } from '@/types/elsea';

/**
 * ELSEA Session Engine types, for the client.
 *
 * TYPE-ONLY RE-EXPORTS, ON PURPOSE. The definitions live server-side in
 * `supabase/functions/_shared/types.ts`, because that is where the decision
 * engine lives and it cannot import from `src/`. Re-exporting them as types
 * means one definition and, critically, NOTHING IN THE BUNDLE: `export type`
 * is erased by babel, so no runtime module is pulled in behind it.
 *
 * Do not turn any of these into a value re-export. `export { MODULE_FAMILIES }`
 * would silently drag the allocator, the recipes vocabulary and the speech
 * budget into the app the moment one screen imported this file for a value.
 * `src/__tests__/recipes.test.ts` fails if any file under `src/` imports
 * `_shared` at runtime.
 */
export type {
  CompositionFailure,
  CompositionResult,
  InterventionModule,
  ManifestSegment,
  ModuleEffectiveness,
  ModuleFamily,
  RecipePhase,
  SegmentLayer,
  SessionManifest,
  SpeechRequest,
  SpeechSlot,
} from '../../supabase/functions/_shared/types';

/**
 * The structured facts a dynamic line may be built from, narrowed to this
 * app's closed vocabularies.
 *
 * The shared type keeps these as strings because Deno has no access to the
 * app's unions; the client can be stricter, and is.
 */
export type SpeechContext = {
  slot: import('../../supabase/functions/_shared/types').SpeechSlot;
  transitionKey: TransitionKey;
  stateCurrent: StateCurrent;
  stateTarget: StateTarget;
  /** A closed tag from the interpreter, never free text. */
  contextTag: string | null;
  intensity: number;
};
