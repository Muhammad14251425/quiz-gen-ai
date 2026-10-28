import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '../../src/components/ui';
import { t } from '../../src/i18n';
import { useSettings } from '../../src/store/settings';
import { useTheme } from '../../src/theme/ThemeProvider';

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return <Icon name={(focused ? name : `${name}-outline`) as IconName} color={String(color)} size={24} />;
}

function icon(name: IconName) {
  return function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabIcon name={name} color={color} focused={focused} />;
  };
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const onboarded = useSettings((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), headerShown: false, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="activity" options={{ title: t('tabs.activity'), tabBarIcon: icon('list') }} />
      <Tabs.Screen name="banks" options={{ title: t('tabs.banks'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="insights" options={{ title: t('tabs.insights'), tabBarIcon: icon('pie-chart') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
