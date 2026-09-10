import { getSupabase } from '@/lib/supabase';
import type { VoiceProfileId } from '@/lib/voice-preference';
import type { TransitionKey } from '@/types/elsea';
import type {
  CompositionFailure,
  CompositionResult,
  ManifestSegment,
  SessionManifest,
} from '@/types/session-engine';

/**
 * Asking the server to compose a session.
 *
 * WHAT MOVED, AND WHY. Composition used to happen here, on the device, by
 * reading `recipe_phases` and the module tables with the public anon key.
 * That exposed the five recipes and their eligibility rules — ELSEA's
 * proprietary product intelligence — to anyone who pulled the key out of the
 * app bundle. Those tables are now service-role only, and the decision is made
 * in the `compose` Edge Function.
 *
 * Profitability rule 6 is unchanged: PLAYBACK composition is still client-side,
 * in `use-manifest-player.ts`. It is the DECISION that is server-side.
 *
 * This module is now transport and shape-mapping only. It contains no product
 * logic, which is the point — there is nothing here worth reverse-engineering.
 */

/** The wire shape. Deliberately explicit rather than a structural cast. */
type WireSegment = {
  kind: 'module' | 'generated' | 'silence';
  ordinal: number;
  layer: 'foreground' | 'bed';
  offset_seconds: number;
  duration_seconds: number;
  module_id?: string;
  module_key?: string;
  audio_url?: string | null;
  phase?: string;
};

type WireResponse =
  | {
      ok: true;
      manifest: {
        manifest_id: string | null;
        transition_key: string;
        duration_seconds: number;
        recipe_version: number;
        dynamic_seconds: number;
        segments: WireSegment[];
      };
    }
  | { ok: false; failure: string };

const FAILURES: CompositionFailure[] = [
  'no_recipe',
  'library_empty',
  'phase_unfilled',
  'budget_exceeded',
  'duration_unreachable',
];

function asFailure(value: string): CompositionFailure {
  return (FAILURES as string[]).includes(value)
    ? (value as CompositionFailure)
    : 'library_empty';
}

/**
 * Maps a wire segment onto the domain type.
 *
 * Returns null for anything malformed rather than coercing it. A segment that
 * arrives without the fields its kind requires would otherwise become a cue
 * the player cannot resolve, and the failure would surface much later as
 * silence nobody can explain.
 */
function toSegment(wire: WireSegment): ManifestSegment | null {
  const base = {
    ordinal: wire.ordinal,
    layer: wire.layer,
    offsetSeconds: wire.offset_seconds,
    durationSeconds: wire.duration_seconds,
  };

  if (wire.kind === 'module') {
    // A module segment without a playable URL is not playable. Refused rather
    // than coerced: it would otherwise become a cue the player renders as
    // silence, and the cause would surface much later as a session with holes.
    if (!wire.module_id || !wire.module_key || !wire.audio_url) return null;
    return {
      ...base,
      kind: 'module',
      moduleId: wire.module_id,
      moduleKey: wire.module_key,
      storagePath: wire.audio_url,
      phase: wire.phase ?? '',
    };
  }

  if (wire.kind === 'silence') {
    return { ...base, kind: 'silence', phase: wire.phase ?? '' };
  }

  // Generated speech is not produced yet. When it is, it arrives with its own
  // resolved path and this is where it will be mapped.
  return null;
}

export async function loadComposition(
  transitionKey: TransitionKey,
  durationSeconds: number,
  _userId: string | null,
  /**
   * The narration voice to prefer.
   *
   * Passed as a hint only. For a signed-in person the composer reads their
   * saved preference and that wins — a stale client must not override what
   * somebody actually chose. This matters for the signed-out case and for the
   * moment just after choosing, before the write has landed.
   */
  voiceProfile?: VoiceProfileId
): Promise<CompositionResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, failure: 'library_empty' };

  try {
    // The person's identity travels in the session token that supabase-js
    // attaches, never in the body. A caller must not be able to compose using
    // somebody else's effectiveness history by naming them.
    const { data, error } = await supabase.functions.invoke<WireResponse>('compose', {
      body: {
        transition_key: transitionKey,
        duration_seconds: durationSeconds,
        ...(voiceProfile ? { voice_profile: voiceProfile } : {}),
      },
    });

    if (error || !data) return { ok: false, failure: 'library_empty' };
    if (!data.ok) return { ok: false, failure: asFailure(data.failure) };

    const segments = data.manifest.segments
      .map(toSegment)
      .filter((s): s is ManifestSegment => s !== null);

    // A manifest missing segments is not a manifest. Falling back to the
    // catalogue is far better than playing a session with holes in it.
    if (segments.length !== data.manifest.segments.length) {
      return { ok: false, failure: 'library_empty' };
    }

    const manifest: SessionManifest = {
      id: data.manifest.manifest_id ?? null,
      transitionKey: data.manifest.transition_key as TransitionKey,
      durationSeconds: data.manifest.duration_seconds,
      recipeVersion: data.manifest.recipe_version,
      dynamicSeconds: data.manifest.dynamic_seconds,
      segments,
    };

    return { ok: true, manifest };
  } catch {
    // A failure to reach the composer is not a failure to compose, but the
    // caller only needs to know it cannot use the engine path.
    return { ok: false, failure: 'library_empty' };
  }
}
