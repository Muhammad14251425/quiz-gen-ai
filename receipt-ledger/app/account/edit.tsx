import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '../../src/components/display';
import { Button } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import * as repo from '../../src/db/repositories';
import { minorToInput } from '../../src/domain/money';
import { confirmDeleteAccount } from '../../src/features/banks/actions';
import { AccountFields, parseOpening, useAccountForm } from '../../src/features/banks/forms';
import { t } from '../../src/i18n';
import { bumpData } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';

export default function EditAccountScreen() {
  const db = useDb();
  const currency = useSettings((s) => s.currency);
  const params = useLocalSearchParams<{ id?: string; bankId?: string }>();
  const accountId = params.id ? Number(params.id) : null;
  const [bankId, setBankId] = useState<number | null>(params.bankId ? Number(params.bankId) : null);
  const [archived, setArchived] = useState(false);
  const form = useAccountForm({ label: '', last4: '', currency, opening: '' });

  useEffect(() => {
    if (accountId == null) return;
    void repo.getAccount(db, accountId).then((a) => {
      if (!a) return;
      setBankId(a.bank_id);
      setArchived(!!a.archived);
      const opening = minorToInput(Math.abs(a.opening_balance_minor));
      form.reset({
        label: a.label,
        last4: a.last4 ?? '',
        currency: a.currency,
        opening: a.opening_balance_minor < 0 ? `-${opening}` : opening,
      });
    });
  }, [accountId, db, form]);

  const save = form.handleSubmit(async (v) => {
    if (bankId == null) return;
    const input = {
      bank_id: bankId,
      label: v.label,
      last4: v.last4.trim() || null,
      currency: v.currency,
      opening_balance_minor: parseOpening(v.opening),
    };
    if (accountId != null) await repo.updateAccount(db, accountId, input);
    else await repo.createAccount(db, input);
    bumpData();
    router.back();
  });

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.save')} large loading={form.formState.isSubmitting} onPress={save} />
          {accountId != null ? (
            archived ? (
              <Button
                title={t('common.unarchive')}
                variant="ghost"
                onPress={async () => {
                  await repo.setAccountArchived(db, accountId, false);
                  bumpData();
                  router.back();
                }}
              />
            ) : (
              <Button
                title={`${t('common.archive')} / ${t('common.delete')}`}
                variant="ghost"
                onPress={async () => {
                  if (await confirmDeleteAccount(db, accountId)) router.back();
                }}
              />
            )
          ) : null}
        </>
      }
    >
      <Stack.Screen options={{ title: accountId != null ? t('banks.editAccount') : t('banks.addAccount') }} />
      <AccountFields control={form.control} errors={form.formState.errors} />
    </Screen>
  );
}
