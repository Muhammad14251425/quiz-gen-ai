import type { Direction } from './types';

type Side = 'to' | 'from';

interface LabelDef {
  side: Side;
  /** Lowercase label text; spaces match any whitespace. */
  label: string;
}

/** Order matters: longer / more specific labels first. */
const BASE_LABELS: LabelDef[] = [
  { side: 'to', label: 'destination account title' },
  { side: 'to', label: 'to account title' },
  { side: 'to', label: 'beneficiary account title' },
  { side: 'to', label: 'beneficiary name' },
  { side: 'to', label: 'beneficiary' },
  { side: 'to', label: 'receiver name' },
  { side: 'to', label: 'receiver' },
  { side: 'to', label: 'recipient name' },
  { side: 'to', label: 'recipient' },
  { side: 'to', label: 'merchant name' },
  { side: 'to', label: 'merchant details' },
  { side: 'to', label: 'merchant' },
  { side: 'to', label: 'payee name' },
  { side: 'to', label: 'payee' },
  { side: 'to', label: 'sent to' },
  { side: 'to', label: 'paid to' },
  { side: 'to', label: 'transferred to' },
  { side: 'to', label: 'transfer to' },
  { side: 'to', label: 'account title' },
  { side: 'to', label: 'to' },
  { side: 'from', label: 'source account title' },
  { side: 'from', label: 'from account title' },
  { side: 'from', label: 'received from' },
  { side: 'from', label: 'sender name' },
  { side: 'from', label: 'sender' },
  { side: 'from', label: 'sent from' },
  { side: 'from', label: 'from' },
];

/** Words that follow a label but mean the line is about something else (bank, account no...). */
const NOT_A_NAME_FOLLOWER =
  /^(bank|account|acc|a\/c|iban|no\b|number|mobile|phone|cnic|wallet|id\b|raast|branch|details|type|category)/i;

/** Lines that start with these are labels themselves and cannot be a value. */
const LABEL_LINE =
  /^(to|from|destination|source|consumer|sent|paid|received|beneficiary|receiver|recipient|sender|merchant|payee|account|amount|total|date|time|fee|charges|transaction|trx|txn|tid|ref|reference|rrn|stan|status|iban|mobile|bank|note|description|purpose|channel|type|via)\b/i;

const NON_NAME_VALUES = /^(you|your|me|my|account|wallet|bank|mobile|self|n\/a|na|null)$|^(your|my|the|you|this)\b/i;

const STOP_TOKENS = /^(a\/c|acc|account|iban|mobile|phone|cnic|raast|via|on|at|wallet|ac)$/i;

function escapeLabel(label: string): string {
  return label
    .replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    .replace(/ /g, '\\s+')
    .replace(/\baccount\b/g, 'acc(?:ount|t)?\\.?'); // "Acc. Title", "Acct Title"
}

/** "Successfully Sent to" / "Received from" ending a line: the name follows on the next lines. */
const TRAILING_LABEL = /\b(?:(sent|paid|transferred|transfer)\s+to|(received)\s+from)\s*:?\s*$/i;

/** First plausible name in the next few lines, skipping logo noise ("®", "Xx"). */
function nameBelow(lines: string[], i: number, maxLines = 2): string | undefined {
  for (let j = i + 1; j <= i + maxLines && j < lines.length; j++) {
    const line = lines[j];
    if (LABEL_LINE.test(line)) return undefined;
    // Skip logo noise and account-number lines.
    if ((line.match(/[A-Za-z]/g) ?? []).length < 3 || /\d/.test(line)) continue;
    return cleanName(line);
  }
  return undefined;
}

/**
 * Two-column layouts can put a multi-line value above its vertically centered
 * label ("KHI SCHOOL / FOR BUSINESS / Transferred To:"). Join up to two
 * preceding plain-text lines.
 */
function nameAbove(lines: string[], i: number): string | undefined {
  const parts: string[] = [];
  for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
    const line = lines[j];
    if (LABEL_LINE.test(line) || /\d/.test(line) || !/^[A-Za-z.&' \-]+$/.test(line)) break;
    parts.unshift(line);
  }
  return parts.length ? cleanName(parts.join(' ')) : undefined;
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-'.(&])([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

/**
 * Removes account numbers, IBANs, phone numbers, emails, masked digits and
 * trailing junk from a candidate name, then title-cases it.
 */
export function cleanName(raw: string): string | undefined {
  let s = raw
    .replace(/\bPK\d{2}[A-Z0-9]{4}\d{10,20}\b/gi, ' ') // IBAN
    .replace(/\S+@\S+/g, ' ') // emails / wallet handles
    .replace(/\([^)]*\)/g, ' ') // parentheticals like (A/C ****1234)
    .replace(/^[\s:\-–|>]+/, '');

  const kept: string[] = [];
  for (const token of s.split(/\s+/)) {
    if (!token) continue;
    if (/[\d*#@]/.test(token) || STOP_TOKENS.test(token.replace(/[:,.]$/, ''))) break;
    if (token === '-' || token === '|' || token === '·') break;
    kept.push(token);
  }
  s = kept
    .join(' ')
    .replace(/[^A-Za-z\s.&'\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s.\-&']+$/, '')
    .trim();
  const letters = (s.match(/[A-Za-z]/g) ?? []).length;
  if (letters < 2 || NON_NAME_VALUES.test(s)) return undefined;
  if (s.split(' ').length > 6) return undefined;
  return titleCase(s);
}

export interface CounterpartyExtraction {
  counterparty?: string;
  confidence: number;
  side?: Side;
}

interface Found {
  name: string;
  side: Side;
  confidence: number;
  order: number;
}

export function extractCounterparty(
  lines: string[],
  direction: Direction | undefined,
  extraLabels: string[] = [],
): CounterpartyExtraction {
  const labels: LabelDef[] = [...extraLabels.map((label) => ({ side: 'to' as Side, label })), ...BASE_LABELS];
  const found: Found[] = [];

  lines.forEach((line, i) => {
    for (const def of labels) {
      const re = new RegExp(`^${escapeLabel(def.label)}\\b\\s*[:\\-–]?\\s*(.*)$`, 'i');
      const m = re.exec(line);
      if (!m) continue;
      const rest = m[1].trim();
      if (NOT_A_NAME_FOLLOWER.test(rest)) break; // e.g. "Beneficiary Bank: HBL"
      if (rest) {
        const name = cleanName(rest);
        if (name) found.push({ name, side: def.side, confidence: 0.9, order: i });
      } else {
        const below = nameBelow(lines, i);
        const name = below ?? nameAbove(lines, i);
        if (name) found.push({ name, side: def.side, confidence: below ? 0.82 : 0.65, order: i });
      }
      break; // only the most specific label per line
    }

    const trailing = TRAILING_LABEL.exec(line);
    if (trailing && trailing.index > 0) {
      const name = nameBelow(lines, i);
      if (name) found.push({ name, side: trailing[2] ? 'from' : 'to', confidence: 0.8, order: i });
    }

    // Sentence forms: "You sent Rs 500 to Ali Khan", "received Rs 1,000 from Sara".
    const sentence =
      /\b(to|from)\s+([A-Za-z][A-Za-z.'&\- ]{1,48}?)(?=\s+(?:\d|on\b|at\b|via\b|a\/c\b|acc\b|account\b|\()|[,.;]|\s*$)/gi;
    let s: RegExpExecArray | null;
    while ((s = sentence.exec(line))) {
      if (s.index === 0) continue; // handled as a label above
      const name = cleanName(s[2]);
      if (name) found.push({ name, side: s[1].toLowerCase() === 'to' ? 'to' : 'from', confidence: 0.6, order: i });
    }
  });

  if (found.length === 0) return { confidence: 0 };
  const preferred: Side = direction === 'received' ? 'from' : 'to';
  const pick =
    found.filter((f) => f.side === preferred).sort((a, b) => b.confidence - a.confidence || a.order - b.order)[0] ??
    found.sort((a, b) => b.confidence - a.confidence || a.order - b.order)[0];
  const penalty = pick.side === preferred || !direction ? 0 : 0.25;
  return { counterparty: pick.name, side: pick.side, confidence: Math.max(0.3, pick.confidence - penalty) };
}
