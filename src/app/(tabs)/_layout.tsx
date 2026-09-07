import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text } from 'react-native';

import { ElseaS02Color } from '@/constants/elsea';

const C = ElseaS02Color;

/**
 * The post-onboarding shell.
 *
 * Two tabs. Not three, not five — Today is where the product happens and You
 * is where the small amount of personal detail lives. There is no Discover, no
 * Explore, and no feed, because none of those are what this product is for.
 *
 * The tabs appear only after someone has been through the flow; the arrival,
 * input and session screens are all outside this group and show no tab bar.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FAF8FC',
        tabBarInactiveTintColor: C.prompt,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
      }}>
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name="sun.max"
              size={22}
              tintColor={color}
              fallback={<Text style={[styles.glyph, { color }]}>◎</Text>}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name="person"
              size={22}
              tintColor={color}
              fallback={<Text style={[styles.glyph, { color }]}>◍</Text>}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.atmosphereTop,
    borderTopColor: 'rgba(146, 103, 226, 0.24)',
    borderTopWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  glyph: {
    fontSize: 20,
    lineHeight: 24,
  },
});
