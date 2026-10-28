/** Normalized key used to match counterparties across receipts ("M. Ali Khan" ≈ "m ali khan"). */
export function counterpartyKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|dr|syed|sayed|m|muhammad|mohammad|mohammed|muhammed)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const compact = s.replace(/\s+/g, ' ');
  for (let i = 0; i < compact.length - 1; i++) {
    const bg = compact.slice(i, i + 2);
    out.set(bg, (out.get(bg) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice similarity of two keys, 0..1. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [bg, n] of A) {
    overlap += Math.min(n, B.get(bg) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total === 0 ? 0 : (2 * overlap) / total;
}

export const SIMILAR_THRESHOLD = 0.8;

export function findSimilar<T extends { key: string }>(key: string, candidates: T[]): T | undefined {
  if (!key) return undefined;
  let best: { item: T; score: number } | undefined;
  for (const item of candidates) {
    const score = similarity(key, item.key);
    if (score >= SIMILAR_THRESHOLD && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}
