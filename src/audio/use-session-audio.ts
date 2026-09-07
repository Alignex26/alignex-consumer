import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadSegments } from '@/lib/catalogue';
import { getSupabase } from '@/lib/supabase';
import type { CatalogueSession, PlaybackStatus } from '@/types/elsea';

/**
 * The session audio engine.
 *
 * Built on `expo-audio`, which is already a dependency and works in Expo Go —
 * no new native module, so the physical-iPhone development workflow is
 * unaffected.
 *
 * ---------------------------------------------------------------------------
 * AUDIO ASSET REQUIRED
 *
 * The seeded catalogue points at storage paths ('sessions/<key>_<seconds>.m4a')
 * that no audio has been produced for, and there is no local fixture track in
 * the repository either. Sourcing something to stand in for it would mean
 * shipping audio nobody approved, so this does not do that.
 *
 * What it does instead: it resolves the real path, tries to load it, and when
 * there is nothing there it reports `assetMissing` and runs the session as a
 * timed experience with no sound. That keeps the whole flow — start, pause,
 * resume, complete, early exit, outcome — genuinely exercisable, while the
 * screen states plainly that there is no audio. It is not pretending to play
 * anything.
 * ---------------------------------------------------------------------------
 */

type SessionAudio = {
  status: PlaybackStatus;
  /** True when the catalogue has no playable asset. Surfaced in the UI. */
  assetMissing: boolean;
  /** Seconds elapsed. Drives progress whether or not there is audio. */
  elapsedSeconds: number;
  /** Total, from the catalogue rather than the file, so it is known up front. */
  durationSeconds: number;
  isPlaying: boolean;
  /** True once the session has run its full length. */
  finished: boolean;
  play: () => void;
  pause: () => void;
};

/**
 * Turns a stored path into a URL.
 *
 * The seeded paths are 'sessions/<file>'. The first segment is treated as the
 * bucket and the rest as the object key, which is the convention the seed
 * implies. If that bucket does not exist the fetch below fails and we fall
 * through to `assetMissing`, which is the correct outcome either way.
 */
async function resolveUri(storagePath: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const slash = storagePath.indexOf('/');
  if (slash <= 0) return null;

  const bucket = storagePath.slice(0, slash);
  const key = storagePath.slice(slash + 1);

  try {
    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    const url = data?.publicUrl;
    if (!url) return null;

    // Confirm something is actually there before handing it to the player:
    // a 404 body would otherwise surface as an opaque decode failure.
    const head = await fetch(url, { method: 'HEAD' });
    return head.ok ? url : null;
  } catch {
    return null;
  }
}

export function useSessionAudio(session: CatalogueSession | null): SessionAudio {
  const durationSeconds = session?.durationSeconds ?? 0;

  const [uri, setUri] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const [assetMissing, setAssetMissing] = useState(false);

  // The clock for the silent case, and the source of truth for elapsed time
  // when there is no player to ask.
  const [silentElapsed, setSilentElapsed] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);

  const player = useAudioPlayer(uri ? { uri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  // ---- Resolve the asset -------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      if (!session) return;
      setResolving(true);

      const segments = await loadSegments(session.id);
      if (cancelled) return;

      // V1 catalogue sessions have a single segment. If that changes, this is
      // where sequencing would go.
      const first = segments[0];
      if (!first) {
        setAssetMissing(true);
        setResolving(false);
        return;
      }

      const resolved = await resolveUri(first.storagePath);
      if (cancelled) return;

      setUri(resolved);
      setAssetMissing(resolved === null);
      setResolving(false);
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // ---- Audio session configuration ---------------------------------------
  useEffect(() => {
    // Sessions are the point of the product, so they should keep playing when
    // the phone is on silent, and should not fight other audio for focus more
    // than they need to.
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // A device that refuses the mode still plays; nothing to tell the user.
    });
  }, []);

  // ---- The silent clock --------------------------------------------------
  useEffect(() => {
    if (!wantsPlay || !assetMissing) return;

    const id = setInterval(() => {
      setSilentElapsed((seconds) => Math.min(seconds + 1, durationSeconds));
    }, 1000);

    return () => clearInterval(id);
  }, [wantsPlay, assetMissing, durationSeconds]);

  // ---- Interruptions -----------------------------------------------------
  const wasPlaying = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      // Going to the background pauses rather than abandons, so the position
      // is kept and the person can pick the session back up.
      wasPlaying.current = wantsPlay;
      if (wantsPlay) {
        setWantsPlay(false);
        if (!assetMissing) player.pause();
      }
    });
    return () => subscription.remove();
  }, [wantsPlay, assetMissing, player]);

  // ---- Cleanup -----------------------------------------------------------
  useEffect(() => {
    return () => {
      // Leaving the screen must never leave audio running behind it.
      try {
        player.pause();
      } catch {
        // The player may already be released; nothing to do.
      }
    };
  }, [player]);

  const play = useCallback(() => {
    setWantsPlay(true);
    if (!assetMissing) player.play();
  }, [assetMissing, player]);

  const pause = useCallback(() => {
    setWantsPlay(false);
    if (!assetMissing) player.pause();
  }, [assetMissing, player]);

  const elapsedSeconds = assetMissing
    ? silentElapsed
    : Math.min(playerStatus?.currentTime ?? 0, durationSeconds);

  const finished = durationSeconds > 0 && elapsedSeconds >= durationSeconds;

  const status: PlaybackStatus = resolving
    ? 'loading'
    : finished
      ? 'ended'
      : wantsPlay
        ? 'playing'
        : elapsedSeconds > 0
          ? 'paused'
          : 'idle';

  return {
    status,
    assetMissing,
    elapsedSeconds,
    durationSeconds,
    isPlaying: wantsPlay,
    finished,
    play,
    pause,
  };
}
