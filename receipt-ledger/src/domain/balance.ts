import type { TxType } from '../db/types';

export interface BalanceTx {
  type: TxType;
  amount_minor: number;
}

/** Signed effect of a transaction on its account. */
export function signedAmount(tx: BalanceTx): number {
  return tx.type === 'received' ? tx.amount_minor : -tx.amount_minor;
}

/** balance = opening + Σ received − Σ sent (all integer minor units). */
export function computeBalance(openingMinor: number, txs: BalanceTx[]): number {
  return txs.reduce((sum, tx) => sum + signedAmount(tx), openingMinor);
}

export interface Flow {
  sent: number;
  received: number;
  net: number;
}

export function computeFlow(txs: BalanceTx[]): Flow {
  let sent = 0;
  let received = 0;
  for (const tx of txs) {
    if (tx.type === 'sent') sent += tx.amount_minor;
    else received += tx.amount_minor;
  }
  return { sent, received, net: received - sent };
}

/** Sums balances per currency so mixed-currency accounts are never added together. */
export function totalsByCurrency(accounts: { currency: string; balance_minor: number }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const a of accounts) totals[a.currency] = (totals[a.currency] ?? 0) + a.balance_minor;
  return totals;
}
