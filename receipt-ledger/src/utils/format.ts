import type { DateFormat } from '../store/settings';
import { localDayKey, toLocalParts } from './timezone';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(ms: number, fmt: DateFormat = 'DD MMM YYYY'): string {
  const p = toLocalParts(ms);
  switch (fmt) {
    case 'DD/MM/YYYY':
      return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
    case 'MM/DD/YYYY':
      return `${pad(p.month)}/${pad(p.day)}/${p.year}`;
    case 'YYYY-MM-DD':
      return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    default:
      return `${pad(p.day)} ${MONTHS[p.month - 1]} ${p.year}`;
  }
}

export function formatTime(ms: number): string {
  const p = toLocalParts(ms);
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${pad(p.minute)} ${p.hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDateTime(ms: number, fmt?: DateFormat): string {
  return `${formatDate(ms, fmt)}, ${formatTime(ms)}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

/** "Today", "Yesterday" or a formatted date, for section headers. */
export function dayLabel(
  ms: number,
  fmt: DateFormat,
  labels: { today: string; yesterday: string },
  now = Date.now(),
): string {
  const key = localDayKey(ms);
  if (key === localDayKey(now)) return labels.today;
  if (key === localDayKey(now - 86_400_000)) return labels.yesterday;
  const p = toLocalParts(ms);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.weekday];
  return `${weekday}, ${formatDate(ms, fmt)}`;
}
