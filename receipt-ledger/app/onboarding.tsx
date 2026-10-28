import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../src/components/display';
import { AppText, Button, Card, Icon } from '../src/components/ui';
import { useDb } from '../src/db/client';
import * as repo from '../src/db/repositories';
import { applyBackup, pickBackup } from '../src/features/backup/backup';
import { InvalidBackupError } from '../src/features/backup/format';
import {
  AccountFields,
  BankFields,
  parseOpening,
  presetPatch,
  useAccountForm,
  useBankForm,
} from '../src/features/banks/forms';
import { strings, t } from '../src/i18n';
import { bumpData } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { useTheme } from '../src/theme/ThemeProvider';

function StepDots({ step }: { step: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}
      accessibilityLabel={`Step ${step + 1} of 3`}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === step ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const update = useSettings((s) => s.update);
  const currency = useSettings((s) => s.currency);
  const [step, setStep] = useState(0);
  const bankForm = useBankForm({ ...presetPatch('jazzcash'), preset: 'jazzcash', name: 'JazzCash', color: '#C8102E' });
  const accountForm = useAccountForm({ label: 'Main', last4: '', currency, opening: '' });

  const finish = async () => {
    await update(db, { onboarded: true });
    router.replace('/');
  };

  const saveBank = async () => {
    const bankOk = await bankForm.trigger();
    const accountOk = await accountForm.trigger();
    if (!bankOk || !accountOk) return;
    const b = bankForm.getValues();
    const a = accountForm.getValues();
    const bankId = await repo.createBank(db, { name: b.name, color: b.color, icon: b.preset });
    await repo.createAccount(db, {
      bank_id: bankId,
      label: a.label,
      last4: a.last4.trim() || null,
      currency: a.currency,
      opening_balance_minor: parseOpening(a.opening),
    });
    bumpData();
    setStep(2);
  };

  const restore = async () => {
    try {
      const backup = await pickBackup();
      if (!backup) return;
      await applyBackup(db, backup);
      await finish();
    } catch (e) {
      Alert.alert(
        t('settings.importBackup'),
        e instanceof InvalidBackupError ? t('settings.backupInvalid') : String(e),
      );
    }
  };

  if (step === 0) {
    return (
      <Screen
        contentStyle={{ paddingTop: insets.top + 48, flexGrow: 1, justifyContent: 'center' }}
        footer={
          <>
            <Button title={t('onboarding.getStarted')} large onPress={() => setStep(1)} />
            <Button title={t('settings.importBackup')} variant="ghost" onPress={() => void restore()} />
          </>
        }
      >
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.primaryMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="receipt-outline" size={48} color={colors.primary} />
          </View>
          <AppText variant="display" style={{ textAlign: 'center' }} accessibilityRole="header">
            {t('onboarding.welcomeTitle')}
          </AppText>
          <AppText muted style={{ textAlign: 'center', fontSize: 16 }}>
            {t('onboarding.welcomeBody')}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="cloud-offline-outline" size={18} color={colors.textMuted} />
            <AppText variant="caption" muted>
              {t('settings.offline')}
            </AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen
        contentStyle={{ paddingTop: insets.top + 16 }}
        footer={
          <>
            <Button title={t('common.next')} large onPress={() => void saveBank()} />
            <Button title={t('common.back')} variant="ghost" onPress={() => setStep(0)} />
          </>
        }
      >
        <StepDots step={1} />
        <AppText variant="title" accessibilityRole="header">
          {t('onboarding.bankStepTitle')}
        </AppText>
        <AppText muted>{t('onboarding.bankStepBody')}</AppText>
        <BankFields
          control={bankForm.control}
          errors={bankForm.formState.errors}
          onPreset={(p) => {
            for (const [k, v] of Object.entries(presetPatch(p))) {
              bankForm.setValue(k as 'preset' | 'name' | 'color', v as string);
            }
          }}
        />
        <AccountFields control={accountForm.control} errors={accountForm.formState.errors} />
      </Screen>
    );
  }

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + 16 }}
      footer={<Button title={t('onboarding.finish')} large onPress={() => void finish()} />}
    >
      <StepDots step={2} />
      <AppText variant="title" accessibilityRole="header">
        {t('onboarding.shareStepTitle')}
      </AppText>
      <Card style={{ gap: 16 }}>
        {strings().onboarding.shareSteps.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="label" color={colors.onPrimary}>
                {i + 1}
              </AppText>
            </View>
            <AppText style={{ flex: 1, fontSize: 16 }}>{s}</AppText>
          </View>
        ))}
      </Card>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        {(['image-outline', 'share-social-outline', 'receipt-outline', 'checkmark-circle-outline'] as const).map(
          (name, i, all) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name={name} size={32} color={colors.primary} />
              {i < all.length - 1 ? <Icon name="arrow-forward" size={16} color={colors.textMuted} /> : null}
            </View>
          ),
        )}
      </View>
      <AppText muted>{t('onboarding.shareTip')}</AppText>
    </Screen>
  );
}
