import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Money, Screen, TransactionRow } from '../../src/components/display';
import { AppText, BankAvatar, Button, Card, Divider, ListRow, SectionTitle } from '../../src/components/ui';
import { useDb } from '../../src/db/client';
import * as repo from '../../src/db/repositories';
import { formatMoney } from '../../src/domain/money';
import { confirmDeleteBank } from '../../src/features/banks/actions';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { t } from '../../src/i18n';
import { bumpData } from '../../src/store/data';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function BankDetailScreen() {
  const db = useDb();
  const { colors, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bankId = Number(id);
  const { data } = useDbQuery(
    async (d) => ({
      bank: await repo.getBank(d, bankId),
      accounts: await repo.listAccounts(d, { bankId, includeArchived: true }),
      recent: await repo.listTransactions(d, { bankIds: [bankId], limit: 10 }),
    }),
    [bankId],
  );
  const bank = data?.bank;
  if (!bank) return <Screen>{null}</Screen>;
  const active = data.accounts.filter((a) => !a.archived);
  const total = active.reduce((s, a) => s + a.balance_minor, 0);
  const currency = active[0]?.currency ?? 'PKR';

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: bank.name,
          headerRight: () => (
            <Button
              title={t('common.edit')}
              variant="ghost"
              onPress={() => router.push({ pathname: '/bank/edit', params: { id: String(bank.id) } })}
            />
          ),
        }}
      />
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <BankAvatar name={bank.name} color={bank.color} size={56} />
        <AppText variant="label" muted>
          {t('banks.balance')}
        </AppText>
        <Money minor={total} currency={currency} variant="display" />
        {bank.archived ? <AppText muted>{t('banks.archived')}</AppText> : null}
      </Card>

      <View>
        <SectionTitle
          action={
            <Button
              title={t('banks.addAccount')}
              variant="ghost"
              icon="add"
              onPress={() => router.push({ pathname: '/account/edit', params: { bankId: String(bank.id) } })}
            />
          }
        >
          {t('banks.accounts')}
        </SectionTitle>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 }}>
          {data.accounts.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={`${a.label}${a.last4 ? ` · ${a.last4}` : ''}${a.archived ? ` (${t('banks.archived')})` : ''}`}
                subtitle={`${t('banks.openingBalance')}: ${formatMoney(a.opening_balance_minor, a.currency)}`}
                right={<Money minor={a.balance_minor} currency={a.currency} />}
                onPress={() => router.push({ pathname: '/account/edit', params: { id: String(a.id) } })}
              />
            </View>
          ))}
          {data.accounts.length === 0 ? (
            <AppText muted style={{ paddingVertical: 16 }}>
              {t('banks.noAccounts')}
            </AppText>
          ) : null}
        </View>
      </View>

      <View>
        <SectionTitle
          action={
            <Button
              title={t('home.seeAll')}
              variant="ghost"
              onPress={() => router.navigate({ pathname: '/activity', params: { bankId: String(bank.id) } })}
            />
          }
        >
          {t('home.recent')}
        </SectionTitle>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16 }}>
          {data.recent.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(tx.id) } })}
            />
          ))}
          {data.recent.length === 0 ? (
            <AppText muted style={{ paddingVertical: 16 }}>
              {t('home.noTransactions')}
            </AppText>
          ) : null}
        </View>
      </View>

      {bank.archived ? (
        <Button
          title={t('common.unarchive')}
          variant="secondary"
          icon="archive-outline"
          onPress={async () => {
            await repo.setBankArchived(db, bank.id, false);
            bumpData();
          }}
        />
      ) : (
        <Button
          title={t('common.archive')}
          variant="secondary"
          icon="archive-outline"
          onPress={async () => {
            await repo.setBankArchived(db, bank.id, true);
            bumpData();
          }}
        />
      )}
      <Button
        title={t('common.delete')}
        variant="ghost"
        icon="trash-outline"
        onPress={async () => {
          if (await confirmDeleteBank(db, bank)) router.back();
        }}
      />
    </Screen>
  );
}
