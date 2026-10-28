import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { HIT, typography } from '../theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color ?? colors.text} accessible={false} />;
}

type Variant = keyof typeof typography;

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typography[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]}
    />
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  large,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, radius } = useTheme();
  const bg = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: colors.textInverse,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          minHeight: large ? 60 : HIT,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <AppText variant={large ? 'heading' : 'label'} color={fg} style={{ fontSize: large ? 18 : 15 }}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
}) {
  const { colors, radius } = useTheme();
  const base = [
    { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border },
    styles.card,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string | null;
  icon?: IconName;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.primaryMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {icon ? <Icon name={icon} size={16} color={selected ? colors.primary : colors.textMuted} /> : null}
      <AppText variant="label" color={selected ? colors.primary : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.segmented, { backgroundColor: colors.surfaceAlt, borderRadius: radius.md }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              { borderRadius: radius.sm, backgroundColor: selected ? colors.surface : 'transparent' },
            ]}
          >
            <AppText variant="label" color={selected ? colors.text : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? <Icon name={icon} color={danger ? colors.danger : colors.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <AppText color={danger ? colors.danger : undefined}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <AppText
        variant="label"
        muted
        style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
        accessibilityRole="header"
      >
        {children}
      </AppText>
      {action}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryMuted }]}>
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'warning' | 'info'; children: string }) {
  const { colors, radius } = useTheme();
  const bg = tone === 'warning' ? colors.warningMuted : colors.primaryMuted;
  const fg = tone === 'warning' ? colors.warning : colors.primary;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: bg, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 8 }}
    >
      <Icon name={tone === 'warning' ? 'alert-circle' : 'information-circle'} size={20} color={fg} />
      <AppText variant="caption" color={fg} style={{ flex: 1, fontSize: 13 }}>
        {children}
      </AppText>
    </View>
  );
}

export function BankAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.38 } as TextStyle}
        allowFontScaling={false}
      >
        {initials || '•'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
