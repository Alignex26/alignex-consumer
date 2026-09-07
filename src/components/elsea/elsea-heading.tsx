import { StyleSheet, Text, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';

import { ElseaFontScaleCap, ElseaHeadingScale, ElseaHeadingStyle } from '@/constants/elsea';
import { useElseaLayout } from '@/layout/use-elsea-layout';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

/**
 * The shared ELSEA screen heading.
 *
 * Size steps with the width class, because width is what decides whether a
 * heading wraps. It is deliberately not tied to viewport height, not scaled
 * continuously, and not chosen by device.
 *
 * The heading wraps naturally to a second line when it needs one. There are no
 * manual line breaks, no truncation and no ellipsis: `flexShrink` and a full
 * width let the text reflow, and everything below it moves down with it.
 *
 * This is the component subsequent screens should use for their heading.
 */
export function ElseaHeading({ children, style }: Props) {
  const { widthClass } = useElseaLayout();
  const { fontScale } = useWindowDimensions();

  const scale = ElseaHeadingScale[widthClass];
  // RN scales fontSize with the system font scale but leaves lineHeight alone.
  const leadingScale = Math.min(fontScale, ElseaFontScaleCap.heading);

  return (
    <Text
      style={[
        styles.heading,
        { fontSize: scale.size, lineHeight: scale.leading * leadingScale },
        style,
      ]}
      accessibilityRole="header"
      numberOfLines={ElseaHeadingStyle.maxLines}
      maxFontSizeMultiplier={ElseaFontScaleCap.heading}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    width: '100%',
    flexShrink: 1,
    fontWeight: ElseaHeadingStyle.weight,
    letterSpacing: ElseaHeadingStyle.letterSpacing,
    color: ElseaHeadingStyle.color,
  },
});
