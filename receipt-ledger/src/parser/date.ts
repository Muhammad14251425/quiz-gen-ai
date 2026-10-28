import { daysInMonth, fromLocalParts } from '../utils/timezone';

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MON =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

type Order = 'ymd' | 'dmy-name' | 'mdy-name' | 'numeric';

const DATE_PATTERNS: { order: Order; re: RegExp }[] = [
  { order: 'ymd', re: /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/gi },
  {
    order: 'dmy-name',
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.,]*${MON}\\.?[\\s\\-/.,]*(\\d{4}|\\d{2})\\b`, 'gi'),
  },
  {
    order: 'mdy-name',
    re: new RegExp(`\\b${MON}\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})\\b`, 'gi'),
  },
  { order: 'numeric', re: /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})\b/g },
];

const TIME_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s?m\b\.?)?/gi;

const DATE_LABEL = /\b(date|dated|on|paid on|received on|time)\b/i;
const TIME_LABEL = /\btime\b/i;

export interface Span {
  line: number;
  start: number;
  end: number;
}

interface DateCandidate extends Span {
  year: number;
  month: number;
  day: number;
  ambiguous: boolean;
  score: number;
}

interface TimeCandidate extends Span {
  hour: number;
  minute: number;
  second: number;
}

export interface DateExtraction {
  date?: Date;
  confidence: number;
  /** Spans consumed by dates/times, masked out before amount detection. */
  spans: Span[];
}

function monthFromName(name: string): number {
  return MONTHS[name.slice(0, 3).toLowerCase()] ?? 0;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function valid(year: number, month: number, day: number, now: Date): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return year >= 2000 && year <= now.getUTCFullYear() + 1;
}

function overlaps(spans: Span[], line: number, start: number, end: number): boolean {
  return spans.some((s) => s.line === line && start < s.end && end > s.start);
}

function findDateCandidates(lines: string[], now: Date): DateCandidate[] {
  const out: DateCandidate[] = [];
  lines.forEach((text, line) => {
    for (const { order, re } of DATE_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const start = m.index;
        const end = start + m[0].length;
        if (overlaps(out, line, start, end)) continue;
        let year: number;
        let month: number;
        let day: number;
        let ambiguous = false;
        if (order === 'ymd') {
          year = +m[1];
          month = +m[2];
          day = +m[3];
        } else if (order === 'dmy-name') {
          day = +m[1];
          month = monthFromName(m[2]);
          year = normalizeYear(+m[3]);
        } else if (order === 'mdy-name') {
          month = monthFromName(m[1]);
          day = +m[2];
          year = +m[3];
        } else {
          const a = +m[1];
          const b = +m[2];
          year = normalizeYear(+m[3]);
          if (a > 12 && b <= 12) {
            day = a;
            month = b;
          } else if (a <= 12 && b > 12) {
            month = a;
            day = b;
          } else {
            // Day-first is the default in Pakistan.
            day = a;
            month = b;
            ambiguous = a !== b;
          }
        }
        if (!valid(year, month, day, now)) continue;
        let score = 1;
        if (DATE_LABEL.test(text)) score += 2;
        if (order !== 'numeric') score += 0.5;
        out.push({ line, start, end, year, month, day, ambiguous, score });
      }
    }
  });
  return out;
}

function findTimes(lines: string[], dateSpans: Span[]): TimeCandidate[] {
  const out: TimeCandidate[] = [];
  lines.forEach((text, line) => {
    TIME_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_RE.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(dateSpans, line, start, end)) continue;
      let hour = +m[1];
      const minute = +m[2];
      const second = m[3] ? +m[3] : 0;
      const meridiem = m[4]?.toLowerCase();
      if (minute > 59 || second > 59) continue;
      if (meridiem) {
        if (hour < 1 || hour > 12) continue;
        if (meridiem === 'p' && hour !== 12) hour += 12;
        if (meridiem === 'a' && hour === 12) hour = 0;
      } else if (hour > 23) {
        continue;
      }
      out.push({ line, start, end, hour, minute, second });
    }
  });
  return out;
}

export function extractDate(lines: string[], now: Date = new Date()): DateExtraction {
  const dates = findDateCandidates(lines, now);
  const times = findTimes(lines, dates);
  const spans: Span[] = [...dates, ...times];

  if (dates.length === 0) return { confidence: 0, spans };

  // Highest score wins; earlier lines break ties (headers usually carry the date).
  const best = [...dates].sort((a, b) => b.score - a.score || a.line - b.line || a.start - b.start)[0];

  const time =
    times.find((t) => t.line === best.line) ??
    times.find((t) => t.line > best.line && t.line <= best.line + 2 && TIME_LABEL.test(lines[t.line])) ??
    times.find((t) => TIME_LABEL.test(lines[t.line])) ??
    times.find((t) => t.line > best.line && t.line <= best.line + 1);

  const date = fromLocalParts(best.year, best.month, best.day, time?.hour ?? 0, time?.minute ?? 0, time?.second ?? 0);
  let confidence = 0.8;
  if (time) confidence += 0.12;
  if (best.score >= 3) confidence += 0.05;
  if (best.ambiguous) confidence -= 0.2;
  return { date, confidence: Math.min(0.97, confidence), spans };
}
