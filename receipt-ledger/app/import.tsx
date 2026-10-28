import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Screen } from '../src/components/display';
import { AppText, Banner, Button, EmptyState } from '../src/components/ui';
import { useDb } from '../src/db/client';
import * as repo from '../src/db/repositories';
import { preselectAccount } from '../src/domain/accountPick';
import { minorToInput } from '../src/domain/money';
import { importFromGallery } from '../src/features/import/pickFromGallery';
import { useImportQueue, type QueueItem } from '../src/features/import/queue';
import {
  confirmIfDuplicate,
  saveNewTransaction,
  toNewTransaction,
  type TxFormValues,
} from '../src/features/transactions/service';
import { TransactionForm } from '../src/features/transactions/TransactionForm';
import { useDbQuery } from '../src/hooks/useDbQuery';
import { t } from '../src/i18n';
import { useSettings } from '../src/store/settings';
import { useTheme } from '../src/theme/ThemeProvider';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function ImportForm({ item }: { item: QueueItem }) {
  const db = useDb();
  const finish = useImportQueue((s) => s.finish);
  const position = useImportQueue((s) => s.done + 1);
  const total = useImportQueue((s) => s.batchSize);
  const memory = useSettings(
    useShallow((s) => ({ lastAccountByBank: s.lastAccountByBank, lastAccountId: s.lastAccountId })),
  );
  const { data: accounts } = useDbQuery((d) => repo.listAccounts(d), []);
  const accountsReady = accounts !== undefined;
  const parsed = item.parsed!;

  const initial = useMemo<TxFormValues | null>(() => {
    if (!accounts) return null;
    return {
      amount: minorToInput(parsed.amount),
      occurredAt: parsed.date ?? new Date(),
      counterparty: parsed.counterparty ?? '',
      reference: parsed.reference ?? '',
      note: '',
      accountId: preselectAccount(accounts, parsed.bankHint, memory),
      categoryId: null,
      type: null,
    };
    // Compute once per receipt; later account changes must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsReady, item.id]);

  const next = () => {
    const remaining = useImportQueue.getState().items.length - 1;
    finish(item.id);
    if (remaining <= 0) leave();
  };

  const onSubmit = async (values: TxFormValues) => {
    const draft = toNewTransaction(values, { source: item.source, receipt_path: null });
    const choice = await confirmIfDuplicate(db, draft, { canSkip: true });
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const account = accounts?.find((a) => a.id === values.accountId);
      await saveNewTransaction(db, values, {
        source: item.source,
        imageUri: item.imageUri ?? item.sourceUri,
        bankHint: parsed.bankHint,
        bankIcon: account?.bank_icon,
      });
    }
    next();
  };

  if (!initial) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <TransactionForm
      key={item.id}
      mode="quick"
      initial={initial}
      confidence={parsed.confidence}
      bankHint={parsed.bankHint}
      imageUri={item.imageUri ?? item.sourceUri}
      suggestedType={parsed.directionHint}
      onSubmit={onSubmit}
      header={
        <View style={{ gap: 12 }}>
          {total > 1 ? (
            <AppText variant="label" muted accessibilityRole="header">
              {t('import.progress', { current: Math.min(position, total), total })}
            </AppText>
          ) : null}
          {item.ocrError ? <Banner tone="warning">{t('import.ocrFailed')}</Banner> : null}
        </View>
      }
      footerExtra={<Button title={t('import.skipReceipt')} variant="ghost" onPress={next} />}
    />
  );
}

export default function ImportScreen() {
  const { colors, radius } = useTheme();
  const head = useImportQueue((s) => s.items[0]);
  // A share may still be on its way (iOS deep link arrives before the files).
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const h = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(h);
  }, []);

  const { data: accountCount } = useDbQuery(async (d) => (await repo.listAccounts(d)).length, []);

  if (accountCount === 0) {
    return (
      <Screen>
        <EmptyState
          icon="wallet-outline"
          title={t('tx.noAccountsTitle')}
          body={t('tx.noAccountsBody')}
          action={<Button title={t('banks.addBank')} icon="add" onPress={() => router.push('/bank/edit')} />}
        />
      </Screen>
    );
  }

  if (!head) {
    if (!waited) {
      return (
        <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <AppText muted>{t('import.waiting')}</AppText>
        </Screen>
      );
    }
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title={t('import.nothingQueued')}
          body={t('import.nothingQueuedBody')}
          action={
            <Button
              title={t('import.pickFromGallery')}
              icon="images-outline"
              onPress={() => void importFromGallery()}
            />
          }
        />
      </Screen>
    );
  }

  if (head.status !== 'ready' || !head.parsed) {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Stack.Screen options={{ title: t('import.title') }} />
        <Image
          source={{ uri: head.sourceUri }}
          style={{ width: 160, height: 260, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <ActivityIndicator color={colors.primary} />
        <AppText muted accessibilityLiveRegion="polite">
          {t('import.reading')}
        </AppText>
      </Screen>
    );
  }

  return <ImportForm key={head.id} item={head} />;
}
