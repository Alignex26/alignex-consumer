import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The in-progress session the person is composing.
 *
 * There is no state library in this project and none is being introduced — this
 * is plain React context, which is enough for what the flow needs and keeps the
 * text in one place rather than threading it through navigation params.
 *
 * PRIVACY: `situationText` is the person's own words about their situation.
 * It is held in memory for the duration of the flow only. It is never
 * persisted, never written to a log, and never attached to an analytics event.
 * Anything added here must keep that true.
 *
 * `shortcut` is the optional one-word state the person tapped instead of, or
 * as well as, writing. It is a fixed value from a known list rather than their
 * own words, but it is held under exactly the same terms.
 */

type SessionDraft = {
  situationText: string;
  setSituationText: (next: string) => void;
  clearSituationText: () => void;
  /** One shortcut at a time, or none. Never cleared by typing. */
  shortcut: string | null;
  setShortcut: (next: string | null) => void;
};

const SessionDraftContext = createContext<SessionDraft | null>(null);

export function SessionDraftProvider({ children }: { children: ReactNode }) {
  const [situationText, setSituationText] = useState('');
  const [shortcut, setShortcut] = useState<string | null>(null);

  const value = useMemo<SessionDraft>(
    () => ({
      situationText,
      setSituationText,
      clearSituationText: () => setSituationText(''),
      shortcut,
      setShortcut,
    }),
    [situationText, shortcut]
  );

  return <SessionDraftContext.Provider value={value}>{children}</SessionDraftContext.Provider>;
}

export function useSessionDraft(): SessionDraft {
  const context = useContext(SessionDraftContext);
  if (!context) {
    throw new Error('useSessionDraft must be used inside a SessionDraftProvider.');
  }
  return context;
}

/**
 * Whether there is something real to act on — not just spaces and newlines.
 */
export function hasMeaningfulText(text: string): boolean {
  return text.trim().length > 0;
}
