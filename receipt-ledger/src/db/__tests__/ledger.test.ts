import { computeBalance, computeFlow, totalsByCurrency } from '../../domain/balance';
import { counterpartyKey, similarity } from '../../domain/counterparty';
import { duplicateReason } from '../../domain/duplicates';
import { fromLocalParts } from '../../utils/timezone';
import { migrate } from '../migrations';
import * as repo from '../repositories';
import type { NewTransaction } from '../types';
import { createTestDb } from './testDb';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  const hbl = await repo.createBank(db, { name: 'HBL', color: '#00856F', icon: 'hbl' });
  const jazz = await repo.createBank(db, { name: 'JazzCash', color: '#C8102E', icon: 'jazzcash' });
  const current = await repo.createAccount(db, {
    bank_id: hbl,
    label: 'Current',
    last4: '4521',
    currency: 'PKR',
    opening_balance_minor: 100_000_00,
  });
  const savings = await repo.createAccount(db, {
    bank_id: hbl,
    label: 'Savings',
    last4: null,
    currency: 'PKR',
    opening_balance_minor: 0,
  });
  const wallet = await repo.createAccount(db, {
    bank_id: jazz,
    label: 'Wallet',
    last4: null,
    currency: 'PKR',
    opening_balance_minor: 5_000_00,
  });
  return { db, hbl, jazz, current, savings, wallet };
}

const tx = (over: Partial<NewTransaction> & Pick<NewTransaction, 'account_id'>): NewTransaction => ({
  type: 'sent',
  amount_minor: 1_000_00,
  occurred_at: fromLocalParts(2026, 10, 28, 12, 0).getTime(),
  counterparty: 'Ali Khan',
  reference: null,
  category_id: null,
  note: null,
  receipt_path: null,
  source: 'manual',
  ...over,
});

describe('balance calculation (pure)', () => {
  it('is opening + received − sent', () => {
    expect(
      computeBalance(10_000, [
        { type: 'received', amount_minor: 2_500 },
        { type: 'sent', amount_minor: 4_000 },
      ]),
    ).toBe(8_500);
    expect(computeBalance(0, [])).toBe(0);
    expect(computeBalance(0, [{ type: 'sent', amount_minor: 1 }])).toBe(-1);
  });

  it('computes flows and per-currency totals', () => {
    expect(
      computeFlow([
        { type: 'sent', amount_minor: 3 },
        { type: 'received', amount_minor: 5 },
      ]),
    ).toEqual({
      sent: 3,
      received: 5,
      net: 2,
    });
    expect(
      totalsByCurrency([
        { currency: 'PKR', balance_minor: 10 },
        { currency: 'USD', balance_minor: 7 },
        { currency: 'PKR', balance_minor: -3 },
      ]),
    ).toEqual({ PKR: 7, USD: 7 });
  });
});

describe('balances in the database', () => {
  it('tracks each account separately and stays consistent through edits and deletes', async () => {
    const { db, current, savings, wallet, hbl } = await setup();
    const t1 = await repo.createTransaction(db, tx({ account_id: current, amount_minor: 25_000_00 }));
    await repo.createTransaction(db, tx({ account_id: current, type: 'received', amount_minor: 1_250_50 }));
    await repo.createTransaction(db, tx({ account_id: wallet, amount_minor: 500_00 }));

    const balances = async () =>
      Object.fromEntries((await repo.listAccounts(db)).map((a) => [a.id, a.balance_minor] as const));

    expect(await balances()).toEqual({ [current]: 76_250_50, [savings]: 0, [wallet]: 4_500_00 });

    await repo.updateTransaction(db, t1, tx({ account_id: savings, amount_minor: 10_000_00 }));
    expect(await balances()).toEqual({ [current]: 101_250_50, [savings]: -10_000_00, [wallet]: 4_500_00 });

    await repo.deleteTransaction(db, t1);
    expect(await balances()).toEqual({ [current]: 101_250_50, [savings]: 0, [wallet]: 4_500_00 });

    const hblAccounts = await repo.listAccounts(db, { bankId: hbl });
    expect(hblAccounts.reduce((s, a) => s + a.balance_minor, 0)).toBe(101_250_50);
  });

  it('rejects zero, negative and fractional amounts', async () => {
    const { db, current } = await setup();
    await expect(repo.createTransaction(db, tx({ account_id: current, amount_minor: 0 }))).rejects.toThrow();
    await expect(repo.createTransaction(db, tx({ account_id: current, amount_minor: -100 }))).rejects.toThrow();
    await expect(repo.createTransaction(db, tx({ account_id: current, amount_minor: 10.5 }))).rejects.toThrow();
  });

  it('archives instead of deleting history, or cascades when asked', async () => {
    const { db, hbl, current } = await setup();
    await repo.createTransaction(db, tx({ account_id: current, receipt_path: 'receipts/a.jpg' }));
    await repo.setBankArchived(db, hbl, true);
    expect((await repo.listAccounts(db)).map((a) => a.label)).toEqual(['Wallet']);
    expect(await repo.listTransactions(db)).toHaveLength(1);

    expect(await repo.countBankTransactions(db, hbl)).toBe(1);
    expect(await repo.deleteBankCascade(db, hbl)).toEqual(['receipts/a.jpg']);
    expect(await repo.listTransactions(db)).toHaveLength(0);
    expect(await repo.listAccounts(db, { includeArchived: true })).toHaveLength(1);
  });

  it('filters transactions', async () => {
    const { db, current, wallet, jazz } = await setup();
    const food = (await repo.listCategories(db)).find((c) => c.name === 'Food')!.id;
    await repo.createTransaction(db, tx({ account_id: current, counterparty: 'Sara Ahmed', category_id: food }));
    await repo.createTransaction(db, tx({ account_id: wallet, type: 'received', note: 'rent share' }));
    await repo.createTransaction(
      db,
      tx({ account_id: wallet, occurred_at: fromLocalParts(2026, 9, 1).getTime(), counterparty: 'Old' }),
    );

    expect(await repo.listTransactions(db, { search: 'sara' })).toHaveLength(1);
    expect(await repo.listTransactions(db, { search: 'rent' })).toHaveLength(1);
    expect(await repo.listTransactions(db, { bankIds: [jazz] })).toHaveLength(2);
    expect(await repo.listTransactions(db, { type: 'received' })).toHaveLength(1);
    expect(await repo.listTransactions(db, { categoryIds: [food] })).toHaveLength(1);
    const oct = { from: fromLocalParts(2026, 10, 1).getTime(), to: fromLocalParts(2026, 11, 1).getTime() };
    expect(await repo.listTransactions(db, oct)).toHaveLength(2);
    expect(await repo.flowBetween(db, oct)).toEqual({ sent: 1_000_00, received: 1_000_00 });
  });
});

describe('duplicate detection', () => {
  const base = {
    amount_minor: 50_000,
    occurred_at: fromLocalParts(2026, 10, 28, 9, 0).getTime(),
    counterparty: 'Ali Khan',
    reference: null as string | null,
  };

  it('matches on reference id regardless of formatting', () => {
    expect(
      duplicateReason({ ...base, reference: 'FT-2630 1ABC' }, { ...base, amount_minor: 1, reference: 'ft26301abc' }),
    ).toBe('reference');
  });

  it('matches on amount + local day + counterparty', () => {
    const later = { ...base, occurred_at: fromLocalParts(2026, 10, 28, 23, 0).getTime(), counterparty: 'ALI KHAN' };
    expect(duplicateReason(base, later)).toBe('amount-date-counterparty');
    const nextDay = { ...base, occurred_at: fromLocalParts(2026, 10, 29, 0, 30).getTime() };
    expect(duplicateReason(base, nextDay)).toBeNull();
    expect(duplicateReason(base, { ...base, counterparty: 'Sara' })).toBeNull();
    expect(duplicateReason(base, { ...base, amount_minor: 50_001 })).toBeNull();
  });

  it('ignores missing counterparties and the same row', () => {
    expect(duplicateReason({ ...base, counterparty: null }, { ...base, counterparty: null })).toBeNull();
    expect(duplicateReason({ ...base, id: 3 }, { ...base, id: 3 })).toBeNull();
  });

  it('finds duplicates in the database', async () => {
    const { db, current } = await setup();
    await repo.createTransaction(db, tx({ account_id: current, reference: 'TID123456', amount_minor: 50_000 }));
    const byRef = await repo.findDuplicateTransactions(db, { ...base, amount_minor: 7, reference: 'tid-123456' });
    expect(byRef.map((d) => d.reason)).toEqual(['reference']);
    const byFields = await repo.findDuplicateTransactions(db, {
      ...base,
      occurred_at: tx({ account_id: 0 }).occurred_at,
    });
    expect(byFields.map((d) => d.reason)).toEqual(['amount-date-counterparty']);
    expect(await repo.findDuplicateTransactions(db, { ...base, amount_minor: 99 })).toEqual([]);
  });
});

describe('counterparty memory', () => {
  it('normalizes and compares names', () => {
    expect(counterpartyKey('Muhammad Ali Khan')).toBe('ali khan');
    expect(counterpartyKey('M. Ali  Khan')).toBe('ali khan');
    expect(similarity('ali khan', 'ali khann')).toBeGreaterThan(0.8);
    expect(similarity('ali khan', 'sara ahmed')).toBeLessThan(0.3);
  });

  it('remembers category and type, and suggests for similar names', async () => {
    const { db, current } = await setup();
    const bills = (await repo.listCategories(db)).find((c) => c.name === 'Bills')!.id;
    await repo.createTransaction(db, tx({ account_id: current, counterparty: 'K-Electric', category_id: bills }));
    await repo.createTransaction(db, tx({ account_id: current, counterparty: 'K Electric', category_id: null }));

    const exact = await repo.suggestForCounterparty(db, 'k-electric');
    expect(exact).toMatchObject({ last_category_id: bills, last_type: 'sent', use_count: 2 });
    const fuzzy = await repo.suggestForCounterparty(db, 'K-Electrik');
    expect(fuzzy?.last_category_id).toBe(bills);
    expect(await repo.suggestForCounterparty(db, 'Someone Else')).toBeNull();
  });
});

describe('backup round trip', () => {
  it('dumps and restores all data', async () => {
    const { db, current } = await setup();
    await repo.createTransaction(db, tx({ account_id: current, reference: 'R1' }));
    await repo.setSetting(db, 'theme', 'dark');
    const dump = await repo.dumpAll(db);

    const fresh = createTestDb();
    await migrate(fresh);
    await repo.restoreAll(fresh, JSON.parse(JSON.stringify(dump)));
    expect(await repo.dumpAll(fresh)).toEqual(dump);
    expect(await repo.getSetting(fresh, 'theme', 'light')).toBe('dark');

    await repo.deleteAllData(fresh);
    expect(await repo.listTransactions(fresh)).toHaveLength(0);
    expect(await repo.listBanks(fresh, { includeArchived: true })).toHaveLength(0);
    expect((await repo.listCategories(fresh)).length).toBeGreaterThan(0);
  });
});
