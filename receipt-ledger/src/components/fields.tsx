import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { t } from '../i18n';
import { useSettings } from '../store/settings';
import { useTheme } from '../theme/ThemeProvider';
import { HIT } from '../theme/tokens';
import { formatDate, formatTime } from '../utils/format';
import { APP_TZ } from '../utils/timezone';
import { AppText, Button, Icon } from './ui';

interface FieldChrome {
  label: string;
  error?: string;
  hint?: string;
  /** Low-confidence OCR value: highlighted so the user checks it. */
  highlight?: boolean;
}

function FieldFrame({ label, error, hint, highlight, children }: FieldChrome & { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <AppText variant="label" muted>
          {label}
        </AppText>
        {highlight && !error ? (
          <View style={[styles.badge, { backgroundColor: colors.warningMuted }]}>
            <AppText variant="caption" color={colors.warning}>
              {t('common.checkThis')}
            </AppText>
          </View>
        ) : null}
      </View>
      {children}
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  error,
  hint,
  highlight,
  prefix,
  large,
  style,
  ...rest
}: TextInputProps & FieldChrome & { prefix?: string; large?: boolean }) {
  const { colors, radius } = useTheme();
  const borderColor = error ? colors.danger : highlight ? colors.warning : colors.border;
  return (
    <FieldFrame label={label} error={error} hint={hint} highlight={highlight}>
      <View
        style={[
          styles.input,
          {
            borderColor,
            borderWidth: highlight || error ? 2 : 1,
            borderRadius: radius.md,
            backgroundColor: highlight ? colors.warningMuted : colors.surface,
          },
        ]}
      >
        {prefix ? (
          <AppText variant={large ? 'title' : 'body'} muted>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={1.6}
          {...rest}
          style={[{ flex: 1, color: colors.text, fontSize: large ? 26 : 16, fontWeight: large ? '700' : '400' }, style]}
        />
      </View>
    </FieldFrame>
  );
}

/** Date+time field. Times are edited and shown in Asia/Karachi. */
export function DateTimeField({
  label,
  value,
  onChange,
  highlight,
  error,
  mode = 'datetime',
}: FieldChrome & { value: Date; onChange: (d: Date) => void; mode?: 'datetime' | 'date' }) {
  const { colors, radius, dark } = useTheme();
  const fmt = useSettings((s) => s.dateFormat);
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        timeZoneName: APP_TZ,
        onChange: (e: DateTimePickerEvent, date?: Date) => {
          if (e.type !== 'set' || !date) return;
          if (mode === 'date') return onChange(date);
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            timeZoneName: APP_TZ,
            onChange: (e2: DateTimePickerEvent, time?: Date) => {
              if (e2.type === 'set' && time) onChange(time);
            },
          });
        },
      });
    } else {
      setDraft(value);
      setIosOpen(true);
    }
  };

  const text =
    mode === 'date'
      ? formatDate(value.getTime(), fmt)
      : `${formatDate(value.getTime(), fmt)}  ·  ${formatTime(value.getTime())}`;

  return (
    <FieldFrame label={label} highlight={highlight} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        onPress={open}
        style={[
          styles.input,
          {
            borderColor: highlight ? colors.warning : colors.border,
            borderWidth: highlight ? 2 : 1,
            borderRadius: radius.md,
            backgroundColor: highlight ? colors.warningMuted : colors.surface,
          },
        ]}
      >
        <Icon name="calendar-outline" size={20} color={colors.textMuted} />
        <AppText style={{ flex: 1 }}>{text}</AppText>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Modal transparent visible={iosOpen} animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <DateTimePicker
                value={draft}
                mode={mode}
                display="inline"
                themeVariant={dark ? 'dark' : 'light'}
                accentColor={colors.primary}
                timeZoneName={APP_TZ}
                onChange={(_e: DateTimePickerEvent, d?: Date) => d && setDraft(d)}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button
                  title={t('common.cancel')}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => setIosOpen(false)}
                />
                <Button
                  title={t('common.done')}
                  style={{ flex: 1 }}
                  onPress={() => {
                    onChange(draft);
                    setIosOpen(false);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </FieldFrame>
  );
}

export function Switch({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.switchTrack, { backgroundColor: value ? colors.primary : colors.border }]}
    >
      <View style={[styles.switchThumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: HIT, paddingHorizontal: 12 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  modalCard: { padding: 16, gap: 12 },
  switchTrack: { width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
});
