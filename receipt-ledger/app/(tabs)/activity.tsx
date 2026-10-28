import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '../../src/components/display';
import { DateTimeField } from '../../src/components/fields';
import { AppText, Button, Chip, EmptyState, Icon, Segmented } from '../../src/components/ui';
import * as repo from '../../src/db/repositories';
import type { TransactionView } from '../../src/db/types';
import { formatMoney } from '../../src/domain/money';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  toggle,
  toTxFilter,
  type ActivityFilters,
  type RangePreset,
} from '../../src/features/transactions/filters';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { useNow } from '../../src/hooks/useNow';
import { t } from '../../src/i18n';
import { useSettings } from '../../src/store/settings';
import { useTheme } from '../../src/theme/ThemeProvider';
import { dayLabel } from '../../src/utils/format';
import { localDayKey } from '../../src/utils/timezone';

interface Section {
  key: string;
  title: string;
  net: number;
  currency: string;
  data: TransactionView[];
}

function groupByDay(txs: TransactionView[], label: (ms: number) => string): Section[] {
  const sections: Section[] = [];
  for (const tx of txs) {
    const key = localDayKey(tx.occurred_at);
    let s = sections[sections.length - 1];
    if (!s || s.key !== key) {
      s = { key, title: label(tx.occurred_at), net: 0, currency: tx.account_currency, data: [] };
      sections.push(s);
    }
    s.data.push(tx);
    s.net += tx.type === 'sent' ? -tx.amount_minor : tx.amount_minor;
  }
  return sections;
}

const RANGES: { value: RangePreset; key: 'allTime' | 'thisMonth' | 'lastMonth' | 'last30' | 'custom' }[] = [
  { value: 'all', key: 'allTime' },
  { value: 'thisMonth', key: 'thisMonth' },
  { value: 'lastMonth', key: 'lastMonth' },
  { value: 'last30', key: 'last30' },
  { value: 'custom', key: 'custom' },
];

function FilterSheet({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: ActivityFilters;
  onClose: () => void;
  onApply: (f: ActivityFilters) => void;
}) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  // Remounted (via key) each time it opens, so the draft starts from the applied filters.
  const [draft, setDraft] = useState(value);
  const now = useNow();
  const { data } = useDbQuery(
    async (db) => ({
      banks: await repo.listBanks(db, { includeArchived: true }),
      accounts: await repo.listAccounts(db, { includeArchived: true }),
      categories: await repo.listCategories(db),
    }),
    [],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlay }}
        onPress={onClose}
        accessibilityLabel={t('common.cancel')}
      />
      <View
        style={{
          maxHeight: '85%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <AppText variant="title" accessibilityRole="header">
            {t('activity.filters')}
          </AppText>

          <AppText variant="label" muted>
            {t('activity.range')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RANGES.map((r) => (
              <Chip
                key={r.value}
                label={t(`activity.${r.key}`)}
                selected={draft.range === r.value}
                onPress={() => setDraft({ ...draft, range: r.value })}
              />
            ))}
          </View>
          {draft.range === 'custom' ? (
            <View style={{ gap: 12 }}>
              <DateTimeField
                mode="date"
                label={t('activity.from')}
                value={new Date(draft.customFrom ?? now - 30 * 86_400_000)}
                onChange={(d) => setDraft({ ...draft, customFrom: d.getTime() })}
              />
              <DateTimeField
                mode="date"
                label={t('activity.to')}
                value={new Date(draft.customTo ?? now)}
                onChange={(d) => setDraft({ ...draft, customTo: d.getTime() })}
              />
            </View>
          ) : null}

          <AppText variant="label" muted>
            {t('tx.type')}
          </AppText>
          <Segmented
            value={draft.type ?? 'all'}
            onChange={(v) => setDraft({ ...draft, type: v === 'all' ? null : v })}
            options={[
              { value: 'all', label: t('common.all') },
              { value: 'sent', label: t('common.sent') },
              { value: 'received', label: t('common.received') },
            ]}
          />

          <AppText variant="label" muted>
            {t('activity.bank')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(data?.banks ?? []).map((b) => (
              <Chip
                key={b.id}
                label={b.name}
                color={b.color}
                selected={draft.bankIds.includes(b.id)}
                onPress={() => setDraft({ ...draft, bankIds: toggle(draft.bankIds, b.id) })}
              />
            ))}
          </View>

          <AppText variant="label" muted>
            {t('tx.account')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(data?.accounts ?? []).map((a) => (
              <Chip
                key={a.id}
                label={`${a.bank_name} · ${a.label}`}
                color={a.bank_color}
                selected={draft.accountIds.includes(a.id)}
                onPress={() => setDraft({ ...draft, accountIds: toggle(draft.accountIds, a.id) })}
              />
            ))}
          </View>

          <AppText variant="label" muted>
            {t('tx.category')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(data?.categories ?? []).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={draft.categoryIds.includes(c.id)}
                onPress={() => setDraft({ ...draft, categoryIds: toggle(draft.categoryIds, c.id) })}
              />
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
          <Button
            title={t('common.clear')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => onApply({ ...EMPTY_FILTERS, search: value.search })}
          />
          <Button title={t('common.apply')} style={{ flex: 1 }} onPress={() => onApply(draft)} />
        </View>
      </View>
    </Modal>
  );
}

export default function ActivityScreen() {
  const { colors, radius } = useTheme();
  const fmt = useSettings((s) => s.dateFormat);
  const params = useLocalSearchParams<{ bankId?: string; accountId?: string }>();
  const fromParams = (): ActivityFilters => ({
    ...EMPTY_FILTERS,
    bankIds: params.bankId ? [Number(params.bankId)] : [],
    accountIds: params.accountId ? [Number(params.accountId)] : [],
  });
  const [filters, setFilters] = useState<ActivityFilters>(fromParams);
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(false);

  // Links from a bank or account page pre-apply a filter (adjust state during render, not in an effect).
  const paramKey = `${params.bankId ?? ''}|${params.accountId ?? ''}`;
  const [seenParamKey, setSeenParamKey] = useState(paramKey);
  if (paramKey !== seenParamKey) {
    setSeenParamKey(paramKey);
    setFilters(fromParams());
  }

  // Debounce typing.
  useEffect(() => {
    const h = setTimeout(() => setFilters((f) => (f.search === search ? f : { ...f, search })), 250);
    return () => clearTimeout(h);
  }, [search]);

  const query = useMemo(() => toTxFilter(filters), [filters]);
  const { data, loading, reload } = useDbQuery((db) => repo.listTransactions(db, query), [query]);
  const sections = useMemo(
    () =>
      groupByDay(data ?? [], (ms) => dayLabel(ms, fmt, { today: t('common.today'), yesterday: t('common.yesterday') })),
    [data, fmt],
  );
  const count = activeFilterCount(filters);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            minHeight: 48,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('activity.search')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('activity.search')}
            style={{ flex: 1, color: colors.text, fontSize: 16 }}
            returnKeyType="search"
            maxFontSizeMultiplier={1.6}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('activity.filters')}${count ? ` (${count})` : ''}`}
          onPress={() => setSheet(true)}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: count ? colors.primaryMuted : colors.surface,
            borderWidth: 1,
            borderColor: count ? colors.primary : colors.border,
          }}
        >
          <Icon name="options-outline" color={count ? colors.primary : colors.text} />
          {count ? (
            <View
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" color={colors.onPrimary} style={{ fontSize: 10 }}>
                {count}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(tx) => String(tx.id)}
        refreshing={loading && !!data}
        onRefresh={reload}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 8,
              backgroundColor: colors.background,
            }}
          >
            <AppText variant="label" muted accessibilityRole="header">
              {section.title}
            </AppText>
            <AppText variant="label" muted>
              {formatMoney(section.net, section.currency, { sign: true })}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(item.id) } })}
          />
        )}
        ListEmptyComponent={
          data ? (
            <EmptyState
              icon="receipt-outline"
              title={count || filters.search ? t('activity.empty') : t('home.noTransactions')}
            />
          ) : undefined
        }
      />
      <FilterSheet
        key={sheet ? 'open' : 'closed'}
        visible={sheet}
        value={filters}
        onClose={() => setSheet(false)}
        onApply={(f) => {
          setFilters({ ...f, search: filters.search });
          setSheet(false);
        }}
      />
    </View>
  );
}
