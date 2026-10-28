import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankCard, Money, Screen, TransactionRow } from '../../src/components/display';
import { AppText, Button, Card, EmptyState, SectionTitle } from '../../src/components/ui';
import * as repo from '../../src/db/repositories';
import type { AccountWithBalance } from '../../src/db/types';
import { totalsByCurrency } from '../../src/domain/balance';
import { formatMoney } from '../../src/domain/money';
import { importFromGallery } from '../../src/features/import/pickFromGallery';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { useNow } from '../../src/hooks/useNow';
import { t } from '../../src/i18n';
import { useSettings } from '../../src/store/settings';
import { useTheme } from '../../src/theme/ThemeProvider';
import { dayLabel } from '../../src/utils/format';
import { startOfLocalMonth, toLocalParts } from '../../src/utils/timezone';

interface BankGroup {
  bankId: number;
  name: string;
  color: string;
  currency: string;
  balance: number;
  accounts: number;
}

function groupByBank(accounts: AccountWithBalance[]): BankGroup[] {
  const map = new Map<number, BankGroup>();
  for (const a of accounts) {
    const g = map.get(a.bank_id) ?? {
      bankId: a.bank_id,
      name: a.bank_name,
      color: a.bank_color,
      currency: a.currency,
      balance: 0,
      accounts: 0,
    };
    g.balance += a.balance_minor;
    g.accounts += 1;
    map.set(a.bank_id, g);
  }
  return [...map.values()];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors, radius } = useTheme();
  const currency = useSettings((s) => s.currency);
  const fmt = useSettings((s) => s.dateFormat);

  const now = toLocalParts(useNow());
  const month = {
    from: startOfLocalMonth(now.year, now.month).getTime(),
    to: startOfLocalMonth(now.year, now.month + 1).getTime(),
  };

  const { data, loading, reload } = useDbQuery(
    async (db) => ({
      banks: await repo.listBanks(db),
      accounts: await repo.listAccounts(db),
      recent: await repo.listTransactions(db, { limit: 6 }),
      flow: await repo.flowBetween(db, month, currency),
    }),
    [currency, month.from],
  );

  const totals = useMemo(() => totalsByCurrency(data?.accounts ?? []), [data?.accounts]);
  const banks = useMemo(() => groupByBank(data?.accounts ?? []), [data?.accounts]);
  const otherCurrencies = Object.entries(totals).filter(([c]) => c !== currency);

  if (data && data.banks.length === 0) {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + 48 }}>
        <EmptyState
          icon="wallet-outline"
          title={t('home.emptyTitle')}
          body={t('home.emptyBody')}
          action={<Button title={t('home.emptyAction')} icon="add" onPress={() => router.push('/bank/edit')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading && !!data} onRefresh={reload} contentStyle={{ paddingTop: insets.top + 16 }}>
      <View style={{ gap: 4 }}>
        <AppText variant="label" muted>
          {t('home.totalBalance')}
        </AppText>
        <Money minor={totals[currency] ?? 0} currency={currency} variant="display" />
        {otherCurrencies.map(([c, v]) => (
          <AppText key={c} muted>
            + {formatMoney(v, c)}
          </AppText>
        ))}
      </View>

      <Card style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted>
            {t('home.thisMonth')} · {t('common.sent')}
          </AppText>
          <AppText variant="heading" color={colors.sent}>
            {formatMoney(data?.flow.sent ?? 0, currency)}
          </AppText>
        </View>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" muted>
            {t('home.thisMonth')} · {t('common.received')}
          </AppText>
          <AppText variant="heading" color={colors.received}>
            {formatMoney(data?.flow.received ?? 0, currency)}
          </AppText>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button
          title={t('home.addTransaction')}
          icon="add"
          style={{ flex: 1 }}
          onPress={() => router.push('/transaction/new')}
        />
        <Button
          title={t('home.importGallery')}
          icon="images-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => void importFromGallery()}
        />
      </View>

      <View>
        <SectionTitle
          action={
            <Button title={t('banks.addBank')} variant="ghost" icon="add" onPress={() => router.push('/bank/edit')} />
          }
        >
          {t('tabs.banks')}
        </SectionTitle>
        <View style={{ gap: 10 }}>
          {banks.map((b) => (
            <BankCard
              key={b.bankId}
              name={b.name}
              color={b.color}
              subtitle={`${b.accounts} ${b.accounts === 1 ? 'account' : 'accounts'}`}
              balance={b.balance}
              currency={b.currency}
              onPress={() => router.push({ pathname: '/bank/[id]', params: { id: String(b.bankId) } })}
            />
          ))}
          {data && banks.length === 0 ? <AppText muted>{t('banks.noAccounts')}</AppText> : null}
        </View>
      </View>

      <View>
        <SectionTitle
          action={<Button title={t('home.seeAll')} variant="ghost" onPress={() => router.navigate('/activity')} />}
        >
          {t('home.recent')}
        </SectionTitle>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 }}>
          {(data?.recent ?? []).map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              showDate={dayLabel(tx.occurred_at, fmt, { today: t('common.today'), yesterday: t('common.yesterday') })}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(tx.id) } })}
            />
          ))}
          {data && data.recent.length === 0 ? (
            <AppText muted style={{ paddingVertical: 16 }}>
              {t('home.noTransactions')}
            </AppText>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
