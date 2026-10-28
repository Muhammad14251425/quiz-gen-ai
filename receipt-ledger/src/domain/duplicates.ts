import { localDayKey } from '../utils/timezone';
import { counterpartyKey } from './counterparty';

export interface DuplicateCandidate {
  id?: number;
  amount_minor: number;
  occurred_at: number;
  counterparty: string | null;
  reference: string | null;
}

export type DuplicateReason = 'reference' | 'amount-date-counterparty';

export function normalizeReference(ref: string | null | undefined): string {
  return (ref ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/**
 * Two transactions are duplicates when they share a reference ID, or when the
 * amount, local calendar day and counterparty all match.
 */
export function duplicateReason(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateReason | null {
  if (a.id !== undefined && a.id === b.id) return null;
  const refA = normalizeReference(a.reference);
  if (refA.length >= 4 && refA === normalizeReference(b.reference)) return 'reference';
  const keyA = counterpartyKey(a.counterparty);
  if (
    a.amount_minor === b.amount_minor &&
    localDayKey(a.occurred_at) === localDayKey(b.occurred_at) &&
    keyA !== '' &&
    keyA === counterpartyKey(b.counterparty)
  ) {
    return 'amount-date-counterparty';
  }
  return null;
}

export function findDuplicates<T extends DuplicateCandidate>(
  candidate: DuplicateCandidate,
  existing: T[],
): { tx: T; reason: DuplicateReason }[] {
  const out: { tx: T; reason: DuplicateReason }[] = [];
  for (const tx of existing) {
    const reason = duplicateReason(candidate, tx);
    if (reason) out.push({ tx, reason });
  }
  return out;
}
