import { View, type ViewStyle } from 'react-native';

import { ElseaEntryS2Color, withAlpha } from '@/constants/elsea';

/**
 * SCREEN 2 — the field.
 *
 * Held apart from `ElseaConversationField`, which five later screens share.
 * Screen 2 is the point where the brand moment hands over to the product
 * interface, so its ground is quieter than theirs: near-black at the top,
 * deepening to midnight indigo behind the pills and the action, with one very
 * soft violet presence low in the frame at roughly a third of the intensity
 * the shared field carries.
 *
 * That presence is sized far wider and taller than the viewport and centred
 * below its lower edge, so only the innermost part of the falloff is ever on
 * screen — it reads as depth, never as a shape with a circumference.
 *
 * Nothing else. No waves, no particles, no aurora, no noise. On this screen
 * the interface is the design, and the field's only job is to stay out of its
 * way.
 */

const C = ElseaEntryS2Color;

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
        { color: C.groundTop, positions: ['0%'] },
        { color: C.groundTop, positions: ['22%'] },
        { color: C.groundMid, positions: ['58%'] },
        { color: C.groundLow, positions: ['100%'] },
      ],
    },
  ],
};

/** Alpha is carried by the stops, so the presence has no boundary anywhere. */
const presence: ViewStyle = {
  position: 'absolute',
  left: '-60%',
  right: '-60%',
  top: '46%',
  bottom: '-45%',
  experimental_backgroundImage: [
    {
      type: 'radial-gradient' as const,
      shape: 'ellipse' as const,
      size: { x: '50%', y: '50%' },
      position: { top: '50%', left: '50%' },
      colorStops: [
        { color: withAlpha(C.presence, 0.13), positions: ['0%'] },
        { color: withAlpha(C.presence, 0.1), positions: ['34%'] },
        { color: withAlpha(C.presence, 0.05), positions: ['62%'] },
        { color: withAlpha(C.presence, 0.015), positions: ['84%'] },
        { color: withAlpha(C.presence, 0), positions: ['100%'] },
      ],
    },
  ],
};

export function ElseaQuietField() {
  return (
    <View style={field}>
      <View style={presence} />
    </View>
  );
}
