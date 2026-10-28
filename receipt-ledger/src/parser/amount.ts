import type { Span } from './date';

const MONEY_RE = /(Rs\s?)?(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.(\d{1,2}))?/g;

const STRONG_LABEL =
  /(total\s+amount|amount\s+(transferred|sent|received|paid|debited|credited)|transfer(red)?\s+amount|transaction\s+amount|payment\s+amount|bill\s+amount|you\s+(have\s+)?(sent|received|paid)|credited\s+with|debited\s+(with|by)|money\s+(sent|received)|payment\s+(sent|received))/i;
const NORMAL_LABEL = /\b(amount|amt|total|sent|received|paid|transfer|transferred|credited|debited)\b/i;
const NEGATIVE_LABEL =
  /\b(fee|fees|charge|charges|tax|fed|wht|commission|balance|bal|avl|available|limit|cashback|discount|reward|points)\b/i;
const ID_LABEL =
  /(\b(id|tid|trx|txn|ref|reference|rrn|stan|no|number|account|a\/c|acc|iban|mobile|phone|cell|cnic|consumer|till|card|customer|cust|raast|code|otp|pin)\b|#)/i;
const CURRENCY_TAIL = /\b(rs|pkr)\W*$/i;

const BAD_BEFORE = /[A-Za-z0-9*#/:._@]/;
const BAD_AFTER = /[A-Za-z0-9*:/_@%]/;

export interface AmountExtraction {
  amount?: number;
  confidence: number;
}

interface Candidate {
  minor: number;
  score: number;
}

function toMinor(intPart: string, frac: string | undefined): number {
  const whole = parseInt(intPart.replace(/,/g, ''), 10);
  const paisa = frac ? parseInt(frac.padEnd(2, '0'), 10) : 0;
  return whole * 100 + paisa;
}

function mask(line: string, lineIndex: number, spans: Span[]): string {
  let out = line;
  for (const s of spans) {
    if (s.line !== lineIndex) continue;
    out = out.slice(0, s.start) + ' '.repeat(s.end - s.start) + out.slice(s.end);
  }
  return out;
}

function labelScore(context: string, strong: number, normal: number): number {
  if (STRONG_LABEL.test(context)) return strong;
  if (NORMAL_LABEL.test(context)) return normal;
  return 0;
}

/**
 * Picks the transaction amount. Labeled amounts beat stray numbers; fees,
 * balances, IDs, phone and account numbers are ignored. Dates and times are
 * masked out beforehand via `maskedSpans`.
 */
export function extractAmount(lines: string[], maskedSpans: Span[]): AmountExtraction {
  const candidates: Candidate[] = [];
  const masked = lines.map((l, i) => mask(l, i, maskedSpans));

  masked.forEach((text, lineIndex) => {
    MONEY_RE.lastIndex = 0;
    let prevEnd = 0;
    let first = true;
    let m: RegExpExecArray | null;
    while ((m = MONEY_RE.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      const segment = text.slice(prevEnd, start);
      const isFirst = first;
      prevEnd = end;
      first = false;

      const before = text[start - 1] ?? ' ';
      const after = text[end] ?? ' ';
      const afterNext = text[end + 1] ?? ' ';
      if (BAD_BEFORE.test(before)) continue;
      if (BAD_AFTER.test(after)) continue;
      if ((after === '-' || after === '.' || after === ',') && /\d/.test(afterNext)) continue;

      const digits = m[2].replace(/,/g, '');
      const hasGrouping = m[2].includes(',');
      const hasDecimals = m[3] !== undefined;
      let hasCurrency = Boolean(m[1]) || CURRENCY_TAIL.test(segment) || /^\s*(rs|pkr)\b/i.test(text.slice(end));

      // Label context: own segment, else the previous line when the amount starts its line.
      let context = segment;
      let fromPrevLine = false;
      if (isFirst && !/[a-z]{2,}/i.test(segment) && lineIndex > 0) {
        context = masked[lineIndex - 1];
        fromPrevLine = true;
        if (!hasCurrency && CURRENCY_TAIL.test(context)) hasCurrency = true;
      }

      if (NEGATIVE_LABEL.test(context)) continue;
      const label = fromPrevLine ? labelScore(context, 5, 3) : labelScore(context, 6, 4);
      // An ID label only disqualifies when no amount label follows it.
      if (ID_LABEL.test(context) && label === 0 && !hasCurrency) continue;
      if (fromPrevLine && ID_LABEL.test(context) && label === 0) continue;

      if (!hasCurrency && !hasGrouping && !hasDecimals) {
        if (digits.length >= 9) continue; // account numbers, IDs
        if (/^03\d{9}$/.test(digits)) continue; // mobile numbers
        if (label === 0 && /^(19|20)\d{2}$/.test(digits)) continue; // years
      }

      const minor = toMinor(m[2], m[3]);
      if (minor <= 0 || minor > 100_000_000_000) continue;

      let score = label;
      if (hasCurrency) score += 3;
      if (hasDecimals) score += 1;
      if (hasGrouping) score += 1;
      if (score === 0) score = 0.5;
      candidates.push({ minor, score });
    }
  });

  if (candidates.length === 0) return { confidence: 0 };
  const best = candidates.reduce((a, b) =>
    b.score > a.score || (b.score === a.score && b.score >= 4 && b.minor > a.minor) ? b : a,
  );
  const s = best.score;
  const confidence = s >= 9 ? 0.95 : s >= 7 ? 0.9 : s >= 5 ? 0.8 : s >= 3 ? 0.6 : 0.25;
  return { amount: best.minor, confidence };
}
