import { Image } from 'expo-image';
import { View } from 'react-native';

import { PRODUCT_NAME } from '@/constants/brand';
import { ElseaMarkAsset } from '@/constants/elsea';

/** The approved ELSEA wordmark. 2172 x 724 RGBA, pale, with the TM set in. */
const MARK = require('@/assets/images/elsea-wordmark-light.png');

type Props = {
  /**
   * Visible width of the wordmark itself, in points — not the width of the
   * PNG. The asset has wide transparent margins, so asking for the canvas
   * width would render the mark about a quarter smaller than intended.
   */
  width: number;
};

/**
 * The ELSEA wordmark, as supplied.
 *
 * This component previously set the name in the system font, as a stand-in,
 * with a note that it was NOT a logo and was the only thing to replace when
 * the real asset landed. The asset has landed; this is that replacement.
 *
 * The mark is never re-created in text and never approximated. It scales, but
 * only between the two places it appears: large on Screen 1, where it is the
 * brand moment, and small on Screen 2, where it is only a masthead. The
 * TM is part of the artwork, so nothing is composited alongside it.
 *
 * Announced to assistive technology as the product name alone — a screen
 * reader should say "ELSEA", not describe an image.
 */
export function ElseaWordmark({ width }: Props) {
  const canvasWidth = width / ElseaMarkAsset.wordmark.inkWidth;
  const canvasHeight = canvasWidth / ElseaMarkAsset.wordmark.aspect;

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={PRODUCT_NAME}>
      <Image
        source={MARK}
        style={{ width: canvasWidth, height: canvasHeight }}
        contentFit="contain"
        // Identical on every device and shown on both entry screens; keeping
        // it in memory makes the Screen 1 to Screen 2 transition seamless.
        cachePolicy="memory-disk"
      />
    </View>
  );
}
