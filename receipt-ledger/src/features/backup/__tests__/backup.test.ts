import { migrate } from '../../../db/migrations';
import * as repo from '../../../db/repositories';
import { createTestDb } from '../../../db/__tests__/testDb';
import type { TransactionView } from '../../../db/types';
import { fromLocalParts } from '../../../utils/timezone';
import { createBackupZip, InvalidBackupError, readBackupZip, transactionsToCsv } from '../format';
import JSZip from 'jszip';

describe('backup zip', () => {
  it('round-trips data and receipt images', async () => {
    const db = createTestDb();
    await migrate(db);
    const bank = await repo.createBank(db, { name: 'HBL', color: '#000', icon: 'hbl' });
    const acc = await repo.createAccount(db, {
      bank_id: bank,
      label: 'Main',
      last4: null,
      currency: 'PKR',
      opening_balance_minor: 0,
    });
    await repo.createTransaction(db, {
      account_id: acc,
      type: 'sent',
      amount_minor: 12345,
      occurred_at: 1,
      counterparty: 'Ali',
      reference: null,
      category_id: null,
      note: null,
      receipt_path: 'receipts/a.jpg',
      source: 'share',
    });
    const dump = await repo.dumpAll(db);
    const zipBytes = await createBackupZip(dump, [{ path: 'receipts/a.jpg', bytes: new Uint8Array([1, 2, 3]) }], {
      schemaVersion: 2,
      exportedAt: new Date('2026-10-28T00:00:00Z'),
    });

    const { manifest, receipts } = await readBackupZip(zipBytes);
    expect(manifest.data).toEqual(dump);
    expect(manifest.schemaVersion).toBe(2);
    expect(receipts).toEqual([{ path: 'receipts/a.jpg', bytes: new Uint8Array([1, 2, 3]) }]);
  });

  it('rejects files that are not backups and ignores path traversal', async () => {
    await expect(readBackupZip(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(InvalidBackupError);
    const zip = new JSZip();
    zip.file('backup.json', JSON.stringify({ app: 'other' }));
    await expect(readBackupZip(await zip.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(
      InvalidBackupError,
    );

    const evil = new JSZip();
    evil.file('backup.json', JSON.stringify({ app: 'receipt-ledger', formatVersion: 1, data: { transactions: [] } }));
    evil.file('receipts/../../evil.sh', 'x');
    evil.file('receipts/ok.jpg', 'y');
    const { receipts } = await readBackupZip(await evil.generateAsync({ type: 'uint8array' }));
    expect(receipts.map((r) => r.path)).toEqual(['receipts/ok.jpg']);
  });
});

describe('csv export', () => {
  const tx = (over: Partial<TransactionView>): TransactionView => ({
    id: 1,
    account_id: 1,
    type: 'sent',
    amount_minor: 125050,
    occurred_at: fromLocalParts(2026, 10, 28, 17, 41).getTime(),
    counterparty: 'Ali, "Khan"',
    reference: 'TID1',
    category_id: null,
    note: '=HYPERLINK("x")',
    receipt_path: null,
    source: 'share',
    latitude: 24.86076,
    longitude: 67.00113,
    location_accuracy: 12,
    created_at: 0,
    updated_at: 0,
    account_label: 'Main',
    account_currency: 'PKR',
    bank_id: 1,
    bank_name: 'HBL',
    bank_color: '#000',
    category_name: 'Food',
    category_color: null,
    ...over,
  });

  it('writes local times, decimal amounts, escapes quotes and neutralizes formulas', () => {
    const csv = transactionsToCsv([
      tx({}),
      tx({
        id: 2,
        type: 'received',
        amount_minor: 100,
        counterparty: null,
        note: null,
        latitude: null,
        longitude: null,
      }),
    ]);
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'date,time,type,amount,signed_amount,currency,bank,account,counterparty,category,reference,note,source,latitude,longitude',
    );
    expect(lines[1]).toBe(
      '2026-10-28,17:41,sent,1250.50,-1250.50,PKR,HBL,Main,"Ali, ""Khan""",Food,TID1,"\'=HYPERLINK(""x"")",share,24.860760,67.001130',
    );
    expect(lines[2]).toBe('2026-10-28,17:41,received,1.00,1.00,PKR,HBL,Main,,Food,TID1,,share,,');
  });
});
