import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText, Button, Icon } from '../../components/ui';
import { t } from '../../i18n';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme/ThemeProvider';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 30_000;

export async function canUseAppLock(): Promise<boolean> {
  const [hardware, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  return hardware || level !== LocalAuthentication.SecurityLevel.NONE;
}

export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: t('lock.prompt'),
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Covers the app with a lock screen when App lock is on. Content stays mounted (share queue is kept). */
export function LockGate({ children }: { children: ReactNode }) {
  const enabled = useSettings((s) => s.appLock);
  const { colors } = useTheme();
  const [locked, setLocked] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled && locked) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!enabled) return;
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        backgroundedAt.current = null;
        setLocked(true);
        void unlock();
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {enabled && locked ? (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: colors.background }]}>
          <Icon name="lock-closed" size={48} color={colors.primary} />
          <AppText variant="title">{t('lock.title')}</AppText>
          <Button title={t('lock.unlock')} icon="finger-print" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
});
