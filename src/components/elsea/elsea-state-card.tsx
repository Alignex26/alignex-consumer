import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ElseaFontScaleCap, ElseaTarget, ElseaWelcomeColor } from '@/constants/elsea';

const C = ElseaWelcomeColor;
const T = ElseaTarget;

type Props = {
  label: string;
  detail: string;
  symbol: string;
  selected: boolean;
  /** False where the target mapping is not yet authorised. */
  available: boolean;
  labelSize: number;
  detailSize: number;
  minHeight: number;
  paddingVertical: number;
  iconSize: number;
  innerGap: number;
  onPress: () => void;
};

/**
 * A target-state card.
 *
 * Selection is carried by border, surface and the accessibility selected state
 * together — never by colour alone, and never by a tick. Nothing resizes when
 * chosen, so a grid does not reflow under the finger.
 *
 * A card whose canonical mapping is unresolved renders at reduced opacity and
 * is genuinely disabled, with the reason exposed to assistive technology. It
 * is shown rather than hidden so the composition can be reviewed against the
 * reference, but it cannot put an unrecognised value into flow state.
 *
 * Icons are SF Symbols. iOS is the primary target; elsewhere the fallback is a
 * plain ring, so the Android emulator shows a placeholder rather than the
 * reference iconography.
 */
export function ElseaStateCard({
  label,
  detail,
  symbol,
  selected,
  available,
  labelSize,
  detailSize,
  minHeight,
  paddingVertical,
  iconSize,
  innerGap,
  onPress,
}: Props) {
  const tint = selected ? C.offWhite : C.paleLilac;

  return (
    <Pressable
      onPress={available ? onPress : undefined}
      disabled={!available}
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${detail.replace(/\n/g, ' ')}.`}
      accessibilityHint={available ? undefined : 'Not available yet.'}
      accessibilityState={{ selected, checked: selected, disabled: !available }}
      style={({ pressed }) => [
        styles.card,
        {
          minHeight,
          paddingVertical,
          gap: innerGap,
          borderColor: selected ? T.cardSelectedBorder : T.cardBorder,
          backgroundColor: selected ? T.cardSelectedSurface : T.cardSurface,
          opacity: available ? 1 : T.cardDisabledOpacity,
        },
        selected && styles.selected,
        pressed && available && styles.pressed,
      ]}>
      <SymbolView
        name={symbol as never}
        size={iconSize}
        tintColor={tint}
        weight="regular"
        fallback={<View style={[styles.fallbackGlyph, { width: iconSize, height: iconSize, borderRadius: iconSize / 2, borderColor: tint }]} />}
      />

      <Text
        style={[styles.label, { fontSize: labelSize, color: tint }]}
        numberOfLines={1}
        maxFontSizeMultiplier={ElseaFontScaleCap.supporting}>
        {label}
      </Text>

      <Text
        style={[styles.detail, { fontSize: detailSize, lineHeight: detailSize * 1.26 }]}
        maxFontSizeMultiplier={ElseaFontScaleCap.helper}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: T.cardRadius,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selected: {
    // Restrained. A lift, not a bloom.
    shadowColor: '#7C42E8',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  pressed: {
    opacity: 0.78,
  },
  fallbackGlyph: {
    borderWidth: 1.5,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  detail: {
    fontWeight: '400',
    textAlign: 'center',
    color: C.muted,
  },
});
