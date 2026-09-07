import { View, type ViewStyle } from 'react-native';

import { ElseaArrivalColor, ElseaArrivalForm, withAlpha } from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';

/**
 * SCREEN 01 — the arrival field.
 *
 * Two systems, not one:
 *
 *   A. an ambient environment — a very subtle full-screen vertical transition
 *      that stays near-black at the outer edges;
 *   B. a single enormous curved luminous surface entering from the left, most
 *      of which sits outside the viewport, plus the backlight behind it.
 *
 * The point is a dark spatial environment *containing* a large illuminated
 * form — not a dark background with a purple blob in it.
 *
 * RESPONSIVE: the artwork is its own system, sized from the viewport rather
 * than from the reference frame's point values. Its diameter is the larger of
 * a width-driven and a height-driven figure, so it stays visually significant
 * on a narrow short phone and never turns into a small circle floating in the
 * corner of a large one. Its centre is expressed as a fraction of viewport
 * width and of *usable* height, which is what keeps the visible arc in the same
 * relationship to the message region on every frame.
 *
 * The interface does not scale with it. They are independent.
 *
 * Built with React Native's `experimental_backgroundImage` (RN 0.86 supports
 * typed linear and radial gradients natively) — no new dependency.
 */

const C = ElseaArrivalColor;
const F = ElseaArrivalForm;

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/** A. Ambient environment. Outer edges stay very dark. */
const ambient: ViewStyle = {
  ...fill,
  // The artwork is deliberately larger than the viewport; this is what keeps
  // it from contributing scrollable area or bleeding past the frame.
  overflow: 'hidden',
  pointerEvents: 'none',
  backgroundColor: C.baseBlackIndigo,
  experimental_backgroundImage: [
    {
      type: 'linear-gradient' as const,
      direction: '180deg',
      colorStops: [
        { color: C.baseBlackIndigo, positions: ['0%'] },
        { color: C.ambientMid, positions: ['42%'] },
        { color: C.deepViolet, positions: ['70%'] },
        { color: C.ambientFoot, positions: ['100%'] },
      ],
    },
  ],
};

/**
 * Soft diffused field, standing in for a blur radius. Smoothstep falloff so
 * there is no perceptible boundary — no blur package is installed.
 */
const diffuse = (hex: string) => ({
  type: 'radial-gradient' as const,
  shape: 'ellipse' as const,
  size: { x: '50%', y: '50%' },
  position: { top: '50%', left: '50%' },
  colorStops: [
    { color: withAlpha(hex, 1), positions: ['0%'] },
    { color: withAlpha(hex, 1), positions: ['22%'] },
    { color: withAlpha(hex, 0.82), positions: ['40%'] },
    { color: withAlpha(hex, 0.46), positions: ['58%'] },
    { color: withAlpha(hex, 0.18), positions: ['75%'] },
    { color: withAlpha(hex, 0.04), positions: ['89%'] },
    { color: withAlpha(hex, 0), positions: ['100%'] },
  ],
});

/**
 * B. The curved surface itself. Light originates within it.
 *
 * Drawn as a radial gradient rather than a clipped circle: the illuminated rim
 * sits near the outer stop and falls to fully transparent, so the form
 * dissolves into the environment instead of ending at an edge. Without the
 * alpha ramp the shape reads as a hard-edged disc sitting on the background
 * rather than a lit surface receding into it.
 *
 * The stops are proportional, so this scales with the artwork for free.
 */
const formSurface = {
  type: 'radial-gradient' as const,
  shape: 'circle' as const,
  // 46%, not 50%: the gradient must reach full transparency *inside* its own
  // box, otherwise the box edge itself shows as a straight seam where the
  // colour is cut off. Centre stays at 50% for the same reason.
  size: { x: '46%', y: '46%' },
  position: { top: '50%', left: '50%' },
  colorStops: [
    { color: withAlpha(C.aubergine, 0.26), positions: ['0%'] },
    { color: withAlpha(C.aubergine, 0.32), positions: ['50%'] },
    { color: withAlpha(C.purple, 0.44), positions: ['72%'] },
    // The two brightest stops are pulled back ~20%: the rim has to read as
    // luminous where it passes the supporting copy without throwing light
    // across the headline, which stays on the dark navy field.
    { color: withAlpha(C.brightViolet, 0.45), positions: ['86%'] },
    { color: withAlpha(C.luminousLilac, 0.42), positions: ['93%'] },
    { color: withAlpha(C.luminousLilac, 0), positions: ['100%'] },
  ],
};

const FORM = [formSurface];
const BACKLIGHT = [diffuse(C.brightViolet)];
const LOWER = [diffuse(C.purple)];

export function ElseaArrivalField() {
  const { screenWidth, usableHeight, insets } = useElseaLayout();

  // The larger of the two drivers, so the form stays dominant whichever way
  // the viewport is constrained.
  const diameter = Math.max(
    screenWidth * F.diameter.widthFactor,
    usableHeight * F.diameter.usableHeightFactor
  );
  const centerX = screenWidth * F.center.xFactor;
  const centerY = insets.top + usableHeight * F.center.yFactor;

  const backlightDiameter = diameter * F.backlight.scale;

  return (
    <View style={ambient}>
      {/* Backlight behind the form. Bloom only; never a second shape. */}
      <View
        style={{
          position: 'absolute',
          width: backlightDiameter,
          height: backlightDiameter,
          left: centerX - backlightDiameter / 2,
          top: centerY - backlightDiameter / 2,
          opacity: F.backlight.opacity,
          experimental_backgroundImage: BACKLIGHT,
        }}
      />

      {/* The curved luminous surface. */}
      <View
        style={{
          position: 'absolute',
          width: diameter,
          height: diameter,
          left: centerX - diameter / 2,
          top: centerY - diameter / 2,
          // No borderRadius: the circular geometry comes from the gradient
          // itself, whose outermost stop is fully transparent. A clipped shape
          // has a crisp boundary that no primitive available here can feather,
          // and the reference requires the surface to dissolve into the dark.
          experimental_backgroundImage: FORM,
        }}
      />

      {/* Lower atmospheric field behind the action region. */}
      <View
        style={{
          position: 'absolute',
          width: screenWidth * F.lowerField.widthFactor,
          height: usableHeight * F.lowerField.usableHeightFactor,
          left: screenWidth * F.lowerField.leftFactor,
          bottom: F.lowerField.bottom,
          opacity: F.lowerField.opacity,
          experimental_backgroundImage: LOWER,
        }}
      />
    </View>
  );
}
