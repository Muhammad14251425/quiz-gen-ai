/**
 * The app records times in Asia/Karachi (PKT, UTC+5, no DST). Using a fixed
 * offset keeps parsing, grouping and display identical regardless of the
 * device's timezone setting and avoids depending on Intl timezone data.
 */
export const APP_TZ = 'Asia/Karachi';
export const APP_TZ_OFFSET_MINUTES = 5 * 60;

const OFFSET_MS = APP_TZ_OFFSET_MINUTES * 60_000;

/** Builds the instant for a wall-clock time in Asia/Karachi. Month is 1-based. */
export function fromLocalParts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - OFFSET_MS);
}

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

/** Wall-clock parts of an instant in Asia/Karachi. */
export function toLocalParts(date: Date | number): LocalParts {
  const shifted = new Date((typeof date === 'number' ? date : date.getTime()) + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/** Start of the local day containing `date`. */
export function startOfLocalDay(date: Date | number): Date {
  const p = toLocalParts(date);
  return fromLocalParts(p.year, p.month, p.day);
}

/** Start of the local month (month is 1-based; may overflow, e.g. 13 → next January). */
export function startOfLocalMonth(year: number, month: number): Date {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  return fromLocalParts(y, m, 1);
}

/** "2026-10-28" key for grouping by local day. */
export function localDayKey(date: Date | number): string {
  const p = toLocalParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
