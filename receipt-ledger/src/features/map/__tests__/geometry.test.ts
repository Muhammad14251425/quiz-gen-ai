import { haversineKm, nearestCity } from '../geo/cities';
import { COUNTRIES } from '../geo/countries';
import {
  clusterForView,
  fitPoints,
  heatColor,
  heatIntensity,
  MAX_SCALE,
  MIN_SCALE,
  PAKISTAN_VIEW,
  panBy,
  project,
  TILE_SIZE,
  tilesFor,
  toScreen,
  toWorld,
  unproject,
  zoomAt,
} from '../geometry';

const size = { width: 400, height: 600 };

describe('projection', () => {
  it('round-trips coordinates', () => {
    const p = project(24.8607, 67.0011);
    const back = unproject(p);
    expect(back.lat).toBeCloseTo(24.8607, 6);
    expect(back.lng).toBeCloseTo(67.0011, 6);
  });

  it('matches OSM tile numbering (Karachi at zoom 10 is tile 702/438)', () => {
    const p = project(24.8607, 67.0011);
    expect(Math.floor(p.x * 2 ** 10)).toBe(702);
    expect(Math.floor(p.y * 2 ** 10)).toBe(438);
  });

  it('converts between world and screen', () => {
    const v = { cx: 0.6, cy: 0.4, scale: TILE_SIZE * 2 ** 10 };
    const s = toScreen({ x: 0.6, y: 0.4 }, v, size);
    expect(s).toEqual({ x: 200, y: 300 });
    const w = toWorld(250, 100, v, size);
    expect(toScreen(w, v, size).x).toBeCloseTo(250);
    expect(toScreen(w, v, size).y).toBeCloseTo(100);
  });
});

describe('zoom and pan', () => {
  const v = { cx: 0.68, cy: 0.42, scale: TILE_SIZE * 2 ** 8 };

  it('keeps the point under the fingers fixed while zooming', () => {
    const before = toWorld(100, 450, v, size);
    const z = zoomAt(v, 3, 100, 450, size);
    const after = toWorld(100, 450, z, size);
    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
    expect(z.scale).toBeCloseTo(v.scale * 3);
  });

  it('clamps zoom between region and street level', () => {
    expect(zoomAt(v, 1e-9, 0, 0, size).scale).toBe(MIN_SCALE);
    expect(zoomAt(v, 1e9, 0, 0, size).scale).toBe(MAX_SCALE);
  });

  it('moves content with the finger', () => {
    const p = { x: 0.68, y: 0.42 };
    const moved = panBy(v, 30, -20);
    const a = toScreen(p, v, size);
    const b = toScreen(p, moved, size);
    expect(b.x - a.x).toBeCloseTo(30);
    expect(b.y - a.y).toBeCloseTo(-20);
  });
});

describe('fitting', () => {
  it('fits all points on screen with padding', () => {
    const pts = [project(24.86, 67.0), project(31.52, 74.36), project(33.68, 73.05)];
    const v = fitPoints(pts, size, 48);
    for (const p of pts) {
      const s = toScreen(p, v, size);
      expect(s.x).toBeGreaterThanOrEqual(47.9);
      expect(s.x).toBeLessThanOrEqual(size.width - 47.9);
      expect(s.y).toBeGreaterThanOrEqual(47.9);
      expect(s.y).toBeLessThanOrEqual(size.height - 47.9);
    }
  });

  it('zooms a single point to city level, not to infinity', () => {
    const v = fitPoints([project(24.86, 67.0)], size);
    expect(v.scale).toBeLessThanOrEqual(TILE_SIZE * 2 ** 14);
  });

  it('shows Pakistan by default', () => {
    const v = PAKISTAN_VIEW(size);
    for (const [lat, lng] of [
      [24.86, 67.0],
      [35.92, 74.31],
      [25.13, 62.32],
    ]) {
      const s = toScreen(project(lat, lng), v, size);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(size.width);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(size.height);
    }
  });
});

describe('heat clustering', () => {
  const pts = [
    { ...project(24.8031, 67.0637), item: 'dha-1', weight: 1 },
    { ...project(24.8032, 67.0638), item: 'dha-2', weight: 1 },
    { ...project(24.918, 67.0971), item: 'gulshan', weight: 1 },
    { ...project(31.512, 74.3456), item: 'lahore', weight: 1 },
  ];

  it('merges nearby spots when zoomed out and splits them when zoomed in', () => {
    const out = clusterForView(pts, PAKISTAN_VIEW(size), size);
    const karachi = out.find((c) => c.items.includes('dha-1'))!;
    expect(karachi.items).toEqual(expect.arrayContaining(['dha-1', 'dha-2', 'gulshan']));

    const p = project(24.86, 67.08);
    const city = clusterForView(pts, { cx: p.x, cy: p.y, scale: TILE_SIZE * 2 ** 11 }, size);
    expect(city.find((c) => c.items.includes('dha-1'))!.items).toEqual(['dha-1', 'dha-2']);
    expect(city.find((c) => c.items.includes('gulshan'))!.items).toEqual(['gulshan']);
    expect(city.some((c) => c.items.includes('lahore'))).toBe(false); // off screen
  });

  it('uses an absolute intensity scale', () => {
    expect(heatIntensity(1, 3)).toBeLessThan(0.3);
    expect(heatIntensity(3, 3)).toBeCloseTo(1 - Math.exp(-1));
    expect(heatIntensity(20, 3)).toBeGreaterThan(0.99);
    expect(heatColor(0)).toBe('rgb(56,189,248)');
    expect(heatColor(1)).toBe('rgb(220,38,38)');
  });
});

describe('street tiles', () => {
  it('covers the viewport with correctly placed tiles', () => {
    const p = project(24.8607, 67.0011);
    const v = { cx: p.x, cy: p.y, scale: TILE_SIZE * 2 ** 12 };
    const tiles = tilesFor(v, size);
    expect(tiles.every((t) => t.z === 12 && t.size === TILE_SIZE)).toBe(true);
    const minLeft = Math.min(...tiles.map((t) => t.left));
    const maxRight = Math.max(...tiles.map((t) => t.left + t.size));
    const minTop = Math.min(...tiles.map((t) => t.top));
    const maxBottom = Math.max(...tiles.map((t) => t.top + t.size));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(size.width);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxBottom).toBeGreaterThanOrEqual(size.height);
    expect(tiles.some((t) => t.x === Math.floor(p.x * 4096) && t.y === Math.floor(p.y * 4096))).toBe(true);
  });
});

describe('offline geo data', () => {
  it('includes a Pakistan outline that contains its major cities in its bounding box', () => {
    const pk = COUNTRIES.find((c) => c.home)!;
    const all = pk.rings.flat();
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    expect(Math.min(...lngs)).toBeLessThan(62);
    expect(Math.max(...lngs)).toBeGreaterThan(77);
    expect(Math.min(...lats)).toBeLessThan(24.5);
    expect(Math.max(...lats)).toBeGreaterThan(36.5);
  });

  it('names the nearest city', () => {
    expect(nearestCity(24.8031, 67.0637).city.name).toBe('Karachi');
    expect(nearestCity(33.72, 73.06).city.name).toBe('Islamabad');
    expect(haversineKm(24.8607, 67.0011, 31.5204, 74.3587)).toBeGreaterThan(1000);
    expect(haversineKm(24.8607, 67.0011, 31.5204, 74.3587)).toBeLessThan(1050);
  });
});
