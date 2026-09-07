import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type {
  CatalogueSession,
  DurationChoice,
  ElseaFailure,
  Interpretation,
  Outcome,
  SessionRun,
} from '@/types/elsea';

/**
 * The state of the current attempt: what ELSEA understood, what was chosen,
 * what is playing, and how it went.
 *
 * Kept separate from `session-draft`, which holds the person's own words.
 * Nothing in here is free text, which is what lets it be passed around,
 * guarded against and reasoned about freely.
 *
 * Plain React context, matching the existing architecture. No state library is
 * introduced.
 */

type SessionFlow = {
  interpretation: Interpretation | null;
  setInterpretation: (next: Interpretation | null) => void;

  durationChoice: DurationChoice | null;
  setDurationChoice: (next: DurationChoice | null) => void;

  selectedSession: CatalogueSession | null;
  setSelectedSession: (next: CatalogueSession | null) => void;

  run: SessionRun | null;
  setRun: (next: SessionRun | null) => void;

  outcome: Outcome | null;
  setOutcome: (next: Outcome | null) => void;

  /** Set when something failed. The screen decides how calmly to present it. */
  failure: ElseaFailure | null;
  setFailure: (next: ElseaFailure | null) => void;

  /**
   * True once the safety gate has passed for the current input.
   *
   * Route guards read this. It is set in exactly one place — the Understanding
   * screen, on a `session` result from the server — and cleared by `reset()`.
   * A screen cannot set it to skip the gate, because nothing else writes it.
   */
  safetyCleared: boolean;
  clearSafety: () => void;

  /** Wipes the attempt. Called when a flow ends, and on a safety diversion. */
  reset: () => void;
};

const SessionFlowContext = createContext<SessionFlow | null>(null);

export function SessionFlowProvider({ children }: { children: ReactNode }) {
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [durationChoice, setDurationChoice] = useState<DurationChoice | null>(null);
  const [selectedSession, setSelectedSession] = useState<CatalogueSession | null>(null);
  const [run, setRun] = useState<SessionRun | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<ElseaFailure | null>(null);
  const [safetyCleared, setSafetyCleared] = useState(false);

  const reset = useCallback(() => {
    setInterpretation(null);
    setDurationChoice(null);
    setSelectedSession(null);
    setRun(null);
    setOutcome(null);
    setFailure(null);
    setSafetyCleared(false);
  }, []);

  const clearSafety = useCallback(() => setSafetyCleared(true), []);

  const value = useMemo<SessionFlow>(
    () => ({
      interpretation,
      setInterpretation,
      durationChoice,
      setDurationChoice,
      selectedSession,
      setSelectedSession,
      run,
      setRun,
      outcome,
      setOutcome,
      failure,
      setFailure,
      safetyCleared,
      clearSafety,
      reset,
    }),
    [
      interpretation,
      durationChoice,
      selectedSession,
      run,
      outcome,
      failure,
      safetyCleared,
      clearSafety,
      reset,
    ]
  );

  return <SessionFlowContext.Provider value={value}>{children}</SessionFlowContext.Provider>;
}

export function useSessionFlow(): SessionFlow {
  const context = useContext(SessionFlowContext);
  if (!context) {
    throw new Error('useSessionFlow must be used inside a SessionFlowProvider.');
  }
  return context;
}
