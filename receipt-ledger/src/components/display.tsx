import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TransactionView } from '../db/types';
import { formatMoney } from '../domain/money';
import { useToast } from '../features/toast/store';
import { t } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { formatTime } from '../utils/format';
import { AppText, BankAvatar, Icon } from './ui';

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  refreshing,
  onRefresh,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? { padding: 16, gap: 16 } : null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { paddingBottom: footer ? 16 : 32 + insets.bottom }, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: 12 + insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Money({
  minor,
  currency = 'PKR',
  type,
  variant = 'body',
  sign,
}: {
  minor: number;
  currency?: string;
  type?: 'sent' | 'received';
  variant?: 'display' | 'title' | 'heading' | 'body' | 'label';
  sign?: boolean;
}) {
  const { colors } = useTheme();
  const signed = type === 'sent' ? -minor : minor;
  const color =
    type === 'sent' ? colors.sent : type === 'received' ? colors.received : minor < 0 ? colors.sent : colors.text;
  return (
    <AppText variant={variant} color={color} style={{ fontVariant: ['tabular-nums'] }}>
      {formatMoney(type ? signed : minor, currency, { sign: sign ?? !!type })}
    </AppText>
  );
}

export function TransactionRow({
  tx,
  onPress,
  showDate,
}: {
  tx: TransactionView;
  onPress?: () => void;
  showDate?: string;
}) {
  const { colors } = useTheme();
  const name = tx.counterparty || (tx.type === 'sent' ? t('common.sent') : t('common.received'));
  const amountLabel = formatMoney(tx.type === 'sent' ? -tx.amount_minor : tx.amount_minor, tx.account_currency);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${tx.type === 'sent' ? t('common.sent') : t('common.received')} ${amountLabel}, ${tx.bank_name} ${tx.account_label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.txRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.txIcon, { backgroundColor: tx.type === 'sent' ? colors.sentMuted : colors.receivedMuted }]}>
        <Icon
          name={tx.type === 'sent' ? 'arrow-up' : 'arrow-down'}
          size={20}
          color={tx.type === 'sent' ? colors.sent : colors.received}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {[showDate ?? formatTime(tx.occurred_at), `${tx.bank_name} · ${tx.account_label}`, tx.category_name]
            .filter(Boolean)
            .join('  ·  ')}
        </AppText>
      </View>
      <Money minor={tx.amount_minor} currency={tx.account_currency} type={tx.type} />
    </Pressable>
  );
}

export function BarList({
  rows,
  currency,
  emptyText,
}: {
  rows: { key: string; label: string; value: number; color?: string | null }[];
  currency: string;
  emptyText: string;
}) {
  const { colors, radius } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <AppText muted>{emptyText}</AppText>;
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <View
          key={r.key}
          style={{ gap: 4 }}
          accessible
          accessibilityLabel={`${r.label}: ${formatMoney(r.value, currency)}`}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <AppText numberOfLines={1} style={{ flex: 1 }}>
              {r.label}
            </AppText>
            <AppText style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(r.value, currency)}</AppText>
          </View>
          <View
            style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
          >
            <View
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: r.color ?? colors.primary,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function BankCard({
  name,
  color,
  subtitle,
  balance,
  currency,
  onPress,
}: {
  name: string;
  color: string;
  subtitle: string;
  balance: number;
  currency: string;
  onPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}, ${formatMoney(balance, currency)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bankCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.bankStripe,
          { backgroundColor: color, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
        ]}
      />
      <BankAvatar name={name} color={color} />
      <View style={{ flex: 1 }}>
        <AppText variant="heading" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" muted>
          {subtitle}
        </AppText>
      </View>
      <Money minor={balance} currency={currency} variant="heading" />
    </Pressable>
  );
}

/** Global toast with optional action (used for "Saved · Undo"). */
export function ToastHost() {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, { toValue: toast ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [toast, anim]);

  if (!toast) return null;
  const icon =
    toast.tone === 'error' ? 'alert-circle' : toast.tone === 'info' ? 'information-circle' : 'checkmark-circle';
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrap,
        {
          top: insets.top + 8,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.text, borderRadius: radius.md }]}
      >
        <Icon name={icon} size={20} color={colors.background} />
        <AppText color={colors.background} style={{ flex: 1 }}>
          {toast.message}
        </AppText>
        {toast.actionLabel ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              toast.onAction?.();
              hide();
            }}
            style={{ paddingHorizontal: 8, minHeight: 36, justifyContent: 'center' }}
          >
            <AppText variant="label" color={colors.primaryMuted} style={{ fontSize: 15 }}>
              {toast.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingLeft: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  bankStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  toastWrap: { position: 'absolute', left: 16, right: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 52 },
});
