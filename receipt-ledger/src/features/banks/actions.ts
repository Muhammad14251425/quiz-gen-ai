import { Alert } from 'react-native';

import type { Db } from '../../db/driver';
import * as repo from '../../db/repositories';
import { t } from '../../i18n';
import { bumpData } from '../../store/data';
import { deleteReceipt } from '../../utils/files';

/** Deleting a bank with history offers Archive (keeps history) or a confirmed cascade delete. */
export async function confirmDeleteBank(db: Db, bank: { id: number; name: string }): Promise<boolean> {
  const count = await repo.countBankTransactions(db, bank.id);
  return new Promise((resolve) => {
    const cascade = async () => {
      const receipts = await repo.deleteBankCascade(db, bank.id);
      receipts.forEach(deleteReceipt);
      bumpData();
      resolve(true);
    };
    Alert.alert(
      t('banks.deleteBankTitle', { name: bank.name }),
      count > 0 ? t('banks.deleteBankHasTx', { count }) : t('banks.deleteBankEmpty'),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        ...(count > 0
          ? [
              {
                text: t('common.archive'),
                onPress: async () => {
                  await repo.setBankArchived(db, bank.id, true);
                  bumpData();
                  resolve(true);
                },
              },
            ]
          : []),
        {
          text: count > 0 ? t('banks.deleteEverything') : t('common.delete'),
          style: 'destructive',
          onPress: () => void cascade(),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export async function confirmDeleteAccount(db: Db, accountId: number): Promise<boolean> {
  const count = (await repo.listTransactions(db, { accountIds: [accountId] })).length;
  return new Promise((resolve) => {
    Alert.alert(
      t('banks.deleteAccountTitle'),
      t('banks.deleteAccountBody', { count }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('common.archive'),
          onPress: async () => {
            await repo.setAccountArchived(db, accountId, true);
            bumpData();
            resolve(true);
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            (await repo.deleteAccountCascade(db, accountId)).forEach(deleteReceipt);
            bumpData();
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
