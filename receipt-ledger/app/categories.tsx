import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Screen } from '../src/components/display';
import { TextField } from '../src/components/fields';
import { AppText, Button, Card, Divider, Icon } from '../src/components/ui';
import { useDb } from '../src/db/client';
import * as repo from '../src/db/repositories';
import type { Category } from '../src/db/types';
import { useDbQuery } from '../src/hooks/useDbQuery';
import { t } from '../src/i18n';
import { bumpData } from '../src/store/data';
import { useTheme } from '../src/theme/ThemeProvider';
import { BANK_COLOR_CHOICES } from '../src/theme/tokens';

function CategoryEditor({
  initial,
  onDone,
}: {
  initial: Pick<Category, 'name' | 'color'> & { id?: number };
  onDone: () => void;
}) {
  const db = useDb();
  const { colors } = useTheme();
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [error, setError] = useState<string | undefined>();

  const save = async () => {
    if (!name.trim()) return setError(t('banks.nameRequired'));
    try {
      if (initial.id != null) await repo.updateCategory(db, initial.id, { name, color, icon: null });
      else await repo.createCategory(db, { name, color, icon: null });
      bumpData();
      onDone();
    } catch {
      setError(`${name} already exists`);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <TextField label={t('categories.name')} value={name} onChangeText={setName} error={error} autoFocus />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {BANK_COLOR_CHOICES.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityLabel={c}
            accessibilityState={{ checked: c === color }}
            onPress={() => setColor(c)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c,
              borderWidth: c === color ? 3 : 0,
              borderColor: colors.text,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onDone} />
        <Button title={t('common.save')} style={{ flex: 1 }} onPress={() => void save()} />
      </View>
    </Card>
  );
}

export default function CategoriesScreen() {
  const db = useDb();
  const { colors } = useTheme();
  const { data } = useDbQuery((d) => repo.listCategories(d), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  const remove = (c: Category) =>
    Alert.alert(t('categories.deleteTitle', { name: c.name }), t('categories.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await repo.deleteCategory(db, c.id);
          bumpData();
        },
      },
    ]);

  return (
    <Screen>
      {editing === 'new' ? (
        <CategoryEditor initial={{ name: '', color: BANK_COLOR_CHOICES[0] }} onDone={() => setEditing(null)} />
      ) : (
        <Button title={t('categories.add')} icon="add" onPress={() => setEditing('new')} />
      )}
      <Card style={{ paddingVertical: 0 }}>
        {(data ?? []).map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            {editing === c.id ? (
              <View style={{ paddingVertical: 12 }}>
                <CategoryEditor initial={c} onDone={() => setEditing(null)} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color }} />
                <AppText style={{ flex: 1 }}>{c.name}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('common.edit')} ${c.name}`}
                  onPress={() => setEditing(c.id)}
                  hitSlop={8}
                  style={{ padding: 8 }}
                >
                  <Icon name="pencil-outline" size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('common.delete')} ${c.name}`}
                  onPress={() => remove(c)}
                  hitSlop={8}
                  style={{ padding: 8 }}
                >
                  <Icon name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
