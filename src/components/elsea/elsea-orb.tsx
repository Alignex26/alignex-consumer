import { Image } from 'expo-image';
import { View } from 'react-native';

import { ElseaMarkAsset } from '@/constants/elsea';

/** The approved ELSEA orb. 1254 x 1254 RGBA, transparent to the edges. */
const ORB = require('@/assets/images/elsea-orb.png');

type Props = {
  /**
   * Visible width of the orb in points, not the width of the PNG. The asset
   * has ~8% transparent margin on each side; asking for the canvas width
   * would render the orb noticeably smaller than the specified 260-310.
   */
  size: number;
};

/**
 * SCREEN 1 — the ELSEA orb.
 *
 * The single visual hero of the entry flow, and the only decorative object on
 * Screen 1. Rendered exactly as supplied: aspect preserved, never cropped,
 * never stretched, with nothing composited over or behind it.
 *
 * No additional glow layer. The asset already carries its own bloom out to
 * fully transparent edges — verified in the file rather than assumed — so it
 * composites onto the dark ground with no visible boundary and needs no help
 * blending. Adding a second glow is what would turn this into a neon
 * interface.
 *
 * No animation either. It is an object with presence, not an ambient effect.
 *
 * Purely decorative, so it is hidden from assistive technology: the screen's
 * meaning is carried by the wordmark, the headline and the CTA.
 */
export function ElseaOrb({ size }: Props) {
  // Square canvas, so one number does for both axes.
  const canvas = size / ElseaMarkAsset.orb.inkWidth;

  return (
    <View
      style={{ width: canvas, height: canvas }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image
        source={ORB}
        style={{ width: canvas, height: canvas }}
        contentFit="contain"
        transition={520}
        cachePolicy="memory-disk"
      />
    </View>
  );
}
