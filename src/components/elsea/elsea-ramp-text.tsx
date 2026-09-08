import { Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  children: string;
  /** Ramp stops, left to right. Two or more. */
  colors: readonly string[];
  style?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

/** Samples the ramp at t in [0, 1]. */
function sample(colors: readonly string[], t: number): string {
  if (colors.length === 1) return colors[0];
  const span = 1 / (colors.length - 1);
  const i = Math.min(Math.floor(t / span), colors.length - 2);
  const local = (t - i * span) / span;

  const [r1, g1, b1] = hexToRgb(colors[i]);
  const [r2, g2, b2] = hexToRgb(colors[i + 1]);

  const mix = (a: number, b: number) => Math.round(a + (b - a) * local);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

/**
 * Text carrying a horizontal colour ramp.
 *
 * React Native has no equivalent of `background-clip: text`, and the two usual
 * workarounds both cost more than they are worth here: a masked view means a
 * new native dependency, and rendering the word to an image loses Dynamic Type.
 *
 * So the ramp is applied per character instead. Each glyph takes its colour
 * from its position along the string, which produces the same left-to-right
 * transition at the sizes this is used at — the headline, where a single short
 * word carries the treatment. It is an approximation of a smooth gradient, not
 * a reproduction of one, and it is noted as such in the implementation report.
 *
 * The whole string is exposed to assistive technology as one word rather than
 * as a sequence of letters.
 */
export function ElseaRampText({ children, colors, style, maxFontSizeMultiplier }: Props) {
  const characters = Array.from(children);
  const last = Math.max(characters.length - 1, 1);

  return (
    <Text
      style={style}
      accessible
      accessibilityLabel={children}
      maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {characters.map((character, index) => (
        <Text
          key={`${character}-${index}`}
          style={{ color: sample(colors, index / last) }}
          maxFontSizeMultiplier={maxFontSizeMultiplier}>
          {character}
        </Text>
      ))}
    </Text>
  );
}
