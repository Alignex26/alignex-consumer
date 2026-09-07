import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { ElseaColor, ElseaMotion, withAlpha } from '@/constants/elsea';

/**
 * The ELSEA field — the one background component every screen uses.
 *
 * Base colour plus exactly three positioned decorative layers. Both screens
 * share this implementation; only the layer configuration differs.
 *
 * No blur or gradient package is installed, so each layer is a broad elliptical
 * radial gradient standing in for a large blur radius.
 */

export type ElseaAtmosphereVariant = 'arrival' | 'conversation';

/**
 * A broad diffused field. The alpha follows a smoothstep from 25% outwards so
 * there is no perceptible boundary anywhere — at these sizes a hold-then-drop
 * profile resolves into a visible ellipse, which the specification forbids.
 */
const softEllipse = (hex: string) => ({
  type: 'radial-gradient' as const,
  shape: 'ellipse' as const,
  size: { x: '50%', y: '50%' },
  position: { top: '50%', left: '50%' },
  colorStops: [
    { color: withAlpha(hex, 1), positions: ['0%'] },
    { color: withAlpha(hex, 1), positions: ['25%'] },
    { color: withAlpha(hex, 0.84), positions: ['40%'] },
    { color: withAlpha(hex, 0.5), positions: ['57%'] },
    { color: withAlpha(hex, 0.2), positions: ['74%'] },
    { color: withAlpha(hex, 0.05), positions: ['88%'] },
    { color: withAlpha(hex, 0), positions: ['100%'] },
  ],
});

const PURPLE = [softEllipse(ElseaColor.purple)];
const VIOLET = [softEllipse(ElseaColor.bloom)];
const LILAC = [softEllipse(ElseaColor.lilac)];

type FieldConfig = {
  /** Layer A — central purple field. The only layer that ever changes. */
  a: {
    widthFactor: number;
    height: number;
    /** Horizontal offset from screen centre. */
    dx: number;
    top: number;
    opacityEmpty: number;
    opacityHeard: number;
  };
  /** Layer B — lower aubergine field. */
  b: { widthFactor: number; height: number; dx: number; bottom: number; opacity: number };
  /** Layer C — lilac light, wide and flat so it never reads as a circle. */
  c: { width: number; height: number; dx: number; top: number; opacity: number };
};

const FIELD: Record<ElseaAtmosphereVariant, FieldConfig> = {
  // Screen 01 — dark indigo above, purple through the middle and lower area.
  arrival: {
    a: { widthFactor: 1.45, height: 560, dx: 0, top: 290, opacityEmpty: 0.62, opacityHeard: 0.62 },
    b: { widthFactor: 1.55, height: 500, dx: 20, bottom: 10, opacity: 0.42 },
    c: { width: 420, height: 240, dx: -30, top: 560, opacity: 0.18 },
  },
  // Screen 02 — the same field, more illuminated; stronger central violet.
  conversation: {
    a: { widthFactor: 1.45, height: 540, dx: 0, top: 190, opacityEmpty: 0.66, opacityHeard: 0.72 },
    b: { widthFactor: 1.55, height: 460, dx: 20, bottom: 30, opacity: 0.46 },
    c: { width: 420, height: 230, dx: -30, top: 430, opacity: 0.2 },
  },
};

const ground = {
  type: 'linear-gradient' as const,
  direction: '180deg',
  colorStops: [
    { color: ElseaColor.ink, positions: ['0%'] },
    { color: ElseaColor.deep, positions: ['20%'] },
    { color: ElseaColor.fieldMid, positions: ['45%'] },
    { color: ElseaColor.aubergine, positions: ['70%'] },
    { color: ElseaColor.aubergine, positions: ['88%'] },
    // Bottom returns slightly darker but stays purple.
    { color: ElseaColor.fieldMid, positions: ['100%'] },
  ],
};

const baseStyle: ViewStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  // Decorative only — must never intercept touches.
  pointerEvents: 'none',
  backgroundColor: ElseaColor.ink,
  experimental_backgroundImage: [ground],
};

type Props = {
  variant?: ElseaAtmosphereVariant;
  /**
   * HEARD state. Raises Layer A only, over 600ms. Driven by whether there is
   * trimmed text — never by keystrokes, never on a loop.
   */
  alive?: boolean;
};

export function ElseaAtmosphere({ variant = 'arrival', alive = false }: Props) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const field = FIELD[variant];

  const layerA = useDerivedValue(() => {
    const target = alive ? field.a.opacityHeard : field.a.opacityEmpty;
    return reduceMotion
      ? target
      : withTiming(target, {
          duration: ElseaMotion.fieldLift,
          easing: Easing.inOut(Easing.ease),
        });
  }, [alive, reduceMotion, field]);

  const layerAStyle = useAnimatedStyle(() => ({ opacity: layerA.value }));

  const aWidth = width * field.a.widthFactor;
  const bWidth = width * field.b.widthFactor;

  return (
    <View style={baseStyle}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: aWidth,
            height: field.a.height,
            left: width / 2 + field.a.dx - aWidth / 2,
            top: field.a.top,
            experimental_backgroundImage: PURPLE,
          },
          layerAStyle,
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: bWidth,
          height: field.b.height,
          left: width / 2 + field.b.dx - bWidth / 2,
          bottom: field.b.bottom,
          opacity: field.b.opacity,
          experimental_backgroundImage: VIOLET,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: field.c.width,
          height: field.c.height,
          left: width / 2 + field.c.dx - field.c.width / 2,
          top: field.c.top,
          opacity: field.c.opacity,
          experimental_backgroundImage: LILAC,
        }}
      />
    </View>
  );
}
