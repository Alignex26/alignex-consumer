import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ElseaConversationField } from '@/components/elsea/elsea-conversation-field';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaSessionOrb } from '@/components/elsea/elsea-session-orb';
import { ElseaTextAction } from '@/components/elsea/elsea-text-action';
import { SessionCopy, TRANSITION_LABEL } from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color, ElseaSize } from '@/constants/elsea';
import { useFlowGuard } from '@/flow/use-flow-guard';
import { useManifestPlayer } from '@/audio/use-manifest-player';
import { useSessionAudio } from '@/audio/use-session-audio';
import { useSessionComposition } from '@/audio/use-session-composition';
import { useElseaLayout } from '@/layout/use-elsea-layout';
import { track, trackScreen } from '@/lib/analytics';
import { finishRun, startRun } from '@/lib/runs';
import { replaceWith } from '@/navigation/elsea-routes';
import { useAuth } from '@/state/auth';
import { useSessionFlow } from '@/state/session-flow';

const C = ElseaS02Color;

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * SCREEN 09 — ACTIVE SESSION, and with it Screens 10 (paused) and 11 (early
 * exit).
 *
 * Paused is a state of this screen, not another screen: the form settles, the
 * control becomes Resume, and the position is kept. Early exit is a
 * confirmation presented over it. Splitting either into its own route would
 * turn one continuous experience into three.
 *
 * The run is created once, on entry, and closed exactly once — `closing` guards
 * against a completion and an early exit both trying to end it.
 */
export default function SessionScreen() {
  const ready = useFlowGuard('session');
  const { insets, screenWidth } = useElseaLayout();
  const { userId } = useAuth();
  const { interpretation, selectedSession, run, setRun } = useSessionFlow();

  // ---- Which engine plays this session ------------------------------------
  //
  // The catalogue is still the live path. The composition engine sits behind
  // it and takes over only when it can produce a COMPLETE manifest — today it
  // never can, because `recipe_phases` and `intervention_modules` are empty,
  // so every session falls back and nothing changes. It starts serving real
  // sessions the moment the recipes and modules land, with no code change.
  //
  // Both hooks are called unconditionally, because hooks must be, and the
  // unused one is handed null so it stays inert rather than loading anything.
  const composition = useSessionComposition(
    interpretation,
    selectedSession?.durationSeconds ?? 0,
    userId
  );
  const composed = useManifestPlayer(composition.manifest);
  const catalogue = useSessionAudio(composition.manifest ? null : selectedSession);

  // One shape, so nothing below has to know which engine is playing. The two
  // differ in what they can report: the catalogue engine knows only whether
  // its single asset was there, the composed one knows how many of its cues
  // were. Both reduce to the same question for the person — is this running
  // with no sound.
  const audio = useMemo(
    () =>
      composition.manifest
        ? {
            status: composed.status,
            elapsedSeconds: composed.elapsedSeconds,
            durationSeconds: composed.totalSeconds,
            isPlaying: composed.isPlaying,
            finished: composed.finished,
            silent: composed.missingCues > 0,
            play: composed.play,
            pause: composed.pause,
          }
        : {
            status: catalogue.status,
            elapsedSeconds: catalogue.elapsedSeconds,
            durationSeconds: catalogue.durationSeconds,
            isPlaying: catalogue.isPlaying,
            finished: catalogue.finished,
            silent: catalogue.assetMissing,
            play: catalogue.play,
            pause: catalogue.pause,
          },
    [composition.manifest, composed, catalogue]
  );

  const [confirmingExit, setConfirmingExit] = useState(false);

  const createdRun = useRef(false);
  const closing = useRef(false);

  useEffect(() => {
    trackScreen('session_active');
  }, []);

  // ---- Create the run, once ----------------------------------------------
  useEffect(() => {
    if (!ready || createdRun.current || !selectedSession || !interpretation) return;
    createdRun.current = true;

    void startRun(selectedSession, interpretation, userId).then((created) => {
      setRun(created);
      track({
        name: 'session_started',
        transition: interpretation.transitionKey,
        durationSeconds: selectedSession.durationSeconds,
        origin: interpretation.origin,
      });
    });
  }, [ready, selectedSession, interpretation, userId, setRun]);

  // ---- Start playing once there is something to play ----------------------
  const started = useRef(false);
  useEffect(() => {
    if (started.current || composition.loading || audio.status === 'loading' || !ready) return;
    started.current = true;
    audio.play();
  }, [audio, ready, composition.loading]);

  const close = useCallback(
    async (status: 'completed' | 'ended_early') => {
      if (closing.current || !run) return;
      closing.current = true;

      audio.pause();
      const closed = await finishRun(run, status, audio.elapsedSeconds);
      setRun(closed);

      if (status === 'completed' && interpretation && selectedSession) {
        track({
          name: 'session_completed',
          transition: interpretation.transitionKey,
          durationSeconds: selectedSession.durationSeconds,
        });
        replaceWith('arrivalResult');
      } else {
        track({
          name: 'session_ended_early',
          elapsedSeconds: Math.round(audio.elapsedSeconds),
          durationSeconds: audio.durationSeconds,
        });
        // An early exit is a measurement, not a failure: it still goes to the
        // outcome question rather than being thrown away.
        replaceWith('outcome');
      }
    },
    [run, audio, setRun, interpretation, selectedSession]
  );

  // ---- Natural completion -------------------------------------------------
  useEffect(() => {
    if (audio.finished && run && !closing.current) {
      void close('completed');
    }
  }, [audio.finished, run, close]);

  if (!ready || !selectedSession || !interpretation) return null;

  const progress =
    audio.durationSeconds > 0 ? Math.min(audio.elapsedSeconds / audio.durationSeconds, 1) : 0;

  const orbSize = Math.min(screenWidth * 0.72, 300);

  const togglePlay = () => {
    if (audio.isPlaying) {
      audio.pause();
      track({ name: 'session_paused', elapsedSeconds: Math.round(audio.elapsedSeconds) });
    } else {
      audio.play();
      track({ name: 'session_resumed', elapsedSeconds: Math.round(audio.elapsedSeconds) });
    }
  };

  return (
    <View style={styles.root}>
      <ElseaConversationField />
      <StatusBar style="light" />

      <View style={[styles.body, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Text style={styles.context} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            {TRANSITION_LABEL[interpretation.transitionKey]}
          </Text>
          {audio.silent ? (
            <Text style={styles.assetNotice} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
              AUDIO ASSET REQUIRED — running as a timed session with no sound.
            </Text>
          ) : null}
        </View>

        <View style={styles.stage}>
          <ElseaSessionOrb size={orbSize} active={audio.isPlaying} />
        </View>

        <View style={styles.controls}>
          {/* Progress. A plain track, not a waveform. */}
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: Math.round(audio.durationSeconds),
              now: Math.round(audio.elapsedSeconds),
            }}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.times}>
            <Text style={styles.time}>{clock(audio.elapsedSeconds)}</Text>
            <Text style={styles.time}>{clock(audio.durationSeconds)}</Text>
          </View>

          <View style={styles.actions}>
            <ElseaFlowAction
              label={audio.isPlaying ? SessionCopy.pause : SessionCopy.resume}
              onPress={togglePlay}
            />
            <View style={styles.end}>
              <ElseaTextAction
                label={SessionCopy.end}
                onPress={() => setConfirmingExit(true)}
                accessibilityHint="Asks whether you want to finish early."
              />
            </View>
          </View>
        </View>
      </View>

      {/* SCREEN 11 — early exit. Presented over the session, so the session is
          still there behind it and nothing has been lost yet. */}
      {confirmingExit ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.sheetHeading} maxFontSizeMultiplier={ElseaFontScaleCap.heading}>
              {SessionCopy.exitHeading}
            </Text>
            <Text style={styles.sheetSupporting} maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
              {SessionCopy.exitSupporting}
            </Text>

            <View style={styles.sheetActions}>
              <ElseaFlowAction
                label={SessionCopy.exitKeepGoing}
                onPress={() => setConfirmingExit(false)}
              />
              <View style={styles.end}>
                <ElseaTextAction
                  label={SessionCopy.exitConfirm}
                  onPress={() => void close('ended_early')}
                />
              </View>
            </View>
          </View>
          <Pressable
            style={styles.backdropDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep going"
            onPress={() => setConfirmingExit(false)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.base,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
  },
  context: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.4,
    color: C.prompt,
  },
  assetNotice: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFD666',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    gap: 10,
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(250, 248, 252, 0.16)',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: C.chipSelectedBorder,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: C.prompt,
  },
  actions: {
    marginTop: 12,
  },
  end: {
    marginTop: 8,
    minHeight: ElseaSize.minTouchTarget,
    justifyContent: 'center',
  },
  sheetBackdrop: {
    ...FILL,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(7, 7, 25, 0.72)',
  },
  backdropDismiss: {
    ...FILL,
    zIndex: -1,
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 26,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: C.atmosphereMid,
    borderTopWidth: 1,
    borderColor: 'rgba(146, 103, 226, 0.34)',
  },
  sheetHeading: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#FAF8FC',
  },
  sheetSupporting: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: C.prompt,
  },
  sheetActions: {
    marginTop: 22,
  },
});
