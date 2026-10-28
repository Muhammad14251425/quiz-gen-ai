import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Platform, View } from 'react-native';

import { AppText, Button, Icon } from '../../components/ui';
import { t } from '../../i18n';
import { useSettings } from '../../store/settings';
import { useTheme } from '../../theme/ThemeProvider';
import { formatPoint, getCurrentPoint, mapsUrl, shouldAttachLocation } from './location';

/** Shown on new transactions: tells the user whether their location will be saved. */
export function LocationNotice({ occurredAt }: { occurredAt: Date }) {
  const enabled = useSettings((s) => s.saveLocation);
  const { colors } = useTheme();
  const willSave = enabled && shouldAttachLocation(occurredAt.getTime());
  // Start a GPS fix while the user reviews the form so saving is instant.
  useEffect(() => {
    if (willSave) void getCurrentPoint();
  }, [willSave]);
  if (!enabled) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name={willSave ? 'location' : 'location-outline'} size={18} color={colors.textMuted} />
      <AppText variant="caption" muted style={{ flex: 1 }}>
        {willSave ? t('tx.locationWillSave') : t('tx.locationTooOld')}
      </AppText>
    </View>
  );
}

/** Shown on an existing transaction: coordinates, open in the maps app, remove. */
export function LocationDetails({
  latitude,
  longitude,
  accuracy,
  label,
  onRemove,
}: {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  label?: string | null;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  if (latitude == null || longitude == null) return null;
  const open = () => {
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(label ?? t('tx.location'))}`
        : mapsUrl(latitude, longitude, label);
    void Linking.openURL(url);
  };
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label" muted>
        {t('tx.location')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="location" size={20} color={colors.primary} />
        <AppText selectable style={{ flex: 1 }}>
          {formatPoint(latitude, longitude)}
          {accuracy != null ? `  ${t('tx.locationAccuracy', { meters: Math.round(accuracy) })}` : ''}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button
          title={t('map.showOnMap')}
          icon="flame-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/map', params: { lat: String(latitude), lng: String(longitude) } })}
        />
        <Button title={t('tx.openInMaps')} icon="map-outline" variant="secondary" style={{ flex: 1 }} onPress={open} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button title={t('tx.removeLocation')} variant="ghost" style={{ flex: 1 }} onPress={onRemove} />
      </View>
    </View>
  );
}
