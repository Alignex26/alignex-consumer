import { ElseaPrimaryAction } from '@/components/elsea/elsea-primary-action';
import { ElseaS02 } from '@/constants/elsea';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  /** Quieter treatment for the second of a pair. */
  secondary?: boolean;
};

/**
 * The primary action, preset to the flow's locked geometry.
 *
 * Screen 02's Continue established these values and every screen after it uses
 * the same ones, so this exists purely to stop six numbers being repeated on
 * twenty screens. It adds no new styling of its own.
 */
export function ElseaFlowAction({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  secondary = false,
}: Props) {
  return (
    <ElseaPrimaryAction
      label={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityHint={accessibilityHint}
      tone={secondary ? 'violet' : 'gradientViolet'}
      height={ElseaS02.ctaHeight}
      borderRadius={ElseaS02.ctaRadius}
      fontSize={ElseaS02.ctaTextSize}
      lineHeight={ElseaS02.ctaTextLeading}
      elevated={false}
    />
  );
}
