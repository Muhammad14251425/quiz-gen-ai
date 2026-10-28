import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionRow } from '../src/components/display';
import { AppText, Button, Chip, Divider, EmptyState, Segmented } from '../src/components/ui';
import { useDb } from '../src/db/client';
import * as repo from '../src/db/repositories';
import type { TransactionView, TxType } from '../src/db/types';
import { formatMoney } from '../src/domain/money';
import { mapsUrl } from '../src/features/location/location';
import { nearestCity } from '../src/features/map/geo/cities';
import {
  clusterForView,
  fitPoints,
  PAKISTAN_VIEW,
  project,
  TILE_SIZE,
  zoomAt,
  type HeatCell,
  type HeatInput,
  type Size,
  type Viewport,
} from '../src/features/map/geometry';
import { HeatMap, MapButton } from '../src/features/map/HeatMap';
import { useDbQuery } from '../src/hooks/useDbQuery';
import { useNow } from '../src/hooks/useNow';
import { t } from '../src/i18n';
import { useSettings } from '../src/store/settings';
import { useTheme } from '../src/theme/ThemeProvider';

type Range = 'last30' | 'last90' | 'lastYear' | 'allTime';
const RANGE_DAYS: Record<Range, number | null> = { last30: 30, last90: 90, lastYear: 365, allTime: null };
type Weighting = 'count' | 'amount';

const ONLINE_AVAILABLE = Constants.expoConfig?.extra?.onlineMapAvailable !== false;

function placeLabel(lat: number, lng: number): string {
  const { city, km } = nearestCity(lat, lng);
  return km < 15 ? t('map.inCity', { city: city.name }) : t('map.near', { city: city.name });
}

/** Most frequent counterparty at a place, to tell nearby places apart. */
function usualPayee(items: TransactionView[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of items) if (tx.counterparty) counts.set(tx.counterparty, (counts.get(tx.counterparty) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function spotSummary(items: TransactionView[], currency: string): string {
  const total = items.reduce((s, tx) => s + tx.amount_minor, 0);
  const amount = formatMoney(total, currency);
  return items.length === 1 ? t('map.spotOne', { amount }) : t('map.spot', { count: items.length, amount });
}

function openInMaps(lat: number, lng: number, label: string) {
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(label)}`
      : mapsUrl(lat, lng, label);
  void Linking.openURL(url);
}

export default function MapScreen() {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const { colors, radius } = useTheme();
  const now = useNow();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const settings = useSettings();
  const currency = settings.currency;

  const [type, setType] = useState<TxType | 'all'>('sent');
  const [range, setRange] = useState<Range>('allTime');
  const [weighting, setWeighting] = useState<Weighting>('count');
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [selected, setSelected] = useState<HeatCell<TransactionView> | null>(null);

  const days = RANGE_DAYS[range];
  const { data } = useDbQuery(
    (d) =>
      repo.listTransactions(d, {
        type: type === 'all' ? undefined : type,
        from: days ? now - days * 86_400_000 : undefined,
      }),
    [type, days, now],
  );

  const { data: locatedCount } = useDbQuery((d) => repo.countLocatedTransactions(d), []);

  const points = useMemo<HeatInput<TransactionView>[]>(
    () =>
      (data ?? [])
        .filter((tx) => tx.latitude != null && tx.longitude != null && tx.account_currency === currency)
        .map((tx) => ({
          ...project(tx.latitude!, tx.longitude!),
          item: tx,
          weight: weighting === 'count' ? 1 : tx.amount_minor,
        })),
    [data, weighting, currency],
  );

  // "Moderately hot": 3 visits, or 3× the median transaction amount.
  const heatReference = useMemo(() => {
    if (weighting === 'count') return 3;
    const amounts = points.map((p) => p.weight).sort((a, b) => a - b);
    return 3 * (amounts[Math.floor(amounts.length / 2)] ?? 1);
  }, [points, weighting]);

  // Initial view: a focused transaction, else all spots, else Pakistan.
  const initialView = useMemo<Viewport | null>(() => {
    if (size.width === 0 || !data) return null;
    if (params.lat && params.lng) {
      const p = project(Number(params.lat), Number(params.lng));
      return { cx: p.x, cy: p.y, scale: TILE_SIZE * 2 ** 14 };
    }
    return points.length ? fitPoints(points, size) : PAKISTAN_VIEW(size);
    // Follows layout and filter changes until the user moves the map; then `viewport` takes over.
  }, [size, data, params.lat, params.lng, points]);
  const view = viewport ?? initialView;

  // Top places at roughly neighbourhood scale (~300 m), independent of the current zoom.
  const topPlaces = useMemo(() => {
    if (points.length === 0) return [];
    const ref: Size = { width: 1e9, height: 1e9 };
    const cells = clusterForView(points, { cx: 0.5, cy: 0.5, scale: TILE_SIZE * 2 ** 15 }, ref, 64);
    return cells
      .map((c) => {
        const lat = c.items.reduce((s, tx) => s + tx.latitude!, 0) / c.items.length;
        const lng = c.items.reduce((s, tx) => s + tx.longitude!, 0) / c.items.length;
        return { key: c.key, lat, lng, items: c.items, total: c.items.reduce((s, tx) => s + tx.amount_minor, 0) };
      })
      .sort((a, b) => (weighting === 'count' ? b.items.length - a.items.length : b.total - a.total))
      .slice(0, 5);
  }, [points, weighting]);

  const toggleStreets = () => {
    if (settings.onlineMap) return void settings.update(db, { onlineMap: false });
    Alert.alert(t('map.streetsTitle'), t('map.streetsBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('map.streetsConfirm'), onPress: () => void settings.update(db, { onlineMap: true }) },
    ]);
  };

  const zoomBy = (factor: number) => view && setViewport(zoomAt(view, factor, size.width / 2, size.height / 2, size));

  if (locatedCount === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        <EmptyState
          icon="map-outline"
          title={t('map.emptyTitle')}
          body={settings.saveLocation ? t('map.emptyOn') : t('map.emptyOff')}
          action={
            settings.saveLocation ? undefined : (
              <Button
                title={t('map.goToSettings')}
                icon="settings-outline"
                onPress={() => router.navigate('/settings')}
              />
            )
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 12, gap: 8 }}>
        <Segmented
          value={type}
          onChange={(v) => {
            setType(v);
            setSelected(null);
          }}
          options={[
            { value: 'sent', label: t('common.sent') },
            { value: 'received', label: t('common.received') },
            { value: 'all', label: t('common.all') },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <Chip
              key={r}
              label={t(`map.${r}`)}
              selected={range === r}
              onPress={() => {
                setRange(r);
                setSelected(null);
              }}
            />
          ))}
          <View style={{ width: 8 }} />
          <Chip label={t('map.count')} selected={weighting === 'count'} onPress={() => setWeighting('count')} />
          <Chip label={t('map.amount')} selected={weighting === 'amount'} onPress={() => setWeighting('amount')} />
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {view ? (
          <HeatMap
            points={points}
            viewport={view}
            onViewportChange={setViewport}
            size={size}
            onSizeChange={setSize}
            online={ONLINE_AVAILABLE && settings.onlineMap}
            heatReference={heatReference}
            offlineHint={ONLINE_AVAILABLE ? t('map.offlineHintStreets') : t('map.offlineHint')}
            selectedKey={selected?.key ?? null}
            onSelect={setSelected}
            accessibilityLabel={t('map.a11y', { count: points.length })}
          />
        ) : (
          <View style={{ flex: 1 }} onLayout={(e) => setSize(e.nativeEvent.layout)} />
        )}
        <View style={{ position: 'absolute', right: 12, top: 12, gap: 8 }}>
          <MapButton icon="add" label={t('map.zoomIn')} onPress={() => zoomBy(2)} />
          <MapButton icon="remove" label={t('map.zoomOut')} onPress={() => zoomBy(0.5)} />
          <MapButton
            icon="scan-outline"
            label={t('map.fit')}
            onPress={() => setViewport(points.length ? fitPoints(points, size) : PAKISTAN_VIEW(size))}
          />
          {ONLINE_AVAILABLE ? (
            <MapButton
              icon={settings.onlineMap ? 'map' : 'map-outline'}
              label={settings.onlineMap ? t('map.streetsOn') : t('map.streetsOff')}
              onPress={toggleStreets}
            />
          ) : null}
        </View>
      </View>

      <View
        style={{
          maxHeight: '42%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingBottom: insets.bottom,
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {selected ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">
                    {placeLabel(selected.items[0].latitude!, selected.items[0].longitude!)}
                  </AppText>
                  <AppText muted>{spotSummary(selected.items, currency)}</AppText>
                </View>
                <Button
                  title={t('tx.openInMaps')}
                  variant="ghost"
                  icon="navigate-outline"
                  onPress={() =>
                    openInMaps(
                      selected.items[0].latitude!,
                      selected.items[0].longitude!,
                      selected.items[0].counterparty ?? '',
                    )
                  }
                />
              </View>
              {selected.items.slice(0, 20).map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(tx.id) } })}
                />
              ))}
            </>
          ) : (
            <>
              <AppText variant="label" muted accessibilityRole="header">
                {t('map.topPlaces').toUpperCase()}
              </AppText>
              {topPlaces.length === 0 ? <AppText muted>{t('insights.empty')}</AppText> : null}
              {topPlaces.map((p, i) => (
                <View key={p.key}>
                  {i > 0 ? <Divider /> : null}
                  <Button
                    title={`${[usualPayee(p.items), placeLabel(p.lat, p.lng)].filter(Boolean).join(' · ')} — ${spotSummary(p.items, currency)}`}
                    variant="ghost"
                    icon="location-outline"
                    style={{ justifyContent: 'flex-start' }}
                    onPress={() => {
                      const w = project(p.lat, p.lng);
                      setViewport({ cx: w.x, cy: w.y, scale: TILE_SIZE * 2 ** 15 });
                      setSelected(null);
                    }}
                  />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
