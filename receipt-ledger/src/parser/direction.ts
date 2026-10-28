import type { Direction } from './types';

const SIGNALS: { re: RegExp; dir: Direction; weight: number }[] = [
  // Strong "sent" phrases
  { re: /\byou\s+(have\s+)?(sent|paid|transferred)\b/gi, dir: 'sent', weight: 3 },
  { re: /\b(sent|paid|transferred|transfer)\s+to\b/gi, dir: 'sent', weight: 2 },
  { re: /\b(money|payment|amount)\s+sent\b/gi, dir: 'sent', weight: 2 },
  { re: /\bamount\s+transferred\b/gi, dir: 'sent', weight: 2 },
  { re: /\bdebited\b/gi, dir: 'sent', weight: 2 },
  { re: /\bbill\s+payment\b/gi, dir: 'sent', weight: 2 },
  // Weak "sent" phrases
  { re: /\bpaid\b/gi, dir: 'sent', weight: 1 },
  { re: /\bfunds?\s+transfer\b/gi, dir: 'sent', weight: 1 },
  { re: /\b(payment|transfer)\s+successful\b/gi, dir: 'sent', weight: 1 },
  // Strong "received" phrases
  { re: /\byou\s+(have\s+)?received\b/gi, dir: 'received', weight: 3 },
  { re: /\breceived\s+from\b/gi, dir: 'received', weight: 2 },
  { re: /\bcredited\b/gi, dir: 'received', weight: 2 },
  { re: /\b(money|funds|payment|amount)\s+received\b/gi, dir: 'received', weight: 2 },
  { re: /\bcredit\s+alert\b/gi, dir: 'received', weight: 2 },
  // Weak "received" phrases
  { re: /\breceived\b/gi, dir: 'received', weight: 1 },
  { re: /\bincoming\b/gi, dir: 'received', weight: 1 },
];

export interface DirectionExtraction {
  direction?: Direction;
  confidence: number;
}

export function extractDirection(text: string): DirectionExtraction {
  let sent = 0;
  let received = 0;
  for (const { re, dir, weight } of SIGNALS) {
    const hits = text.match(re)?.length ?? 0;
    if (dir === 'sent') sent += hits * weight;
    else received += hits * weight;
  }
  if (sent === received) return { confidence: 0 };
  const direction: Direction = sent > received ? 'sent' : 'received';
  const margin = Math.abs(sent - received);
  const confidence = margin >= 4 ? 0.85 : margin >= 2 ? 0.7 : 0.5;
  return { direction, confidence };
}
