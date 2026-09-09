import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { buildTimeline, edgeGain, type CueSource, type Timeline, type TimelineFault } from '@/audio/timeline';
import {
  RESOLVE_GAIN,
  SOUND_LAYER,
  SWEEP_GAIN,
  sweepPointsFor,
  type SoundLayer,
} from '@/audio/sound-layer';
import type { PlaybackStatus } from '@/types/elsea';
import type { SessionManifest } from '@/types/session-engine';

/**
 * The multi-segment session player (Rule 6).
 *
 * Composes the experience on the device from a manifest of references:
 * sequencing, the background bed, ducking, edge fades, composed silence and
 * timing. The server sends what to play and in what order; it never renders a
 * session file.
 *
 * ---------------------------------------------------------------------------
 * AUDIO ASSET REQUIRED — and this player is built to be useful without them.
 *
 * No module audio exists yet. Rather than refuse to run, an unresolvable cue
 * is played as silence OF THE SAME LENGTH. The timeline therefore stays
 * exactly in step whether one file is missing or all of them are, so the whole
 * session — sequencing, phase progression, pause, resume, completion — is
 * genuinely exercisable today, and `missingCues` reports honestly how much of
 * it made no sound. It is not pretending to play anything.
 * ---------------------------------------------------------------------------
 *
 * TWO FOREGROUND PLAYERS, ALTERNATING. While A plays cue N, B is loading cue
 * N+1. A single player calling `replace()` at each boundary would fetch and
 * decode between cues, putting an audible hole in the middle of a regulation
 * exercise. Alternating means the next cue is decoded and ready before the
 * current one ends.
 *
 * INTENT IN STATE, PLAYERS RECONCILED BY EFFECT. Callbacks only set state;
 * a single effect brings the three players into line with it. Written the
 * other way round — handlers reaching in and mutating players directly — it
 * both breaks the React Compiler's rules (this project has it enabled) and
 * makes "what should be playing right now" impossible to answer from one
 * place.
 */

/** Enough to cover the click at a cut, short enough not to soften an entry. */
const FADE_SECONDS = 0.25;

/** How often the timeline is advanced and volumes are re-evaluated. */
const TICK_MS = 200;

/** The bed sits well under the foreground, and further under speech. */
const BED_GAIN = 0.34;
const BED_GAIN_DUCKED = 0.18;

/**
 * Volume and looping, set through a function rather than in place.
 *
 * `expo-audio` exposes these as mutable properties, which is at odds with the
 * React Compiler this project builds with: it will not allow a value returned
 * by a hook to be mutated. Passing the player to a module-scope function says
 * what is actually true — these are handles to native resources, and setting
 * them is a side effect on an external system rather than a change to render
 * state. It also puts the one try/catch each in a single place: a refused
 * volume must never take playback down with it.
 */
function setGain(player: AudioPlayer, value: number): void {
  try {
    player.volume = value;
  } catch {
    // Cosmetic. A player mid-release can refuse this; playback continues.
  }
}

function setLooping(player: AudioPlayer, value: boolean): void {
  try {
    player.loop = value;
  } catch {
    // As above. A bed that fails to loop still plays once.
  }
}

export type ManifestPlayback = {
  status: PlaybackStatus;
  /** Set when the manifest itself is unplayable. Playback never starts. */
  fault: TimelineFault | null;
  elapsedSeconds: number;
  totalSeconds: number;
  isPlaying: boolean;
  finished: boolean;
  /** Which recipe phase is playing, for the session screen. */
  currentPhase: string | null;
  currentCueIndex: number;
  /** How many cues had no resolvable audio and were played as silence. */
  missingCues: number;
  play: () => void;
  pause: () => void;
};

/**
 * Resolves a cue reference to a URL.
 *
 * The one place the manifest's references meet storage. Injectable so the
 * player can be driven in a test without a network.
 */
export type CueResolver = (source: CueSource) => Promise<string | null>;

const defaultResolver: CueResolver = async (source) => {
  // Module audio arrives as a short-lived signed URL, already resolved by the
  // composer. The bucket is private and the client cannot reach it, so there is
  // nothing to look up and no proprietary table to query — the URL is played
  // as given.
  if (source.kind === 'module') return source.storagePath;

  // Generated speech has no audio yet: no provider is wired, so nothing is ever
  // synthesised. When it is, the composer will sign it the same way.
  return null;
};

export function useManifestPlayer(
  manifest: SessionManifest | null,
  resolver: CueResolver = defaultResolver,
  /**
   * The ambient bed and spatial movement. Bundled app assets, never
   * intervention content — see `sound-layer.ts`.
   *
   * Entirely optional. Every field may be null, and a null layer plays the
   * voice-only session the player already knew how to play. Nothing about
   * timing, duration or completion depends on it.
   */
  soundLayer: SoundLayer = SOUND_LAYER
): ManifestPlayback {
  const built = useMemo(() => (manifest ? buildTimeline(manifest) : null), [manifest]);
  const timeline: Timeline | null = built?.ok ? built.timeline : null;
  const fault = built && !built.ok ? built.fault : null;

  const [uris, setUris] = useState<(string | null)[] | null>(null);
  const [bedUri, setBedUri] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // Which player is live is render state, not bookkeeping: the status hook to
  // read and the player to fade both depend on it.
  const [activeIsA, setActiveIsA] = useState(true);
  const [cueIndex, setCueIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);

  // Created empty and driven with `replace`, so the pair persists for the whole
  // session rather than being torn down and rebuilt at every cue boundary.
  const playerA = useAudioPlayer(null);
  const playerB = useAudioPlayer(null);
  const bedPlayer = useAudioPlayer(null);
  /**
   * The spatial layer: one-shot sweeps and the closing resolve.
   *
   * A player of its own, because these OVERLAY the timeline rather than taking
   * a place in it. That is the whole reason spatial effects cannot lengthen a
   * session: the timeline is built from foreground cues alone and remains the
   * only thing that decides when the session ends. A sweep that is still
   * sounding when its cue ends is simply cut with the session, exactly as the
   * bed is.
   */
  const spatialPlayer = useAudioPlayer(null);
  const statusA = useAudioPlayerStatus(playerA);
  const statusB = useAudioPlayerStatus(playerB);

  const activePlayer = activeIsA ? playerA : playerB;
  const idlePlayer = activeIsA ? playerB : playerA;
  const activeStatus = activeIsA ? statusA : statusB;

  /** Which cue the active player has actually been started on. */
  const startedCue = useRef<number | null>(null);
  /** Position within a cue that has no audio to report one. */
  const silenceElapsed = useRef(0);

  // ---- Audio session -----------------------------------------------------
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // A device that refuses the mode still plays; nothing to tell the user.
    });
  }, []);

  // ---- Resolve every cue once, up front ----------------------------------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!timeline) return;
      setResolving(true);

      // Resolved together rather than lazily at each boundary: a cue that has
      // to fetch its own URL when the previous one ends is a cue that starts
      // late, and lateness accumulates across a twenty-minute session.
      const resolved = await Promise.all(timeline.cues.map((cue) => resolver(cue.source)));
      const bed = timeline.bed
        ? await resolver({
            kind: 'module',
            moduleId: timeline.bed.moduleId,
            moduleKey: timeline.bed.moduleKey,
            storagePath: timeline.bed.storagePath,
          })
        : null;

      if (cancelled) return;
      setUris(resolved);
      // A bed carried by the manifest wins: it is approved content chosen for
      // this recipe. The bundled ambient bed is the fallback for when the
      // recipe has none, which today is always, because no bed module exists.
      setBedUri(bed ?? soundLayer.bedUri);
      setResolving(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [timeline, resolver, soundLayer]);

  // ---- Reconcile the players to the intent -------------------------------
  useEffect(() => {
    if (!timeline || !uris) return;

    if (!wantsPlay) {
      // EVERY layer stops, not just the voice. A bed or a sweep still
      // sounding after a pause is the clearest possible sign that pause did
      // not mean what it said.
      for (const player of [playerA, playerB, bedPlayer, spatialPlayer]) {
        try {
          player.pause();
        } catch {
          // Already released.
        }
      }
      return;
    }

    if (bedUri) {
      try {
        bedPlayer.replace({ uri: bedUri });
        setLooping(bedPlayer, true);
        setGain(bedPlayer, BED_GAIN);
        bedPlayer.play();
      } catch {
        // A session without its bed is still a session.
      }
    }

    const uri = uris[cueIndex] ?? null;
    const resuming = startedCue.current === cueIndex;

    try {
      idlePlayer.pause();

      if (resuming) {
        // Position is already held: audio keeps its own `currentTime`, and a
        // silent cue keeps its accumulator, so resuming must not seek.
        if (uri) activePlayer.play();
      } else {
        silenceElapsed.current = 0;
        if (uri) {
          activePlayer.replace({ uri });
          setGain(activePlayer, 0);
          activePlayer.seekTo(0);
          activePlayer.play();
        }
        startedCue.current = cueIndex;
      }
    } catch {
      // A player that refuses its source leaves the cue silent, which the
      // timeline already accounts for.
      startedCue.current = cueIndex;
    }

    // Preload the next cue into the player that is not in use.
    const nextUri = uris[cueIndex + 1] ?? null;
    if (nextUri) {
      try {
        idlePlayer.replace({ uri: nextUri });
      } catch {
        // It will simply load late, or play as silence.
      }
    }
  }, [
    wantsPlay,
    cueIndex,
    timeline,
    uris,
    bedUri,
    activePlayer,
    idlePlayer,
    playerA,
    playerB,
    bedPlayer,
    spatialPlayer,
  ]);

  // ---- The tick: position, volumes, and advancing ------------------------
  useEffect(() => {
    if (!wantsPlay || !timeline || !uris) return;

    const id = setInterval(() => {
      const cue = timeline.cues[cueIndex];
      if (!cue) return;

      const hasAudio = uris[cueIndex] != null;

      if (!hasAudio) {
        silenceElapsed.current = Math.min(
          silenceElapsed.current + TICK_MS / 1000,
          cue.durationSeconds
        );
      }

      const positionInCue = hasAudio
        ? Math.min(activeStatus?.currentTime ?? 0, cue.durationSeconds)
        : silenceElapsed.current;

      setElapsed(Math.min(cue.startsAt + positionInCue, timeline.totalSeconds));

      if (hasAudio) {
        setGain(activePlayer, edgeGain(positionInCue, cue.durationSeconds, FADE_SECONDS));
      }

      // The bed ducks under generated speech, which is the most important
      // thing the person hears in the session.
      setGain(bedPlayer, cue.source.kind === 'generated' ? BED_GAIN_DUCKED : BED_GAIN);

      // Advance on whichever signal this cue has: the file finishing, or its
      // composed length elapsing. The length is also the backstop for a file
      // that is shorter than the manifest claims.
      const finishedAudio = hasAudio && (activeStatus?.didJustFinish ?? false);
      if (finishedAudio || positionInCue >= cue.durationSeconds) {
        if (cueIndex + 1 >= timeline.cues.length) {
          setElapsed(timeline.totalSeconds);
          setWantsPlay(false);
        } else {
          setCueIndex(cueIndex + 1);
          setActiveIsA((current) => !current);
        }
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [wantsPlay, timeline, uris, cueIndex, activeStatus, activePlayer, bedPlayer]);

  // ---- The spatial layer --------------------------------------------------
  //
  // Fire-and-forget, and deliberately so. Nothing below reads back from this
  // player, waits on it, or lets it influence `elapsed`, `cueIndex` or when the
  // session ends. It is an overlay: if it fails, is missing, or is still
  // sounding when the session finishes, the session is unaffected.
  const sweepPoints = useMemo(
    () => (timeline ? sweepPointsFor(timeline) : []),
    [timeline]
  );

  useEffect(() => {
    if (!wantsPlay || !soundLayer.sweepUri) return;
    if (!sweepPoints.includes(cueIndex)) return;

    try {
      spatialPlayer.replace({ uri: soundLayer.sweepUri });
      setGain(spatialPlayer, SWEEP_GAIN);
      spatialPlayer.seekTo(0);
      spatialPlayer.play();
    } catch {
      // A session without its sweep is still a session.
    }
    // Keyed on the cue, so a sweep fires once when a phase opens rather than on
    // every tick within it.
  }, [wantsPlay, cueIndex, sweepPoints, soundLayer.sweepUri, spatialPlayer]);

  /**
   * Whether the closing resolve has already sounded.
   *
   * A ref rather than state on purpose: nothing renders differently because of
   * it, and setting state inside this effect would cascade a render for a fact
   * only the effect cares about. Read and written inside the effect only, never
   * during render.
   */
  const resolvePlayed = useRef(false);
  const reachedEnd = timeline !== null && elapsed >= timeline.totalSeconds;

  useEffect(() => {
    if (!reachedEnd || resolvePlayed.current) return;
    resolvePlayed.current = true;

    if (!soundLayer.resolveUri) return;
    try {
      spatialPlayer.replace({ uri: soundLayer.resolveUri });
      setGain(spatialPlayer, RESOLVE_GAIN);
      spatialPlayer.seekTo(0);
      spatialPlayer.play();
    } catch {
      // As above.
    }
  }, [reachedEnd, soundLayer.resolveUri, spatialPlayer]);

  // ---- Interruptions ------------------------------------------------------
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // Backgrounding pauses rather than abandons, so the position is kept.
      // The reconciling effect above does the actual pausing.
      if (next !== 'active') setWantsPlay(false);
    });
    return () => subscription.remove();
  }, []);

  // ---- Cleanup ------------------------------------------------------------
  useEffect(() => {
    return () => {
      // Leaving the screen must never leave a bed or a sweep playing behind
      // it. Early exit reaches here by unmounting the session screen.
      for (const player of [playerA, playerB, bedPlayer, spatialPlayer]) {
        try {
          player.pause();
        } catch {
          // Already released.
        }
      }
    };
  }, [playerA, playerB, bedPlayer, spatialPlayer]);

  const play = useCallback(() => {
    if (!timeline || resolving || fault) return;
    setWantsPlay(true);
  }, [timeline, resolving, fault]);

  const pause = useCallback(() => setWantsPlay(false), []);

  const totalSeconds = timeline?.totalSeconds ?? 0;
  const finished = totalSeconds > 0 && elapsed >= totalSeconds;
  const missingCues = uris ? uris.filter((u) => u === null).length : 0;

  const status: PlaybackStatus = fault
    ? 'failed'
    : resolving
      ? 'loading'
      : finished
        ? 'ended'
        : wantsPlay
          ? 'playing'
          : elapsed > 0
            ? 'paused'
            : 'idle';

  const currentPhase = timeline?.cues[cueIndex]?.phase ?? null;

  // Memoised so consumers can depend on this object directly. A hook that
  // returns a fresh literal every render silently churns the dependencies of
  // every effect and callback downstream of it.
  return useMemo(
    () => ({
      status,
      fault,
      elapsedSeconds: elapsed,
      totalSeconds,
      isPlaying: wantsPlay,
      finished,
      currentPhase,
      currentCueIndex: cueIndex,
      missingCues,
      play,
      pause,
    }),
    [
      status,
      fault,
      elapsed,
      totalSeconds,
      wantsPlay,
      finished,
      currentPhase,
      cueIndex,
      missingCues,
      play,
      pause,
    ]
  );
}
