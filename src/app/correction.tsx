import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaFlowAction } from '@/components/elsea/elsea-flow-action';
import { ElseaScreen, goBack } from '@/components/elsea/elsea-screen';
import {
  CorrectionCopy,
  STATE_CURRENT_LABEL,
  STATE_TARGET_LABEL,
} from '@/constants/copy';
import { ElseaFontScaleCap, ElseaS02Color } from '@/constants/elsea';
import { track } from '@/lib/analytics';
import { stateForShortcut } from '@/lib/shortcuts';
import { SELECTABLE_CURRENT, targetsFor, transitionFor } from '@/lib/transitions';
import { navigateTo } from '@/navigation/elsea-routes';
import { useSessionDraft } from '@/state/session-draft';
import { useSessionFlow } from '@/state/session-flow';
import type { StateCurrent, StateTarget } from '@/types/elsea';

const C = ElseaS02Color;

/**
 * SCREEN 05 — CORRECT THE INTERPRETATION.
 *
 * Also the manual picker: this is where someone lands when the interpreter was
 * unavailable or unsure, and where someone who only tapped a chip arrives.
 *
 * It is not a conversation. There is no text box and no back-and-forth — two
 * lists, both drawn from the approved catalogue. The options are derived from
 * the transition mapping itself, so a pair with no approved transition behind
 * it cannot be offered, and no new state can be created here.
 *
 * Unguarded on purpose: reaching this screen produces a transition the person
 * picked from a fixed list, which involves no free text and therefore nothing
 * for the safety gate to have read.
 */
export default function CorrectionScreen() {
  const { interpretation, setInterpretation } = useSessionFlow();
  const { shortcut } = useSessionDraft();

  // Seeded from whatever we already have: the interpretation if there was one,
  // otherwise the chip they tapped.
  const [current, setCurrent] = useState<StateCurrent | null>(
    interpretation?.stateCurrent ?? stateForShortcut(shortcut)
  );
  const [target, setTarget] = useState<StateTarget | null>(
    interpretation?.stateTarget ?? null
  );

  const availableTargets = useMemo(() => (current ? targetsFor(current) : []), [current]);

  // A target chosen for a previous current state may not be valid any more.
  const effectiveTarget = target && availableTargets.includes(target) ? target : null;

  const transitionKey = current && effectiveTarget ? transitionFor(current, effectiveTarget) : null;

  const onCurrent = (next: StateCurrent) => {
    setCurrent(next);
    if (target && !targetsFor(next).includes(target)) setTarget(null);
  };

  const proceed = () => {
    if (!transitionKey || !current || !effectiveTarget) return;

    setInterpretation({
      transitionKey,
      // Selection happens on the next screen once time is known, so these are
      // placeholders that the time screen replaces.
      sessionId: '',
      durationSeconds: 0,
      stateCurrent: current,
      stateTarget: effectiveTarget,
      contextTag: interpretation?.contextTag ?? null,
      origin: 'corrected',
    });

    track({ name: 'interpretation_corrected', transition: transitionKey });
    navigateTo('time');
  };

  return (
    <ElseaScreen
      screen="correction"
      onBack={goBack}
      heading={CorrectionCopy.heading}
      action={
        <ElseaFlowAction
          label={CorrectionCopy.primaryAction}
          onPress={proceed}
          disabled={!transitionKey}
        />
      }>
      <Text style={styles.label} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
        {CorrectionCopy.currentLabel}
      </Text>
      <View style={styles.list} accessibilityRole="radiogroup">
        {SELECTABLE_CURRENT.map((state) => (
          <ElseaChoiceCard
            key={state}
            title={STATE_CURRENT_LABEL[state]}
            selected={current === state}
            onPress={() => onCurrent(state)}
          />
        ))}
      </View>

      {current ? (
        <>
          <Text style={[styles.label, styles.secondLabel]} maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
            {CorrectionCopy.targetLabel}
          </Text>
          <View style={styles.list} accessibilityRole="radiogroup">
            {availableTargets.map((state) => (
              <ElseaChoiceCard
                key={state}
                title={STATE_TARGET_LABEL[state]}
                selected={effectiveTarget === state}
                onPress={() => setTarget(state)}
              />
            ))}
          </View>
        </>
      ) : null}
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 24,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: C.prompt,
  },
  secondLabel: {
    marginTop: 28,
  },
  list: {
    marginTop: 10,
    gap: 8,
  },
});
