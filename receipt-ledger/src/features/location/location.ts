import * as Location from 'expo-location';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  /** Radius in metres, when the OS reports it. */
  accuracy: number | null;
  /** When the fix was taken (epoch ms). */
  capturedAt: number;
}

/**
 * Only attach the phone's current position when the transaction happened
 * recently; a receipt shared hours later was paid somewhere else.
 */
export const ATTACH_WINDOW_MS = 2 * 60 * 60 * 1000;

export function shouldAttachLocation(occurredAt: number, now = Date.now()): boolean {
  return Math.abs(now - occurredAt) <= ATTACH_WINDOW_MS;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted;
}

async function hasPermission(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

function toPoint(l: Location.LocationObject): GeoPoint {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy ?? null,
    capturedAt: l.timestamp,
  };
}

/**
 * Best-effort position from GPS (works without internet). Never throws and
 * never waits longer than `timeoutMs`, so saving is not blocked.
 */
export async function getCurrentPoint(timeoutMs = 8000): Promise<GeoPoint | null> {
  if (!(await hasPermission())) return null;
  try {
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 });
    if (recent) return toPoint(recent);
  } catch {
    // fall through to a fresh fix
  }
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return fix ? toPoint(fix) : null;
  } catch {
    return null;
  }
}

export function formatPoint(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** geo: URI opened by the user's maps app (the app itself never goes online). */
export function mapsUrl(lat: number, lng: number, label?: string | null): string {
  const q = `${lat},${lng}${label ? `(${encodeURIComponent(label)})` : ''}`;
  return `geo:${lat},${lng}?q=${q}`;
}
