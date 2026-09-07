import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

/**
 * ELSEA responsive layout foundation.
 *
 * One system, three behaviours. Layout decisions are driven by *usable height*
 * — viewport height minus the OS safe-area insets — never by device name,
 * never by a global scale transform, and never by multiplying every measurement
 * by screen height.
 *
 * 393 x 852 remains the canonical design frame. On that frame this resolves to
 * STANDARD, and the composition matches the locked reference. Other frames keep
 * the same composition on a different canvas.
 */

export type ElseaLayoutClass = 'compact' | 'standard' | 'tall';

/**
 * Width classes, which are a separate axis from height classes.
 *
 * Height decides how much vertical room the composition has; width decides how
 * much type can be set before it wraps. A short wide phone and a tall narrow
 * one need different answers, so the two are never conflated.
 */
export type ElseaWidthClass = 'narrow' | 'standard' | 'wide';

/** Usable-height boundaries. Behaviours, not devices. */
const COMPACT_MAX = 700;
const STANDARD_MAX = 820;

/** Horizontal gutter. Narrow viewports get a little back. */
const GUTTER = 24;
const GUTTER_NARROW = 20;

/** Width-class boundaries. Behaviours, not devices. */
const NARROW_WIDTH = 375;
const WIDE_WIDTH = 414;

/** Content never runs wider than this, however wide the viewport is. */
export const ELSEA_CONTENT_MAX_WIDTH = 430;

export type ElseaLayout = {
  screenWidth: number;
  screenHeight: number;
  /** Viewport height minus top and bottom safe-area insets. */
  usableHeight: number;
  insets: EdgeInsets;
  layoutClass: ElseaLayoutClass;
  widthClass: ElseaWidthClass;
  isCompact: boolean;
  isTall: boolean;
  horizontalGutter: number;
  contentMaxWidth: number;
};

export function useElseaLayout(): ElseaLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const usableHeight = Math.max(height - insets.top - insets.bottom, 0);

  const layoutClass: ElseaLayoutClass =
    usableHeight < COMPACT_MAX ? 'compact' : usableHeight <= STANDARD_MAX ? 'standard' : 'tall';

  const widthClass: ElseaWidthClass =
    width < NARROW_WIDTH ? 'narrow' : width < WIDE_WIDTH ? 'standard' : 'wide';

  return {
    screenWidth: width,
    screenHeight: height,
    usableHeight,
    insets,
    layoutClass,
    widthClass,
    isCompact: layoutClass === 'compact',
    isTall: layoutClass === 'tall',
    horizontalGutter: width < NARROW_WIDTH ? GUTTER_NARROW : GUTTER,
    contentMaxWidth: ELSEA_CONTENT_MAX_WIDTH,
  };
}

/** Bounds a preferred value. Used for proportional sizes that must not run away. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
