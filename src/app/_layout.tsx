import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { ElseaColor } from '@/constants/elsea';
import { AuthProvider } from '@/state/auth';
import { SessionDraftProvider } from '@/state/session-draft';
import { SessionFlowProvider } from '@/state/session-flow';

SplashScreen.preventAutoHideAsync();

// The native splash is the same ink as Screen 01, so this is a crossfade
// between two identical grounds — the app appears to be already there.
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Runs after the initial route has committed, so there is content behind
    // the splash before it fades. Covers every route, not just Screen 01.
    SplashScreen.hide();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <SessionDraftProvider>
        <SessionFlowProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              // Screen 01 is full-bleed dark; this stops a light flash behind
              // it during transitions.
              contentStyle: { backgroundColor: ElseaColor.ink },
              animation: 'fade',
            }}
          />
        </SessionFlowProvider>
        </SessionDraftProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
