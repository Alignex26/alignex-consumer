import { StyleSheet, View } from 'react-native';

import { ElseaChoiceCard } from '@/components/elsea/elsea-choice-card';
import { ElseaScreen } from '@/components/elsea/elsea-screen';
import { YouCopy } from '@/constants/copy';
import { navigateTo, type ElseaRouteName } from '@/navigation/elsea-routes';

/**
 * SCREEN 18 — YOU.
 *
 * A short list, not a profile. There is no wellness score here, no personality
 * type, no pseudo-psychological read on anybody, and nothing public or social.
 * Four entries and nothing else.
 */
const ENTRIES: { label: string; route: ElseaRouteName }[] = [
  { label: YouCopy.patterns, route: 'patterns' },
  { label: YouCopy.audio, route: 'audioPreferences' },
  { label: YouCopy.notifications, route: 'notifications' },
  { label: YouCopy.account, route: 'account' },
];

export default function YouScreen() {
  return (
    <ElseaScreen screen="you" heading={YouCopy.heading}>
      <View style={styles.list}>
        {ENTRIES.map((entry) => (
          <ElseaChoiceCard
            key={entry.route}
            title={entry.label}
            selected={false}
            onPress={() => navigateTo(entry.route)}
          />
        ))}
      </View>
    </ElseaScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 26,
    gap: 10,
  },
});
