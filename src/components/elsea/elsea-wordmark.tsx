import { StyleSheet, Text, View } from 'react-native';

import { PRODUCT_NAME, PROVENANCE, TRADEMARK } from '@/constants/brand';
import { ElseaArrivalBrand, ElseaArrivalColor, ElseaArrivalLayout, withAlpha } from '@/constants/elsea';

const B = ElseaArrivalBrand;

/**
 * Temporary typographic brand lockup — centred, thin and widely tracked.
 *
 * The real logo is not ready; this is set in the system font on purpose and is
 * NOT a logo. When the asset lands, this component is the only thing to replace.
 *
 * Locked metrics, identical on every device. A brand mark that changes size
 * with the viewport reads as a different mark, so this one does not step; only
 * the space above it does.
 *
 * The name and TM are separate Text nodes so the TM can sit small and raised
 * toward the cap height — nested Text on iOS cannot be offset from the
 * baseline. The TM is absolutely positioned so it cannot pull the name off
 * centre. The pair is grouped for screen readers so it is announced as the
 * name alone, not "<name> trademark".
 */
export function ElseaWordmark() {
  return (
    <View style={styles.container}>
      <View
        style={styles.markRow}
        accessible
        accessibilityRole="header"
        accessibilityLabel={PRODUCT_NAME}>
        <Text style={styles.mark} allowFontScaling={false}>
          {PRODUCT_NAME}
        </Text>
        <Text style={styles.trademark} allowFontScaling={false}>
          {TRADEMARK}
        </Text>
      </View>
      <Text style={styles.provenance} allowFontScaling={false}>
        {PROVENANCE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  markRow: {
    // Centring is driven by the name alone; the TM hangs off its right edge.
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: B.markSize,
    fontWeight: B.markWeight,
    // Spacing between the letters comes from letterSpacing, never from spaces
    // inserted into the string.
    letterSpacing: B.markTracking,
    lineHeight: B.markLeading,
    color: ElseaArrivalColor.offWhite,
    // letterSpacing adds a trailing advance after the final letter; pulling it
    // back keeps the word optically centred.
    marginLeft: B.markTracking,
  },
  trademark: {
    position: 'absolute',
    right: -10,
    top: 2,
    fontSize: B.trademarkSize,
    fontWeight: '500',
    color: ElseaArrivalColor.offWhite,
  },
  provenance: {
    marginTop: ElseaArrivalLayout.wordmarkToProvenance,
    fontSize: B.provenanceSize,
    fontWeight: '400',
    letterSpacing: B.provenanceTracking,
    color: withAlpha(ElseaArrivalColor.offWhite, 0.78),
  },
});
