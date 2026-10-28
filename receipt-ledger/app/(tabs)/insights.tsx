import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BarList, Screen } from '../../src/components/display';
import { AppText, Card, Icon, ListRow, SectionTitle } from '../../src/components/ui';
import * as repo from '../../src/db/repositories';
import { formatMoney } from '../../src/domain/money';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { useNow } from '../../src/hooks/useNow';
import { t } from '../../src/i18n';
import { useSettings } from '../../src/store/settings';
import { useTheme } from '../../src/theme/ThemeProvider';
import { monthLabel } from '../../src/utils/format';
import { startOfLocalMonth, toLocalParts } from '../../src/utils/timezone';

export default function InsightsScreen() {
  const { colors } = useTheme();
  const currency = useSettings((s) => s.currency);
  const now = toLocalParts(useNow());
  const [ym, setYm] = useState({ year: now.year, month: now.month });
  const range = {
    from: startOfLocalMonth(ym.year, ym.month).getTime(),
    to: startOfLocalMonth(ym.year, ym.month + 1).getTime(),
  };
  const isCurrent = ym.year === now.year && ym.month === now.month;

  const { data } = useDbQuery(
    async (db) => ({
      flow: await repo.flowBetween(db, range, currency),
      people: await repo.spendingBy(db, 'counterparty', range, 'sent', currency),
      categories: await repo.spendingBy(db, 'category', range, 'sent', currency),
      banks: await repo.spendingBy(db, 'bank', range, 'sent', currency),
    }),
    [range.from, currency],
  );

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(ym.year, ym.month - 1 + delta, 1));
    setYm({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };
  const rows = (list: repo.GroupTotal[] | undefined, limit = 8) =>
    (list ?? []).slice(0, limit).map((g) => ({ key: g.key, label: g.label, value: g.total_minor, color: g.color }));
  const net = (data?.flow.received ?? 0) - (data?.flow.sent ?? 0);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
          hitSlop={8}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="chevron-back" />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header">
          {monthLabel(ym.year, ym.month)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => shift(1)}
          hitSlop={8}
          style={{
            width: 48,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isCurrent ? 0.3 : 1,
          }}
        >
          <Icon name="chevron-forward" />
        </Pressable>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[
          { label: t('insights.moneyOut'), value: data?.flow.sent ?? 0, color: colors.sent },
          { label: t('insights.moneyIn'), value: data?.flow.received ?? 0, color: colors.received },
          { label: t('insights.net'), value: net, color: net < 0 ? colors.sent : colors.text },
        ].map((x) => (
          <View key={x.label} style={{ gap: 2, flex: 1 }}>
            <AppText variant="caption" muted>
              {x.label}
            </AppText>
            <AppText variant="label" color={x.color} style={{ fontSize: 15 }}>
              {formatMoney(x.value, currency)}
            </AppText>
          </View>
        ))}
      </Card>

      {/* Out vs in proportion bar */}
      {data && data.flow.sent + data.flow.received > 0 ? (
        <View
          accessible
          accessibilityLabel={`${t('insights.moneyOut')} ${formatMoney(data.flow.sent, currency)}, ${t('insights.moneyIn')} ${formatMoney(data.flow.received, currency)}`}
          style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' }}
        >
          <View style={{ flex: data.flow.sent, backgroundColor: colors.sent }} />
          <View style={{ flex: data.flow.received, backgroundColor: colors.received }} />
        </View>
      ) : null}

      <Card style={{ paddingVertical: 0 }}>
        <ListRow
          icon="map-outline"
          title={t('map.open')}
          subtitle={t('map.openHint')}
          onPress={() => router.push('/map')}
        />
      </Card>

      <Card style={{ gap: 4 }}>
        <SectionTitle>{t('insights.topRecipients')}</SectionTitle>
        <BarList rows={rows(data?.people)} currency={currency} emptyText={t('insights.empty')} />
      </Card>
      <Card style={{ gap: 4 }}>
        <SectionTitle>{t('insights.byCategory')}</SectionTitle>
        <BarList rows={rows(data?.categories, 12)} currency={currency} emptyText={t('insights.empty')} />
      </Card>
      <Card style={{ gap: 4 }}>
        <SectionTitle>{t('insights.byBank')}</SectionTitle>
        <BarList rows={rows(data?.banks, 12)} currency={currency} emptyText={t('insights.empty')} />
      </Card>
    </Screen>
  );
}
