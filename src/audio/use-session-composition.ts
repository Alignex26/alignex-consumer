import { useEffect, useState } from 'react';

import { loadComposition } from '@/lib/composition';
import { DEFAULT_VOICE, loadVoicePreference } from '@/lib/voice-preference';
import type { Interpretation } from '@/types/elsea';
import type { CompositionFailure, SessionManifest } from '@/types/session-engine';

/**
 * Attempts to compose a session for this person, once.
 *
 * Returns a manifest only when the engine can produce a complete one. Anything
 * less — no recipe, no modules, a phase nothing fits — yields null and the
 * caller stays on the catalogue path. There is no partial manifest: half a
 * composed session is worse than a whole catalogue one.
 *
 * `failure` is kept rather than discarded so the reason is visible in
 * development. It is never shown to a person: "library_empty" is not something
 * anyone should have to read.
 */
export type SessionComposition = {
  manifest: SessionManifest | null;
  failure: CompositionFailure | null;
  /** True until the attempt has finished, so the caller does not start early. */
  loading: boolean;
};

export function useSessionComposition(
  interpretation: Interpretation | null,
  durationSeconds: number,
  userId: string | null
): SessionComposition {
  const [state, setState] = useState<SessionComposition>({
    manifest: null,
    failure: null,
    loading: true,
  });

  const transitionKey = interpretation?.transitionKey ?? null;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!transitionKey || durationSeconds <= 0) {
        setState({ manifest: null, failure: null, loading: false });
        return;
      }

      // The saved voice, read before composing. A failure here resolves to the
      // default rather than propagating: a preference that cannot be read must
      // not stop a session starting.
      const voice = await loadVoicePreference(userId).catch(() => DEFAULT_VOICE);
      if (cancelled) return;

      const result = await loadComposition(transitionKey, durationSeconds, userId, voice);
      if (cancelled) return;

      if (result.ok) {
        setState({ manifest: result.manifest, failure: null, loading: false });
      } else {
        if (__DEV__) {
          console.warn(
            `[ELSEA] Session engine unavailable (${result.failure}); using the catalogue path.`
          );
        }
        setState({ manifest: null, failure: result.failure, loading: false });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [transitionKey, durationSeconds, userId]);

  return state;
}
