import { Image } from 'expo-image';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import { AppText, Icon } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { CITIES } from './geo/cities';
import { COUNTRIES } from './geo/countries';
import {
  clusterForView,
  heatColor,
  heatIntensity,
  panBy,
  project,
  TILE_SIZE,
  tilesFor,
  toScreen,
  zoomAt,
  type HeatCell,
  type HeatInput,
  type Size,
  type Viewport,
} from './geometry';

/** Outline paths in world units ×1000, built once; a group transform maps them to the screen. */
const PATH_SCALE = 1000;
const OUTLINES = COUNTRIES.map((c) => ({
  name: c.name,
  home: c.home,
  d: c.rings
    .map(
      (ring) =>
        ring
          .map(([lng, lat], i) => {
            const p = project(lat, lng);
            return `${i === 0 ? 'M' : 'L'}${(p.x * PATH_SCALE).toFixed(4)} ${(p.y * PATH_SCALE).toFixed(4)}`;
          })
          .join('') + 'Z',
    )
    .join(''),
}));
const CITY_POINTS = CITIES.map((c) => ({ ...c, p: project(c.lat, c.lng) }));

const OSM_HEADERS = { 'User-Agent': 'ReceiptLedger/1.0 (personal offline finance app)' };

export interface HeatMapProps<T> {
  points: HeatInput<T>[];
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  size: Size;
  onSizeChange: (s: Size) => void;
  /** Weight treated as "moderately hot" (e.g. 3 visits, or 3× a typical amount). */
  heatReference: number;
  /** Shown over the offline map when zoomed in past the outline detail. */
  offlineHint?: string;
  /** Show OpenStreetMap tiles (network) under the heat layer. */
  online: boolean;
  selectedKey: string | null;
  onSelect: (cell: HeatCell<T> | null) => void;
  accessibilityLabel: string;
}

const distance = (a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) =>
  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

export function HeatMap<T>({
  points,
  viewport,
  onViewportChange,
  size,
  onSizeChange,
  online,
  heatReference,
  offlineHint,
  selectedKey,
  onSelect,
  accessibilityLabel,
}: HeatMapProps<T>) {
  const { colors, dark } = useTheme();
  const [failedTiles, setFailedTiles] = useState<Record<string, true>>({});

  const cells = useMemo(() => clusterForView(points, viewport, size), [points, viewport, size]);

  // Latest values for the gesture handlers, which are created once.
  const live = useRef({ viewport, size, cells, onViewportChange, onSelect });
  useLayoutEffect(() => {
    live.current = { viewport, size, cells, onViewportChange, onSelect };
  });
  const gesture = useRef({
    start: viewport,
    pinching: false,
    startDist: 0,
    startMid: { x: 0, y: 0 },
    moved: false,
    lastTap: 0,
    origin: { x: 0, y: 0 },
  });

  /* eslint-disable react-hooks/refs, react-hooks/purity --
     The refs and Date.now() are read inside gesture callbacks, which run on touch, not during render. */
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const g = gesture.current;
          g.start = live.current.viewport;
          g.pinching = false;
          g.moved = false;
          // pageX - locationX gives the map's page offset for converting later touches.
          g.origin = {
            x: e.nativeEvent.pageX - e.nativeEvent.locationX,
            y: e.nativeEvent.pageY - e.nativeEvent.locationY,
          };
        },
        onPanResponderMove: (e, gs) => {
          const g = gesture.current;
          const { size: s, onViewportChange: change } = live.current;
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            const [a, b] = touches;
            const mid = { x: (a.pageX + b.pageX) / 2 - g.origin.x, y: (a.pageY + b.pageY) / 2 - g.origin.y };
            const d = distance(a, b);
            if (!g.pinching) {
              g.pinching = true;
              g.start = live.current.viewport;
              g.startDist = d;
              g.startMid = mid;
            }
            const zoomed = zoomAt(g.start, d / Math.max(1, g.startDist), g.startMid.x, g.startMid.y, s);
            change(panBy(zoomed, mid.x - g.startMid.x, mid.y - g.startMid.y));
            g.moved = true;
          } else if (!g.pinching) {
            change(panBy(g.start, gs.dx, gs.dy));
            if (Math.abs(gs.dx) + Math.abs(gs.dy) > 6) g.moved = true;
          }
        },
        onPanResponderRelease: (e) => {
          const g = gesture.current;
          if (g.moved || g.pinching) return;
          const { locationX: x, locationY: y } = e.nativeEvent;
          const now = Date.now();
          const { viewport: v, size: s, cells: cs, onViewportChange: change, onSelect: select } = live.current;
          if (now - g.lastTap < 300) {
            change(zoomAt(v, 2, x, y, s));
            g.lastTap = 0;
            return;
          }
          g.lastTap = now;
          let best: (typeof cs)[number] | null = null;
          let bestD = 36;
          for (const c of cs) {
            const d = Math.hypot(c.sx - x, c.sy - y);
            if (d < bestD) {
              best = c;
              bestD = d;
            }
          }
          select(best);
        },
      }),
    [],
  );
  /* eslint-enable react-hooks/refs, react-hooks/purity */

  const k = viewport.scale / PATH_SCALE;
  const tx = size.width / 2 - viewport.cx * viewport.scale;
  const ty = size.height / 2 - viewport.cy * viewport.scale;
  const zoom = Math.log2(viewport.scale / TILE_SIZE);
  const tiles = online && size.width > 0 ? tilesFor(viewport, size) : [];

  // Larger cities first; skip labels that would overlap one already placed.
  const placed: { x: number; y: number; w: number }[] = [];
  const cities = CITY_POINTS.filter((c) => c.rank === 1 || (c.rank === 2 && zoom >= 5.6) || (c.rank === 3 && zoom >= 7))
    .map((c) => ({ ...c, s: toScreen(c.p, viewport, size) }))
    .filter((c) => c.s.x > -40 && c.s.y > -20 && c.s.x < size.width + 40 && c.s.y < size.height + 20)
    .filter((c) => {
      const w = c.name.length * (c.rank === 1 ? 7 : 6) + 8;
      if (placed.some((p) => Math.abs(p.y - c.s.y) < 16 && c.s.x < p.x + p.w && p.x < c.s.x + w)) return false;
      placed.push({ x: c.s.x, y: c.s.y, w });
      return true;
    });

  const land = dark ? '#1C2430' : '#FFFFFF';
  const homeLand = dark ? '#223042' : '#F3F7F5';
  const sea = dark ? '#0B1220' : '#DCE8F0';

  return (
    <View
      style={[styles.fill, { backgroundColor: online ? colors.surfaceAlt : sea }]}
      onLayout={(e) => onSizeChange({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      {...responder.panHandlers}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {tiles.map((t) =>
          failedTiles[t.key] ? null : (
            <Image
              key={t.key}
              source={{ uri: `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`, headers: OSM_HEADERS }}
              cachePolicy="disk"
              style={{ position: 'absolute', left: t.left, top: t.top, width: t.size + 0.5, height: t.size + 0.5 }}
              onError={() => setFailedTiles((f) => ({ ...f, [t.key]: true }))}
            />
          ),
        )}
        {size.width > 0 ? (
          <Svg width={size.width} height={size.height}>
            <Defs>
              {cells.map((c) => {
                const color = heatColor(heatIntensity(c.weight, heatReference));
                return (
                  <RadialGradient key={c.key} id={`h${c.key}`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={color} stopOpacity={0.9} />
                    <Stop offset="0.45" stopColor={color} stopOpacity={0.55} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </RadialGradient>
                );
              })}
            </Defs>
            {!online ? (
              <G transform={`translate(${tx} ${ty}) scale(${k})`}>
                {OUTLINES.map((o) => (
                  <Path
                    key={o.name}
                    d={o.d}
                    fill={o.home ? homeLand : land}
                    stroke={o.home ? colors.primary : colors.border}
                    strokeWidth={(o.home ? 1.6 : 0.8) / k}
                  />
                ))}
              </G>
            ) : null}
            {cities.map((c) => (
              <G key={c.name}>
                <Circle cx={c.s.x} cy={c.s.y} r={c.rank === 1 ? 3 : 2.2} fill={colors.textMuted} />
                <SvgText
                  x={c.s.x + 5}
                  y={c.s.y - 4}
                  fontSize={c.rank === 1 ? 12 : 10}
                  fontWeight={c.rank === 1 ? '600' : '400'}
                  fill={online ? '#1F2933' : colors.textMuted}
                >
                  {c.name}
                </SvgText>
              </G>
            ))}
            {cells.map((c) => {
              const r = 16 + 8 * Math.log2(1 + c.count) + 10 * heatIntensity(c.weight, heatReference);
              return <Circle key={c.key} cx={c.sx} cy={c.sy} r={r} fill={`url(#h${c.key})`} />;
            })}
            {cells.map((c) =>
              c.key === selectedKey ? (
                <Circle
                  key={`sel${c.key}`}
                  cx={c.sx}
                  cy={c.sy}
                  r={14}
                  fill="none"
                  stroke={colors.text}
                  strokeWidth={2.5}
                />
              ) : c.count > 1 && zoom >= 9 ? (
                <SvgText
                  key={`n${c.key}`}
                  x={c.sx}
                  y={c.sy + 4}
                  fontSize={11}
                  fontWeight="700"
                  fill="#111"
                  textAnchor="middle"
                >
                  {c.count}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
      </View>
      {!online && offlineHint && zoom >= 10 ? (
        <View
          style={[styles.hint, { backgroundColor: colors.surface, borderColor: colors.border }]}
          pointerEvents="none"
        >
          <AppText variant="caption" muted>
            {offlineHint}
          </AppText>
        </View>
      ) : null}
      {online ? (
        <View style={[styles.attribution, { backgroundColor: 'rgba(255,255,255,0.8)' }]} pointerEvents="none">
          <AppText variant="caption" color="#333" style={{ fontSize: 10 }}>
            © OpenStreetMap contributors
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export function MapButton({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapButton,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  hint: {
    position: 'absolute',
    left: 12,
    top: 12,
    right: 76,
    padding: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attribution: { position: 'absolute', right: 4, bottom: 4, paddingHorizontal: 4, borderRadius: 4 },
  mapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
