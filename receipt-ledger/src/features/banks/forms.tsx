import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control, type FieldErrors } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { TextField } from '../../components/fields';
import { AppText, BankAvatar, Chip } from '../../components/ui';
import { CURRENCIES, parseMoneyInput } from '../../domain/money';
import { t } from '../../i18n';
import { BANK_PROFILES } from '../../parser';
import { useTheme } from '../../theme/ThemeProvider';
import { BANK_COLOR_CHOICES } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

export const bankSchema = z.object({
  preset: z.string().nullable(),
  name: z.string().trim().min(1, t('banks.nameRequired')).max(60),
  color: z.string(),
});
export type BankFormValues = z.infer<typeof bankSchema>;

export function useBankForm(initial: BankFormValues) {
  return useForm<BankFormValues>({ defaultValues: initial, resolver: zodResolver(bankSchema) });
}

export function BankFields({
  control,
  errors,
  onPreset,
}: {
  control: Control<BankFormValues>;
  errors: FieldErrors<BankFormValues>;
  onPreset: (preset: string | null) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <AppText variant="label" muted>
        {t('banks.preset')}
      </AppText>
      <Controller
        control={control}
        name="preset"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BANK_PROFILES.filter((p) => p.kind !== 'rail').map((p) => {
              const selected = field.value === p.id;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={p.name}
                  onPress={() => onPreset(p.id)}
                  style={{
                    width: '31%',
                    minHeight: 84,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: radius.md,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primaryMuted : colors.surface,
                  }}
                >
                  <BankAvatar name={p.name} color={p.color} size={32} />
                  <AppText variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
                    {p.name}
                  </AppText>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: field.value === null }}
              accessibilityLabel={t('banks.custom')}
              onPress={() => onPreset(null)}
              style={{
                width: '31%',
                minHeight: 84,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                borderRadius: radius.md,
                borderWidth: field.value === null ? 2 : 1,
                borderColor: field.value === null ? colors.primary : colors.border,
                backgroundColor: field.value === null ? colors.primaryMuted : colors.surface,
              }}
            >
              <AppText variant="label">{t('banks.custom')}</AppText>
            </Pressable>
          </View>
        )}
      />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label={t('banks.bankName')}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.name?.message}
            autoCapitalize="words"
          />
        )}
      />
      <AppText variant="label" muted>
        {t('banks.color')}
      </AppText>
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} accessibilityRole="radiogroup">
            {BANK_COLOR_CHOICES.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityLabel={c}
                accessibilityState={{ checked: field.value === c }}
                onPress={() => field.onChange(c)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c,
                  borderWidth: field.value === c ? 3 : 0,
                  borderColor: colors.text,
                }}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}

/** Applies a preset: fills name and brand color. */
export function presetPatch(preset: string | null): Partial<BankFormValues> {
  const p = BANK_PROFILES.find((x) => x.id === preset);
  return p ? { preset: p.id, name: p.name, color: p.color } : { preset: null };
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  label: z.string().trim().min(1, t('banks.labelRequired')).max(40),
  last4: z.string().trim().max(20),
  currency: z.string(),
  // Opening balance may be negative (e.g. an overdrawn account) or zero.
  opening: z.string().refine((v) => v.trim() === '' || parseMoneyInput(v.replace(/^-/, '')) !== null, {
    message: t('tx.amountRequired'),
  }),
});
export type AccountFormValues = z.infer<typeof accountSchema>;

export function parseOpening(v: string): number {
  const negative = v.trim().startsWith('-');
  const minor = parseMoneyInput(v.replace(/^-/, '')) ?? 0;
  return negative ? -minor : minor;
}

export function useAccountForm(initial: AccountFormValues) {
  return useForm<AccountFormValues>({ defaultValues: initial, resolver: zodResolver(accountSchema) });
}

export function AccountFields({
  control,
  errors,
}: {
  control: Control<AccountFormValues>;
  errors: FieldErrors<AccountFormValues>;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Controller
        control={control}
        name="label"
        render={({ field }) => (
          <TextField
            label={t('banks.accountLabel')}
            placeholder={t('banks.accountLabelHint')}
            value={field.value}
            onChangeText={field.onChange}
            error={errors.label?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="last4"
        render={({ field }) => (
          <TextField
            label={`${t('banks.last4')} (${t('common.optional')})`}
            value={field.value}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="opening"
        render={({ field }) => (
          <TextField
            label={t('banks.openingBalance')}
            hint={t('banks.openingBalanceHint')}
            prefix="Rs"
            keyboardType="numbers-and-punctuation"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="0"
            error={errors.opening?.message}
          />
        )}
      />
      <AppText variant="label" muted>
        {t('banks.currency')}
      </AppText>
      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CURRENCIES.map((c) => (
              <Chip
                key={c.code}
                label={c.code}
                selected={field.value === c.code}
                onPress={() => field.onChange(c.code)}
              />
            ))}
          </View>
        )}
      />
    </View>
  );
}
