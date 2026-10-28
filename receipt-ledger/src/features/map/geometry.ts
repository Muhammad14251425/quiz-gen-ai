/**
 * Web Mercator maths for the transaction map. World coordinates are in [0, 1];
 * a viewport scale is "pixels per world unit" (256 · 2^zoom), so offline
 * outlines, heat spots and online OSM tiles all line up.
 */

export interface WorldPoint {
  x: number;
  y: number;
}

export interface Viewport {
  /** Center in world units. */
  cx: number;
  cy: number;
  /** Pixels per world unit. */
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

export const TILE_SIZE = 256;
export const MIN_SCALE = TILE_SIZE * 2 ** 3; // whole region
export const MAX_SCALE = TILE_SIZE * 2 ** 18; // street level

const MAX_LAT = 85.05112878;

export function project(lat: number, lng: number): WorldPoint {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

export function unproject(p: WorldPoint): { lat: number; lng: number } {
  const lng = p.x * 360 - 180;
  const n = Math.PI - 2 * Math.PI * p.y;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function toScreen(p: WorldPoint, v: Viewport, size: Size): { x: number; y: number } {
  return { x: (p.x - v.cx) * v.scale + size.width / 2, y: (p.y - v.cy) * v.scale + size.height / 2 };
}

export function toWorld(sx: number, sy: number, v: Viewport, size: Size): WorldPoint {
  return { x: v.cx + (sx - size.width / 2) / v.scale, y: v.cy + (sy - size.height / 2) / v.scale };
}

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/** Zooms by `factor` keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number, size: Size): Viewport {
  const anchor = toWorld(sx, sy, v, size);
  const scale = clampScale(v.scale * factor);
  return {
    scale,
    cx: anchor.x - (sx - size.width / 2) / scale,
    cy: anchor.y - (sy - size.height / 2) / scale,
  };
}

export function panBy(v: Viewport, dx: number, dy: number): Viewport {
  return { ...v, cx: v.cx - dx / v.scale, cy: v.cy - dy / v.scale };
}

/** Viewport showing all points with padding; a single point gets a city-level zoom. */
export function fitPoints(points: WorldPoint[], size: Size, padding = 48): Viewport {
  if (points.length === 0) return PAKISTAN_VIEW(size);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-9);
  const h = Math.max(maxY - minY, 1e-9);
  const scale = clampScale(
    Math.min((size.width - padding * 2) / w, (size.height - padding * 2) / h, TILE_SIZE * 2 ** 14),
  );
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale };
}

/** Whole of Pakistan. */
export function PAKISTAN_VIEW(size: Size): Viewport {
  const nw = project(37.2, 60.8);
  const se = project(23.6, 77.9);
  const scale = clampScale(Math.min(size.width / (se.x - nw.x), size.height / (se.y - nw.y)) * 0.95);
  return { cx: (nw.x + se.x) / 2, cy: (nw.y + se.y) / 2, scale };
}

export interface HeatInput<T> extends WorldPoint {
  item: T;
  weight: number;
}

export interface HeatCell<T> {
  key: string;
  /** Screen position (weighted centroid). */
  sx: number;
  sy: number;
  count: number;
  weight: number;
  items: T[];
}

/**
 * Groups points into screen-space grid cells at the current zoom. Zooming in
 * splits hotspots apart; zooming out merges them, like a heat map.
 */
export function clusterForView<T>(points: HeatInput<T>[], v: Viewport, size: Size, cellPx = 28): HeatCell<T>[] {
  const cells = new Map<string, HeatCell<T> & { wx: number; wy: number }>();
  const margin = cellPx * 2;
  for (const p of points) {
    const s = toScreen(p, v, size);
    if (s.x < -margin || s.y < -margin || s.x > size.width + margin || s.y > size.height + margin) continue;
    // Grid anchored in world space so cells don't jitter while panning.
    const gx = Math.floor((p.x * v.scale) / cellPx);
    const gy = Math.floor((p.y * v.scale) / cellPx);
    const key = `${gx}:${gy}`;
    const c = cells.get(key) ?? { key, sx: 0, sy: 0, wx: 0, wy: 0, count: 0, weight: 0, items: [] };
    c.count += 1;
    c.weight += p.weight;
    c.wx += s.x;
    c.wy += s.y;
    c.items.push(p.item);
    cells.set(key, c);
  }
  return [...cells.values()].map(({ wx, wy, ...c }) => ({ ...c, sx: wx / c.count, sy: wy / c.count }));
}

export interface Tile {
  key: string;
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
}

/** OSM tiles covering the viewport at the nearest integer zoom. */
export function tilesFor(v: Viewport, size: Size, maxZoom = 19): Tile[] {
  const z = Math.max(0, Math.min(maxZoom, Math.round(Math.log2(v.scale / TILE_SIZE))));
  const n = 2 ** z;
  const tileSize = v.scale / n;
  const topLeft = toWorld(0, 0, v, size);
  const bottomRight = toWorld(size.width, size.height, v, size);
  const x0 = Math.floor(topLeft.x * n);
  const x1 = Math.floor(bottomRight.x * n);
  const y0 = Math.max(0, Math.floor(topLeft.y * n));
  const y1 = Math.min(n - 1, Math.floor(bottomRight.y * n));
  const tiles: Tile[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const wrapped = ((x % n) + n) % n;
      const s = toScreen({ x: x / n, y: y / n }, v, size);
      tiles.push({ key: `${z}/${x}/${y}`, z, x: wrapped, y, left: s.x, top: s.y, size: tileSize });
    }
  }
  return tiles;
}

/**
 * Absolute heat intensity in [0, 1): `reference` is the weight that counts as
 * "moderately hot" (≈0.63). Absolute, so a single visit stays cool at any zoom.
 */
export function heatIntensity(weight: number, reference: number): number {
  return 1 - Math.exp(-weight / Math.max(reference, 1e-9));
}

/** Heat colour from cool (few) to hot (many). `t` in [0, 1]. */
export function heatColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [56, 189, 248]],
    [0.35, [250, 204, 21]],
    [0.7, [249, 115, 22]],
    [1, [220, 38, 38]],
  ];
  const c = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (c <= t1) {
      const f = (c - t0) / (t1 - t0);
      const mix = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  return 'rgb(220,38,38)';
}
