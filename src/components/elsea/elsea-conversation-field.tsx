import { View, type ViewStyle } from 'react-native';

import { ElseaS02Color, withAlpha } from '@/constants/elsea';

/**
 * SCREEN 02 — the field.
 *
 * Same production background technology as Screen 01 (React Native 0.86's
 * native `experimental_backgroundImage`), deliberately far more restrained:
 * this screen carries no giant curved horizon, because the content is the
 * subject here and the atmosphere is only depth behind it.
 *
 * Three layers, in order:
 *
 *   1. a vertical transition — nearly black at the top, dark navy-violet
 *      through the upper middle, subtle violet depth in the middle, a slightly
 *      richer purple low down behind the chips and the action;
 *   2. one very wide, very soft violet presence low in the frame. It is sized
 *      far larger than the viewport and centred below it, so no edge or
 *      circumference is ever visible — it reads as depth, not as a shape;
 *   3. a horizontal darkening that keeps the outer left and right edges deep.
 *
 * No blobs, circles, waves, particles, noise, aurora or neon.
 */

const C = ElseaS02Color;

const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const field: ViewStyle = {
  ...fill,
  overflow: 'hidden',
  pointerEvents: 'none',
  backgroundColor: C.base,
  experimental_backgroundImage: [
    {
      type: 'linear-gradient' as const,
      direction: '180deg',
      colorStops: [
        { color: C.atmosphereTop, positions: ['0%'] },
        { color: C.atmosphereTop, positions: ['16%'] },
        { color: C.atmosphereMid, positions: ['46%'] },
        { color: C.atmosphereLow, positions: ['80%'] },
        { color: C.atmosphereLow, positions: ['100%'] },
      ],
    },
  ],
};

/**
 * The violet presence. Its box is much wider and taller than the screen and
 * its centre sits below the lower edge, so only the innermost, flattest part
 * of the falloff is ever on screen — which is what keeps it from reading as a
 * circle. Alpha is carried by the stops rather than by layer opacity so the
 * transition to the surrounding field has no boundary.
 */
const presence: ViewStyle = {
  position: 'absolute',
  left: '-60%',
  right: '-60%',
  top: '38%',
  bottom: '-45%',
  experimental_backgroundImage: [
    {
      type: 'radial-gradient' as const,
      shape: 'ellipse' as const,
      size: { x: '50%', y: '50%' },
      position: { top: '50%', left: '50%' },
      colorStops: [
        { color: withAlpha(C.violetTrace, 0.2), positions: ['0%'] },
        { color: withAlpha(C.atmosphereViolet, 0.34), positions: ['26%'] },
        { color: withAlpha(C.atmosphereViolet, 0.24), positions: ['48%'] },
        { color: withAlpha(C.atmosphereViolet, 0.11), positions: ['68%'] },
        { color: withAlpha(C.atmosphereViolet, 0.03), positions: ['86%'] },
        { color: withAlpha(C.atmosphereViolet, 0), positions: ['100%'] },
      ],
    },
  ],
};

/** Keeps the outer left and right edges very dark, as the reference does. */
const edges: ViewStyle = {
  ...fill,
  experimental_backgroundImage: [
    {
      type: 'linear-gradient' as const,
      direction: '90deg',
      colorStops: [
        { color: withAlpha(C.base, 0.62), positions: ['0%'] },
        { color: withAlpha(C.base, 0.16), positions: ['22%'] },
        { color: withAlpha(C.base, 0), positions: ['50%'] },
        { color: withAlpha(C.base, 0.16), positions: ['78%'] },
        { color: withAlpha(C.base, 0.62), positions: ['100%'] },
      ],
    },
  ],
};

export function ElseaConversationField() {
  return (
    <View style={field}>
      <View style={presence} />
      <View style={edges} />
    </View>
  );
}
