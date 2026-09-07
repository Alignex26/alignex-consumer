/**
 * Customer-facing brand names.
 *
 * Single source of truth so the product name is never hardcoded in a screen —
 * changing it is one line here.
 *
 * Note the trademark rule: the ™ belongs to the brand LOCKUP only, not to the
 * name used in ordinary interface copy.
 *   Lockup   → ELSEA™ / by ALIGNEX
 *   Copy     → "Tell ELSEA what's going on."   (never "Tell ELSEA™ …")
 */

export const PRODUCT_NAME = 'ELSEA';

export const PARENT_BRAND = 'ALIGNEX';

/** Only ever rendered as part of the brand lockup. */
export const TRADEMARK = '™';

/** The provenance line beneath the lockup. */
export const PROVENANCE = `by ${PARENT_BRAND}`;
