import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ElseaS02, ElseaSize } from '@/constants/elsea';

type Props = {
  onPress: () => void;
};

const TINT = '#FAF8FC';

/**
 * Bare chevron, no circle, no button chrome. 44x44 target with the glyph
 * centred inside it.
 *
 * Uses the SF Symbol already available through expo-symbols (this project
 * already renders symbols on the starter screens), with a text fallback so
 * non-iOS bundling never breaks.
 */
export function ElseaBackButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={({ pressed }) => [styles.hitArea, pressed && styles.pressed]}>
      <SymbolView
        name="chevron.left"
        size={ElseaS02.backGlyph}
        tintColor={TINT}
        weight="medium"
        fallback={<Text style={styles.fallback}>‹</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: ElseaSize.minTouchTarget,
    height: ElseaSize.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  fallback: {
    fontSize: 26,
    lineHeight: 30,
    color: TINT,
  },
});
