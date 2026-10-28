import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '../../src/components/display';
import { Switch } from '../../src/components/fields';
import { AppText, Card, Chip, Divider, ListRow, Segmented, SectionTitle } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import { CURRENCIES } from '../../src/domain/money';
import { applyBackup, exportBackup, exportCsv, pickBackup, wipeEverything } from '../../src/features/backup/backup';
import { InvalidBackupError } from '../../src/features/backup/format';
import { requestLocationPermission } from '../../src/features/location/location';
import { authenticate, canUseAppLock } from '../../src/features/lock/LockGate';
import { showToast } from '../../src/features/toast/store';
import { t } from '../../src/i18n';
import { useSettings, type DateFormat, type ThemePref } from '../../src/store/settings';
import { formatDate } from '../../src/utils/format';
import { fromLocalParts } from '../../src/utils/timezone';

const DATE_FORMATS: DateFormat[] = ['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const SAMPLE_DATE = fromLocalParts(2026, 10, 28).getTime();

export default function SettingsScreen() {
  const db = useDb();
  const settings = useSettings();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : String(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const toggleLocation = async (on: boolean) => {
    if (on && !(await requestLocationPermission())) {
      return Alert.alert(t('settings.saveLocation'), t('settings.locationDenied'));
    }
    await settings.update(db, { saveLocation: on });
  };

  const toggleLock = async (on: boolean) => {
    if (on) {
      if (!(await canUseAppLock())) return Alert.alert(t('settings.appLock'), t('settings.appLockUnavailable'));
      if (!(await authenticate())) return;
    }
    await settings.update(db, { appLock: on });
  };

  const restore = () =>
    run('restore', async () => {
      let backup;
      try {
        backup = await pickBackup();
      } catch (e) {
        if (e instanceof InvalidBackupError)
          return Alert.alert(t('settings.importBackup'), t('settings.backupInvalid'));
        throw e;
      }
      if (!backup) return;
      const date = formatDate(Date.parse(backup.manifest.exportedAt), settings.dateFormat);
      const picked = backup;
      Alert.alert(t('settings.restoreTitle'), t('settings.restoreBody', { date }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.importBackup'),
          style: 'destructive',
          onPress: () =>
            void run('restore', async () => {
              await applyBackup(db, picked);
              showToast({ message: t('settings.restored') });
            }),
        },
      ]);
    });

  const deleteAll = () =>
    Alert.alert(t('settings.deleteAllTitle'), t('settings.deleteAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void run('delete', async () => {
            await wipeEverything(db);
            router.replace('/onboarding');
          }),
      },
    ]);

  return (
    <Screen>
      <SectionTitle>{t('settings.general')}</SectionTitle>
      <Card style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <AppText variant="label" muted>
            {t('settings.theme')}
          </AppText>
          <Segmented<ThemePref>
            value={settings.theme}
            onChange={(theme) => void settings.update(db, { theme })}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
          />
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="label" muted>
            {t('settings.currency')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CURRENCIES.map((c) => (
              <Chip
                key={c.code}
                label={c.code}
                selected={settings.currency === c.code}
                onPress={() => void settings.update(db, { currency: c.code })}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <AppText variant="label" muted>
            {t('settings.dateFormat')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DATE_FORMATS.map((f) => (
              <Chip
                key={f}
                label={formatDate(SAMPLE_DATE, f)}
                selected={settings.dateFormat === f}
                onPress={() => void settings.update(db, { dateFormat: f })}
              />
            ))}
          </View>
        </View>
      </Card>

      <SectionTitle>{t('settings.categories')}</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="pricetags-outline"
          title={t('settings.manageCategories')}
          onPress={() => router.push('/categories')}
        />
      </Card>

      <SectionTitle>{t('settings.security')}</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="lock-closed-outline"
          title={t('settings.appLock')}
          subtitle={t('settings.appLockHint')}
          right={
            <Switch value={settings.appLock} onValueChange={(v) => void toggleLock(v)} label={t('settings.appLock')} />
          }
        />
      </Card>

      <SectionTitle>{t('settings.privacy')}</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="location-outline"
          title={t('settings.saveLocation')}
          subtitle={t('settings.saveLocationHint')}
          right={
            <Switch
              value={settings.saveLocation}
              onValueChange={(v) => void toggleLocation(v)}
              label={t('settings.saveLocation')}
            />
          }
        />
      </Card>

      <SectionTitle>{t('settings.data')}</SectionTitle>
      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="archive-outline"
          title={busy === 'export' ? t('common.loading') : t('settings.exportBackup')}
          onPress={() => void run('export', () => exportBackup(db))}
        />
        <Divider />
        <ListRow
          icon="cloud-download-outline"
          title={busy === 'restore' ? t('common.loading') : t('settings.importBackup')}
          onPress={() => void restore()}
        />
        <Divider />
        <ListRow
          icon="document-text-outline"
          title={busy === 'csv' ? t('common.loading') : t('settings.exportCsv')}
          onPress={() => void run('csv', () => exportCsv(db))}
        />
        <Divider />
        <ListRow icon="trash-outline" title={t('settings.deleteAll')} danger onPress={deleteAll} />
      </Card>

      <SectionTitle>{t('settings.about')}</SectionTitle>
      <Card style={{ gap: 8 }}>
        <AppText>{t('settings.offline')}</AppText>
        <AppText variant="caption" muted>
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </AppText>
      </Card>

      {__DEV__ ? (
        <>
          <SectionTitle>{t('settings.developer')}</SectionTitle>
          <Card style={{ paddingVertical: 0 }}>
            <ListRow icon="bug-outline" title={t('settings.debug')} onPress={() => router.push('/debug')} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
