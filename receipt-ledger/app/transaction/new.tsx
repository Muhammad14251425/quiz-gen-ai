import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator } from 'react-native';

import { Screen } from '../../src/components/display';
import { Button, EmptyState } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import * as repo from '../../src/db/repositories';
import { preselectAccount } from '../../src/domain/accountPick';
import {
  confirmIfDuplicate,
  saveNewTransaction,
  toNewTransaction,
  type TxFormValues,
} from '../../src/features/transactions/service';
import { LocationNotice } from '../../src/features/location/LocationInfo';
import { TransactionForm } from '../../src/features/transactions/TransactionForm';
import { importFromGallery } from '../../src/features/import/pickFromGallery';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { t } from '../../src/i18n';
import { useSettings } from '../../src/store/settings';

export default function NewTransactionScreen() {
  const db = useDb();
  const lastAccountId = useSettings((s) => s.lastAccountId);
  const { data: accounts } = useDbQuery((d) => repo.listAccounts(d), []);
  const accountsReady = accounts !== undefined;

  const initial = useMemo<TxFormValues | null>(
    () =>
      accounts
        ? {
            amount: '',
            occurredAt: new Date(),
            counterparty: '',
            reference: '',
            note: '',
            accountId: preselectAccount(accounts, undefined, { lastAccountByBank: {}, lastAccountId }),
            categoryId: null,
            type: null,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountsReady],
  );

  if (!initial || !accounts) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (accounts.length === 0) {
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

  return (
    <TransactionForm
      mode="quick"
      initial={initial}
      afterFields={<LocationNotice occurredAt={initial.occurredAt} />}
      onSubmit={async (values) => {
        const draft = toNewTransaction(values, { source: 'manual', receipt_path: null });
        if ((await confirmIfDuplicate(db, draft, { canSkip: false })) !== 'save') return;
        await saveNewTransaction(db, values, { source: 'manual' });
        router.back();
      }}
      footerExtra={
        <Button
          title={t('import.pickFromGallery')}
          icon="images-outline"
          variant="ghost"
          onPress={() => {
            router.back();
            void importFromGallery();
          }}
        />
      }
    />
  );
}
