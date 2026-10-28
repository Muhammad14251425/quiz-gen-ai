import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import type { Db } from '../../db/driver';
import * as repo from '../../db/repositories';
import type { NewTransaction, TxSource, TxType } from '../../db/types';
import { formatMoney, parseMoneyInput } from '../../domain/money';
import { t } from '../../i18n';
import { bumpData } from '../../store/data';
import { useSettings } from '../../store/settings';
import { formatDate } from '../../utils/format';
import { deleteReceipt, storeReceipt } from '../../utils/files';
import { showToast } from '../toast/store';

export interface TxFormValues {
  amount: string;
  occurredAt: Date;
  counterparty: string;
  reference: string;
  note: string;
  accountId: number | null;
  categoryId: number | null;
  type: TxType | null;
}

const clean = (s: string) => (s.trim() ? s.trim() : null);

export function toNewTransaction(
  values: TxFormValues,
  extra: { source: TxSource; receipt_path: string | null },
): NewTransaction {
  const amount = parseMoneyInput(values.amount);
  if (!amount || amount <= 0) throw new Error(t('tx.amountRequired'));
  if (values.accountId == null) throw new Error(t('tx.accountRequired'));
  if (!values.type) throw new Error(t('tx.typeRequired'));
  return {
    account_id: values.accountId,
    type: values.type,
    amount_minor: amount,
    occurred_at: values.occurredAt.getTime(),
    counterparty: clean(values.counterparty),
    reference: clean(values.reference),
    category_id: values.categoryId,
    note: clean(values.note),
    source: extra.source,
    receipt_path: extra.receipt_path,
  };
}

type DuplicateChoice = 'save' | 'skip' | 'cancel';

/** Warns about likely duplicates. Resolves to what the user chose ("save" when there are none). */
export async function confirmIfDuplicate(
  db: Db,
  tx: NewTransaction,
  opts: { canSkip: boolean },
): Promise<DuplicateChoice> {
  const dupes = await repo.findDuplicateTransactions(db, tx);
  if (dupes.length === 0) return 'save';
  const { tx: existing, reason } = dupes[0];
  const fmt = useSettings.getState().dateFormat;
  const amount = formatMoney(existing.amount_minor, existing.account_currency);
  const date = formatDate(existing.occurred_at, fmt);
  const message =
    reason === 'reference'
      ? t('tx.duplicateReference', { ref: existing.reference ?? '', amount, date })
      : t('tx.duplicateFields', { amount, name: existing.counterparty ?? '', date });
  return new Promise((resolve) => {
    Alert.alert(
      t('tx.duplicateTitle'),
      message,
      [
        ...(opts.canSkip ? [{ text: t('common.skip'), onPress: () => resolve('skip' as const) }] : []),
        { text: t('common.cancel'), style: 'cancel' as const, onPress: () => resolve('cancel') },
        { text: t('tx.saveAnyway'), onPress: () => resolve('save') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    );
  });
}

/**
 * Saves a new transaction: stores the receipt image copy, inserts the row,
 * remembers the account choice, refreshes balances and offers Undo.
 */
export async function saveNewTransaction(
  db: Db,
  values: TxFormValues,
  opts: { source: TxSource; imageUri?: string | null; bankHint?: string; bankIcon?: string | null },
): Promise<number> {
  const draft = toNewTransaction(values, { source: opts.source, receipt_path: null });
  const receiptPath = opts.imageUri ? await storeReceipt(opts.imageUri) : null;
  let id: number;
  try {
    id = await repo.createTransaction(db, { ...draft, receipt_path: receiptPath });
  } catch (e) {
    deleteReceipt(receiptPath);
    throw e;
  }

  const settings = useSettings.getState();
  const bankKey = opts.bankHint ?? opts.bankIcon ?? undefined;
  await settings.update(db, {
    lastAccountId: draft.account_id,
    lastAccountByBank: bankKey
      ? { ...settings.lastAccountByBank, [bankKey]: draft.account_id }
      : settings.lastAccountByBank,
  });

  bumpData();
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const account = await repo.getAccount(db, draft.account_id);
  showToast({
    message: t('tx.saved', { amount: formatMoney(draft.amount_minor, account?.currency ?? 'PKR') }),
    actionLabel: t('common.undo'),
    onAction: () => {
      void deleteTransactionAndReceipt(db, id).then(() => void Haptics.selectionAsync());
    },
  });
  return id;
}

export async function updateExistingTransaction(
  db: Db,
  id: number,
  values: TxFormValues,
  existing: { source: TxSource; receipt_path: string | null },
): Promise<void> {
  await repo.updateTransaction(db, id, toNewTransaction(values, existing));
  bumpData();
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export async function deleteTransactionAndReceipt(db: Db, id: number): Promise<void> {
  const path = await repo.deleteTransaction(db, id);
  deleteReceipt(path);
  bumpData();
}
