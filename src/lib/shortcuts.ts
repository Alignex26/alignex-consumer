import type { StateCurrent } from '@/types/elsea';

/**
 * The Screen 02 shortcut chips, mapped onto the closed current-state
 * vocabulary.
 *
 * A chip is a controlled value the person selected from an approved list, not
 * something they wrote. That distinction matters: free text has to go through
 * the server-side safety gate before anything can be interpreted from it,
 * whereas a chip carries no content to check. Someone who taps a chip and
 * writes nothing therefore goes to the manual picker rather than through the
 * gate — not because the gate is being skipped, but because there is nothing
 * for it to read.
 *
 * If there is any free text at all, it goes through the gate regardless of
 * whether a chip is also selected.
 */
export const SHORTCUT_STATE: Record<string, StateCurrent> = {
  Stressed: 'wound_up',
  Anxious: 'anxious',
  Low: 'flat',
  Overwhelmed: 'overwhelmed',
  Tired: 'low_energy',
  Wired: 'tired_wired',
  Distracted: 'scattered',
  Flat: 'flat',
};

export function stateForShortcut(label: string | null): StateCurrent | null {
  if (!label) return null;
  return SHORTCUT_STATE[label] ?? null;
}
