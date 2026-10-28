import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider, SplashScreen } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '../src/components/display';
import { DbProvider, useDb } from '../src/db/client';
import { LockGate } from '../src/features/lock/LockGate';
import { ShareIntentHandler } from '../src/features/share/ShareIntentHandler';
import { t } from '../src/i18n';
import { useSettings } from '../src/store/settings';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

function Navigation() {
  const { colors, dark } = useTheme();
  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors, dark]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <LockGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="import" options={{ title: t('import.title') }} />
          <Stack.Screen name="transaction/new" options={{ title: t('tx.addTitle') }} />
          <Stack.Screen name="transaction/[id]" options={{ title: t('tx.editTitle') }} />
          <Stack.Screen name="bank/[id]" options={{ title: '' }} />
          <Stack.Screen name="bank/edit" options={{ title: t('banks.addBank'), presentation: 'modal' }} />
          <Stack.Screen name="account/edit" options={{ title: t('banks.addAccount'), presentation: 'modal' }} />
          <Stack.Screen name="map" options={{ title: t('map.title') }} />
          <Stack.Screen name="categories" options={{ title: t('categories.title') }} />
          <Stack.Screen name="receipt" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="debug" options={{ title: t('settings.debug') }} />
        </Stack>
        <ShareIntentHandler />
        <ToastHost />
      </LockGate>
    </NavThemeProvider>
  );
}

function AppShell() {
  const db = useDb();
  const loaded = useSettings((s) => s.loaded);
  const load = useSettings((s) => s.load);

  useEffect(() => {
    void load(db).finally(() => SplashScreen.hideAsync());
  }, [db, load]);

  if (!loaded) return <Loading />;
  return (
    <ThemeProvider>
      <Navigation />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    // Must wrap everything so share intents are captured on cold start.
    <ShareIntentProvider>
      <SafeAreaProvider>
        <DbProvider fallback={<Loading />}>
          <AppShell />
        </DbProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
