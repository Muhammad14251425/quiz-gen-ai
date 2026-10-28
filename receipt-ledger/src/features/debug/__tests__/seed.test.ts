import { createTestDb } from '../../../db/__tests__/testDb';
import { migrate } from '../../../db/migrations';
import * as repo from '../../../db/repositories';
import { seedSampleData } from '../seed';

it('seeds banks, accounts and transactions with consistent balances', async () => {
  const db = createTestDb();
  await migrate(db);
  const n = await seedSampleData(db, Date.UTC(2026, 9, 28, 12));
  expect(await repo.listTransactions(db)).toHaveLength(n);
  const accounts = await repo.listAccounts(db);
  expect(accounts).toHaveLength(5);
  const hbl = accounts.find((a) => a.bank_name === 'HBL' && a.label === 'Current')!;
  // 250,000 + 185,000×2 − 45,000×2 − 4,321.50 − 10,000
  expect(hbl.balance_minor).toBe(51_567_850);
});
