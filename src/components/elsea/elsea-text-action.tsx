import { Pressable, StyleSheet, Text } from 'react-native';

import { ElseaArrivalColor, ElseaSize, withAlpha } from '@/constants/elsea';

type Props = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
};

/**
 * The account link. Text only, underlined, centred — no box, no border, no
 * icon. The touch target is invisible but still clears 44pt.
 */
export function ElseaTextAction({ label, onPress, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.hitArea, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    minHeight: ElseaSize.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    color: withAlpha(ElseaArrivalColor.offWhite, 0.82),
  },
});
