import { transitionFor } from '@/lib/transitions';
import type { StateCurrent, StateTarget } from '@/types/elsea';

/**
 * The six target-state cards from the locked Screen 2 reference.
 *
 * An explicit, exhaustive 1:1 presentation mapping. Every approved canonical
 * target has exactly one card and every card has exactly one canonical target:
 *
 *   focused    -> Focused
 *   activated  -> Energised
 *   home       -> Calmer
 *   sleep      -> Rested
 *   ready      -> Confident
 *   settled    -> Settled
 *
 * The labels are presentation language; the canonical values remain the engine
 * contract, and are not renamed to match. Lookup is by exact canonical value —
 * no fuzzy matching, no inference, no model in this layer. An interpreted
 * target outside this set is preserved and reported, never guessed at.
 *
 * "Happier" was in the reference artwork and is deliberately absent: it is not
 * an approved canonical target and must not enter the domain model.
 *
 * The second constraint, which naming alone does not satisfy: the architecture
 * accepts (current, target) PAIRS, not free targets. A mapped card is still
 * only usable when the pair it forms with the interpreted CURRENT state maps
 * to one of the five approved transitions. Someone who arrives wound up can
 * move to home or to sleep, but there is no approved route from wound up to
 * focused — so that card is offered or withheld per person, not globally.
 * `availableCards` is where that is decided.
 */
export type TargetCard = {
  key: string;
  label: string;
  /** Two lines, exactly as the reference sets them. */
  detail: string;
  /** SF Symbol name. iOS is the primary target; Android falls back. */
  symbol: string;
  /** Null until the mapping is authorised. Null cards are not selectable. */
  canonical: StateTarget | null;
};

export const ELSEA_TARGET_CARDS: TargetCard[] = [
  {
    key: 'focused',
    label: 'Focused',
    detail: 'Clear, productive,\nin the zone',
    symbol: 'target',
    canonical: 'focused',
  },
  {
    key: 'energised',
    label: 'Energised',
    detail: 'Motivated, ready\nto go',
    symbol: 'bolt.fill',
    canonical: 'activated',
  },
  {
    key: 'calmer',
    label: 'Calmer',
    detail: 'More at ease,\nless overwhelmed',
    symbol: 'face.smiling',
    canonical: 'home',
  },
  {
    key: 'rested',
    label: 'Rested',
    detail: 'Ready for\nbetter sleep',
    symbol: 'moon.fill',
    canonical: 'sleep',
  },
  {
    key: 'confident',
    label: 'Confident',
    detail: 'Braver, clearer,\nmore you',
    symbol: 'person.fill',
    canonical: 'ready',
  },
  {
    // Replaces the reference's "Happier", which has no approved canonical
    // target and is deliberately not introduced into the domain model.
    key: 'settled',
    label: 'Settled',
    detail: 'Grounded, steady,\nless switched on',
    symbol: 'circle.hexagongrid',
    canonical: 'settled',
  },
];

/** The card representing an interpreted target, if one exists. */
export function cardForTarget(target: StateTarget | null): TargetCard | null {
  if (!target) return null;
  return ELSEA_TARGET_CARDS.find((c) => c.canonical === target) ?? null;
}

/**
 * The transition a card would produce for someone in this current state, or
 * null if the pair is not an approved one.
 *
 * This is what makes a card selectable. Offering a target with no approved
 * transition behind it would let someone choose their way into a dead end —
 * the flow would reach session selection with a transition key that matches
 * nothing in the catalogue.
 */
export function transitionForCard(
  current: StateCurrent | null,
  card: TargetCard
): string | null {
  if (!current || !card.canonical) return null;
  return transitionFor(current, card.canonical);
}

/**
 * Canonical targets with no card. Empty under the V1 mapping — kept as a live
 * check rather than a comment, so that adding a target to the taxonomy without
 * giving it a card shows up as an unsupported value instead of a silent gap.
 */
export function unmappedTargets(all: readonly StateTarget[]): StateTarget[] {
  return all.filter((t) => !ELSEA_TARGET_CARDS.some((c) => c.canonical === t));
}
