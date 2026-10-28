import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Money, Screen } from '../../src/components/display';
import { Switch } from '../../src/components/fields';
import { AppText, BankAvatar, Button, Card, Divider, EmptyState, ListRow } from '../../src/components/ui';
import * as repo from '../../src/db/repositories';
import { useDbQuery } from '../../src/hooks/useDbQuery';
import { t } from '../../src/i18n';

export default function BanksScreen() {
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useDbQuery(
    async (db) => ({
      banks: await repo.listBanks(db, { includeArchived: showArchived }),
      accounts: await repo.listAccounts(db, { includeArchived: showArchived }),
    }),
    [showArchived],
  );

  if (data && data.banks.length === 0 && !showArchived) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title={t('banks.emptyTitle')}
          body={t('banks.emptyBody')}
          action={<Button title={t('banks.addBank')} icon="add" onPress={() => router.push('/bank/edit')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Button title={t('banks.addBank')} icon="add" onPress={() => router.push('/bank/edit')} />
      {(data?.banks ?? []).map((bank) => {
        const accounts = (data?.accounts ?? []).filter((a) => a.bank_id === bank.id);
        const total = accounts.filter((a) => !a.archived).reduce((s, a) => s + a.balance_minor, 0);
        return (
          <Card
            key={bank.id}
            onPress={() => router.push({ pathname: '/bank/[id]', params: { id: String(bank.id) } })}
            accessibilityLabel={bank.name}
            style={{ gap: 8, opacity: bank.archived ? 0.6 : 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BankAvatar name={bank.name} color={bank.color} />
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{bank.name}</AppText>
                {bank.archived ? (
                  <AppText variant="caption" muted>
                    {t('banks.archived')}
                  </AppText>
                ) : null}
              </View>
              <Money minor={total} currency={accounts[0]?.currency ?? 'PKR'} variant="heading" />
            </View>
            {accounts.length > 0 ? <Divider /> : null}
            {accounts.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <AppText muted numberOfLines={1} style={{ flex: 1 }}>
                  {a.label}
                  {a.last4 ? ` · ${a.last4}` : ''}
                  {a.archived ? ` (${t('banks.archived')})` : ''}
                </AppText>
                <Money minor={a.balance_minor} currency={a.currency} />
              </View>
            ))}
            {accounts.length === 0 ? (
              <AppText variant="caption" muted>
                {t('banks.noAccounts')}
              </AppText>
            ) : null}
          </Card>
        );
      })}
      <ListRow
        title={t('banks.showArchived')}
        right={<Switch value={showArchived} onValueChange={setShowArchived} label={t('banks.showArchived')} />}
      />
    </Screen>
  );
}
