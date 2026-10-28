import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Screen } from '../../src/components/display';
import { Button, EmptyState } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import * as repo from '../../src/db/repositories';
import { minorToInput } from '../../src/domain/money';
import {
  deleteTransactionAndReceipt,
  updateExistingTransaction,
  type TxFormValues,
} from '../../src/features/transactions/service';
import { TransactionForm } from '../../src/features/transactions/TransactionForm';
import { showToast } from '../../src/features/toast/store';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { t } from '../../src/i18n';
import { resolveReceipt } from '../../src/utils/files';

export default function TransactionScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const { data: tx, loading } = useDbQuery((d) => repo.getTransaction(d, txId), [txId]);

  const initial = useMemo<TxFormValues | null>(
    () =>
      tx
        ? {
            amount: minorToInput(tx.amount_minor),
            occurredAt: new Date(tx.occurred_at),
            counterparty: tx.counterparty ?? '',
            reference: tx.reference ?? '',
            note: tx.note ?? '',
            accountId: tx.account_id,
            categoryId: tx.category_id,
            type: tx.type,
          }
        : null,
    // Only seed the form once per transaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tx?.id],
  );

  if (loading && !tx) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!tx || !initial) {
    return (
      <Screen>
        <EmptyState icon="search-outline" title={t('activity.empty')} />
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert(t('tx.deleteTitle'), t('tx.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTransactionAndReceipt(db, tx.id);
          showToast({ message: t('tx.deleted'), tone: 'info' });
          router.back();
        },
      },
    ]);

  return (
    <TransactionForm
      key={tx.id}
      mode="edit"
      initial={initial}
      imageUri={resolveReceipt(tx.receipt_path)}
      onSubmit={async (values) => {
        await updateExistingTransaction(db, tx.id, values, { source: tx.source, receipt_path: tx.receipt_path });
        router.back();
      }}
      footerExtra={<Button title={t('common.delete')} icon="trash-outline" variant="ghost" onPress={confirmDelete} />}
    />
  );
}
