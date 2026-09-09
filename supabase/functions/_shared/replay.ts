// supabase/functions/_shared/replay.ts
//
// The two intents behind "give me that session again".
//
//   EXACT REPLAY — "give me the session I saved." Same modules, same versions,
//   same order. Novelty penalties are bypassed because the repetition is the
//   point.
//
//   REUSE THIS — "I liked that; use it as the basis." Same recipe and duration,
//   composed fresh under normal rules, so a later dynamic opening can be new
//   and a withdrawn module simply gets replaced.
//
// They are separate functions on purpose. Collapsing them into one with a flag
// is how an exact replay quietly becomes an approximate one.
//
// SERVER-SIDE ONLY. Dependency-free.

import type { ManifestSegment, SessionManifest } from './types.ts';

/** One module version, exactly as it was when saved. */
export type SavedModuleVersion = {
  moduleVersionId: string;
  moduleId: string;
  moduleKey: string;
  version: number;
  storagePath: string;
  durationSeconds: number;
  /** Set when this version is no longer servable. */
  withdrawnAt: string | null;
  /** The CURRENT approval state of the module this version belongs to. */
  moduleApproved: boolean;
  moduleActive: boolean;
};

export type SavedSession = {
  id: string;
  userId: string;
  manifestId: string;
  transitionKey: string;
  durationSeconds: number;
  fingerprint: string;
  moduleVersionIds: string[];
};

export type ReplayFailure =
  /** A saved module version has been withdrawn or its module de-approved. */
  | 'content_withdrawn'
  /** A saved version no longer exists at all. */
  | 'content_missing'
  /** The saved manifest could not be read. */
  | 'manifest_missing'
  /** Audio could not be signed for one or more segments. */
  | 'audio_unavailable';

export type ReplayResult =
  | { ok: true; manifest: SessionManifest }
  | { ok: false; failure: ReplayFailure; withdrawn?: string[] };

/**
 * Rebuilds the saved manifest from its stored version identities.
 *
 * APPROVAL IS NOT BYPASSED. Intentional replay overrides novelty, never the
 * clinical gate. If any saved version has been withdrawn, or the module it
 * belongs to is no longer approved or active, this fails explicitly and names
 * what went. It never substitutes another module and calls the result exact —
 * that would be a quiet lie about the one thing the feature promises.
 *
 * Signed URLs are not stored and not reproduced here. The caller signs the
 * returned storage paths afresh, exactly as it does for a new composition.
 */
export function rebuildExact(
  saved: SavedSession,
  versions: readonly SavedModuleVersion[],
  savedSegments: readonly ManifestSegment[]
): ReplayResult {
  const byId = new Map(versions.map((v) => [v.moduleVersionId, v]));

  const missing = saved.moduleVersionIds.filter((id) => !byId.has(id));
  if (missing.length > 0) return { ok: false, failure: 'content_missing' };

  const withdrawn = saved.moduleVersionIds
    .map((id) => byId.get(id))
    .filter((v): v is SavedModuleVersion =>
      v !== undefined && (v.withdrawnAt !== null || !v.moduleApproved || !v.moduleActive)
    )
    .map((v) => v.moduleKey);

  if (withdrawn.length > 0) {
    return { ok: false, failure: 'content_withdrawn', withdrawn };
  }

  if (savedSegments.length === 0) return { ok: false, failure: 'manifest_missing' };

  // Rebuild with the SAVED storage paths, not whatever the module row points at
  // now. That distinction is the whole of "exact".
  let cursor = 0;
  const usedVersions = saved.moduleVersionIds.map((id) => byId.get(id)!);

  const segments: ManifestSegment[] = savedSegments.map((segment) => {
    if (segment.kind !== 'module' || segment.layer !== 'foreground') return segment;
    const version = usedVersions[cursor++];
    if (!version) return segment;
    return {
      ...segment,
      moduleId: version.moduleId,
      moduleKey: version.moduleKey,
      storagePath: version.storagePath,
      durationSeconds: version.durationSeconds,
    };
  });

  return {
    ok: true,
    manifest: {
      id: null,
      transitionKey: saved.transitionKey,
      durationSeconds: saved.durationSeconds,
      recipeVersion: 1,
      dynamicSeconds: 0,
      segments,
    },
  };
}

/**
 * The inputs a "reuse this" composition needs.
 *
 * It deliberately carries only the *intent* — which transition, how long — and
 * lets the ordinary composer do the rest under normal rules. That is what
 * makes it different from an exact replay: withdrawn content is replaced
 * rather than fatal, effectiveness still applies, and a dynamic opening can be
 * new when one exists.
 *
 * Novelty is NOT bypassed here. Someone reusing a session shape still deserves
 * a fresh arrangement of it; if they wanted the identical thing they would
 * have asked for the exact replay.
 */
export function reuseIntent(saved: SavedSession): {
  transitionKey: string;
  durationSeconds: number;
} {
  return {
    transitionKey: saved.transitionKey,
    durationSeconds: saved.durationSeconds,
  };
}
