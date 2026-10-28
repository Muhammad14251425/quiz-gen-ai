import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '../../components/display';
import { DateTimeField, TextField } from '../../components/fields';
import { AppText, Banner, Button, Chip, Icon, Segmented } from '../../components/ui';
import { useDb } from '../../db/client';
import * as repo from '../../db/repositories';
import type { TxType } from '../../db/types';
import { formatMoney, parseMoneyInput } from '../../domain/money';
import { useDbQuery } from '../../hooks/useDbQuery';
import { t } from '../../i18n';
import { getBankProfile, LOW_CONFIDENCE, type ParsedField } from '../../parser';
import { useTheme } from '../../theme/ThemeProvider';
import type { TxFormValues } from './service';

const schema = z.object({
  amount: z.string().refine((v) => (parseMoneyInput(v) ?? 0) > 0, { message: t('tx.amountRequired') }),
  occurredAt: z.date(),
  counterparty: z.string().max(120),
  reference: z.string().max(80),
  note: z.string().max(500),
  accountId: z
    .number()
    .nullable()
    .refine((v) => v != null, { message: t('tx.accountRequired') }),
  categoryId: z.number().nullable(),
  type: z
    .enum(['sent', 'received'])
    .nullable()
    .refine((v) => v != null, { message: t('tx.typeRequired') }),
});

export interface TransactionFormProps {
  initial: TxFormValues;
  /** quick: big Sent/Received buttons save immediately. edit: type toggle + Save. */
  mode: 'quick' | 'edit';
  onSubmit: (values: TxFormValues) => Promise<void>;
  confidence?: Partial<Record<ParsedField, number>>;
  bankHint?: string;
  /** Local image shown as the receipt thumbnail. */
  imageUri?: string | null;
  suggestedType?: TxType;
  header?: ReactNode;
  footerExtra?: ReactNode;
}

export function TransactionForm({
  initial,
  mode,
  onSubmit,
  confidence,
  bankHint,
  imageUri,
  suggestedType,
  header,
  footerExtra,
}: TransactionFormProps) {
  const db = useDb();
  const { colors, radius } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [memoryHint, setMemoryHint] = useState<{ type: TxType | null; category: string | null } | null>(null);
  const categoryTouched = useRef(initial.categoryId != null);

  const { control, handleSubmit, setValue, formState } = useForm<TxFormValues>({
    defaultValues: initial,
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });
  const errors = formState.errors;
  const counterparty = useWatch({ control, name: 'counterparty' });
  const selectedAccount = useWatch({ control, name: 'accountId' });

  const { data: accounts } = useDbQuery((d) => repo.listAccounts(d, { includeArchived: true }), []);
  const { data: categories } = useDbQuery((d) => repo.listCategories(d), []);
  const visibleAccounts = useMemo(
    () => (accounts ?? []).filter((a) => (!a.archived && !a.bank_archived) || a.id === initial.accountId),
    [accounts, initial.accountId],
  );

  // Counterparty memory: prefill category and suggest the usual direction.
  useEffect(() => {
    const handle = setTimeout(() => {
      repo.suggestForCounterparty(db, counterparty).then((cp) => {
        if (!cp) return setMemoryHint(null);
        const cat = categories?.find((c) => c.id === cp.last_category_id);
        setMemoryHint({ type: cp.last_type, category: cat?.name ?? null });
        if (!categoryTouched.current && cp.last_category_id != null) setValue('categoryId', cp.last_category_id);
      });
    }, 350);
    return () => clearTimeout(handle);
  }, [counterparty, db, categories, setValue]);

  const low = (field: ParsedField, value: string | null | undefined) =>
    confidence !== undefined && (!value || (confidence[field] ?? 0) <= LOW_CONFIDENCE);
  const anyLow =
    confidence !== undefined &&
    (low('amount', initial.amount) ||
      low('counterparty', initial.counterparty) ||
      (confidence.date ?? 0) <= LOW_CONFIDENCE);
  const suggestion = suggestedType ?? memoryHint?.type ?? undefined;

  const submit = (type?: TxType) => {
    if (type) setValue('type', type, { shouldValidate: false });
    return handleSubmit(async (values) => {
      setSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const footer =
    mode === 'quick' ? (
      <>
        <AppText variant="label" muted style={{ textAlign: 'center' }}>
          {t('tx.sentOrReceived')}
        </AppText>
        {errors.accountId ? (
          <AppText variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>
            {errors.accountId.message}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {(['sent', 'received'] as const).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`${type === 'sent' ? t('common.sent') : t('common.received')}${suggestion === type ? `, ${t('tx.suggested')}` : ''}`}
              disabled={submitting}
              onPress={() => submit(type)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 72,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                backgroundColor: type === 'sent' ? colors.sent : colors.received,
                opacity: submitting ? 0.6 : pressed ? 0.85 : 1,
                borderWidth: suggestion === type ? 3 : 0,
                borderColor: colors.text,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={type === 'sent' ? 'arrow-up' : 'arrow-down'} color="#FFFFFF" />
                <AppText variant="title" color="#FFFFFF">
                  {type === 'sent' ? t('common.sent') : t('common.received')}
                </AppText>
              </View>
              {suggestion === type ? (
                <AppText variant="caption" color="#FFFFFF">
                  {t('tx.suggested')}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
        {footerExtra}
      </>
    ) : (
      <>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Segmented
              value={field.value ?? undefined}
              onChange={field.onChange}
              options={[
                { value: 'sent', label: t('common.sent') },
                { value: 'received', label: t('common.received') },
              ]}
            />
          )}
        />
        <Button title={t('common.save')} large loading={submitting} onPress={() => submit()} />
        {footerExtra}
      </>
    );

  return (
    <Screen footer={footer}>
      {header}
      {imageUri ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`${t('tx.receipt')}. ${t('import.tapToZoom')}`}
          onPress={() => router.push({ pathname: '/receipt', params: { uri: imageUri } })}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
        >
          <Image
            source={{ uri: imageUri }}
            style={{ width: 72, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }}
            contentFit="cover"
          />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{t('tx.receipt')}</AppText>
            {bankHint ? (
              <AppText muted>{t('import.detectedBank', { bank: getBankProfile(bankHint)?.name ?? bankHint })}</AppText>
            ) : null}
            <AppText variant="caption" muted>
              {t('import.tapToZoom')}
            </AppText>
          </View>
        </Pressable>
      ) : null}

      {anyLow ? <Banner tone="warning">{t('tx.lowConfidence')}</Banner> : null}

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={t('tx.amount')}
            prefix="Rs"
            large
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="0"
            error={errors.amount?.message}
            highlight={low('amount', initial.amount) && field.value === initial.amount}
          />
        )}
      />
      <Controller
        control={control}
        name="occurredAt"
        render={({ field }) => (
          <DateTimeField
            label={t('tx.dateTime')}
            value={field.value}
            onChange={field.onChange}
            highlight={
              confidence !== undefined && (confidence.date ?? 0) <= LOW_CONFIDENCE && field.value === initial.occurredAt
            }
          />
        )}
      />
      <Controller
        control={control}
        name="counterparty"
        render={({ field }) => (
          <TextField
            label={t('tx.counterparty')}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('tx.counterpartyHint')}
            autoCapitalize="words"
            highlight={low('counterparty', initial.counterparty) && field.value === initial.counterparty}
            hint={memoryHint?.category ? t('tx.usuallyCategory', { category: memoryHint.category }) : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="reference"
        render={({ field }) => (
          <TextField
            label={`${t('tx.reference')} (${t('common.optional')})`}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        )}
      />

      <View style={{ gap: 8 }}>
        <AppText variant="label" muted>
          {t('tx.account')}
        </AppText>
        {visibleAccounts.length === 0 && accounts ? (
          <Button
            title={t('banks.addAccount')}
            icon="add"
            variant="secondary"
            onPress={() => router.push('/bank/edit')}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {visibleAccounts.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedAccount === a.id }}
                accessibilityLabel={`${a.bank_name} ${a.label}`}
                onPress={() => setValue('accountId', a.id, { shouldValidate: !!errors.accountId })}
                style={{
                  minWidth: 140,
                  minHeight: 64,
                  padding: 12,
                  borderRadius: radius.md,
                  borderWidth: selectedAccount === a.id ? 2 : 1,
                  borderColor:
                    selectedAccount === a.id ? colors.primary : errors.accountId ? colors.danger : colors.border,
                  backgroundColor: selectedAccount === a.id ? colors.primaryMuted : colors.surface,
                  gap: 2,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.bank_color }} />
                  <AppText variant="label" numberOfLines={1}>
                    {a.bank_name}
                  </AppText>
                </View>
                <AppText variant="caption" muted numberOfLines={1}>
                  {a.label}
                  {a.last4 ? ` · ${a.last4}` : ''}
                </AppText>
                <AppText variant="caption" muted>
                  {formatMoney(a.balance_minor, a.currency)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {mode === 'edit' && errors.accountId ? (
          <AppText variant="caption" color={colors.danger}>
            {errors.accountId.message}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <AppText variant="label" muted>
          {t('tx.category')} ({t('common.optional')})
        </AppText>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(categories ?? []).map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  selected={field.value === c.id}
                  onPress={() => {
                    categoryTouched.current = true;
                    field.onChange(field.value === c.id ? null : c.id);
                  }}
                />
              ))}
            </View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <TextField
            label={`${t('tx.note')} (${t('common.optional')})`}
            value={field.value}
            onChangeText={field.onChange}
            multiline
          />
        )}
      />
      {mode === 'edit' && errors.type ? (
        <AppText variant="caption" color={colors.danger}>
          {errors.type.message}
        </AppText>
      ) : null}
    </Screen>
  );
}
