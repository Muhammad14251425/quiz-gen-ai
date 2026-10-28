import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '../../src/components/display';
import { Button } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import * as repo from '../../src/db/repositories';
import { BankFields, presetPatch, useBankForm } from '../../src/features/banks/forms';
import { t } from '../../src/i18n';
import { bumpData } from '../../src/store/data';
import { BANK_COLOR_CHOICES } from '../../src/theme/tokens';

export default function EditBankScreen() {
  const db = useDb();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const bankId = id ? Number(id) : null;
  const form = useBankForm({ preset: null, name: '', color: BANK_COLOR_CHOICES[0] });

  useEffect(() => {
    if (bankId == null) return;
    void repo.getBank(db, bankId).then((b) => b && form.reset({ preset: b.icon, name: b.name, color: b.color }));
  }, [bankId, db, form]);

  const save = form.handleSubmit(async (v) => {
    const input = { name: v.name, color: v.color, icon: v.preset };
    if (bankId != null) {
      await repo.updateBank(db, bankId, input);
      bumpData();
      router.back();
    } else {
      const newId = await repo.createBank(db, input);
      bumpData();
      // A bank is only useful with an account; go straight there.
      router.replace({ pathname: '/account/edit', params: { bankId: String(newId) } });
    }
  });

  return (
    <Screen footer={<Button title={t('common.save')} large loading={form.formState.isSubmitting} onPress={save} />}>
      <Stack.Screen options={{ title: bankId != null ? t('banks.editBank') : t('banks.addBank') }} />
      <BankFields
        control={form.control}
        errors={form.formState.errors}
        onPreset={(p) => {
          const patch = presetPatch(p);
          for (const [k, v] of Object.entries(patch)) form.setValue(k as 'preset' | 'name' | 'color', v as string);
        }}
      />
    </Screen>
  );
}
