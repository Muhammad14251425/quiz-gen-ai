import { createTestDb } from '../../../db/__tests__/testDb';
import { getSchemaVersion, migrate, MIGRATIONS } from '../../../db/migrations';
import * as repo from '../../../db/repositories';
import { ATTACH_WINDOW_MS, formatPoint, mapsUrl, shouldAttachLocation } from '../location';

jest.mock('expo-location', () => ({}));

describe('location rules', () => {
  const now = Date.UTC(2026, 9, 28, 12);

  it('attaches only to transactions from the last 2 hours', () => {
    expect(shouldAttachLocation(now - 5 * 60_000, now)).toBe(true);
    expect(shouldAttachLocation(now - ATTACH_WINDOW_MS, now)).toBe(true);
    expect(shouldAttachLocation(now - ATTACH_WINDOW_MS - 1, now)).toBe(false);
    expect(shouldAttachLocation(now - 3 * 86_400_000, now)).toBe(false);
  });

  it('formats coordinates and builds a geo: link', () => {
    expect(formatPoint(24.860761, 67.001133)).toBe('24.86076, 67.00113');
    expect(mapsUrl(24.86, 67, 'Cafe & Co')).toBe('geo:24.86,67?q=24.86,67(Cafe%20%26%20Co)');
  });
});

describe('location storage', () => {
  async function setup() {
    const db = createTestDb();
    await migrate(db);
    const bank = await repo.createBank(db, { name: 'HBL', color: '#000', icon: 'hbl' });
    const account = await repo.createAccount(db, {
      bank_id: bank,
      label: 'Main',
      last4: null,
      currency: 'PKR',
      opening_balance_minor: 0,
    });
    return { db, account };
  }

  const base = {
    type: 'sent' as const,
    amount_minor: 500,
    occurred_at: 1,
    counterparty: 'Ali',
    reference: null,
    category_id: null,
    note: null,
    receipt_path: null,
    source: 'share' as const,
  };
  const point = { latitude: 24.8607, longitude: 67.0011, location_accuracy: 15 };
  const none = { latitude: null, longitude: null, location_accuracy: null };

  it('migration v3 adds empty location columns to existing transactions', async () => {
    const db = createTestDb();
    await migrate(
      db,
      MIGRATIONS.filter((m) => m.version < 3),
    );
    await db.run("INSERT INTO banks (name, color, created_at) VALUES ('B', '#000', 1)");
    await db.run("INSERT INTO accounts (bank_id, label, created_at) VALUES (1, 'A', 1)");
    await db.run(
      "INSERT INTO transactions (account_id, type, amount_minor, occurred_at, source, created_at, updated_at) VALUES (1, 'sent', 5, 1, 'manual', 1, 1)",
    );
    await migrate(db);
    expect(await getSchemaVersion(db)).toBeGreaterThanOrEqual(3);
    expect(await db.get('SELECT latitude, longitude, location_accuracy FROM transactions')).toEqual(none);
  });

  it('saves the location, keeps it on edit and removes it on request', async () => {
    const { db, account } = await setup();
    const id = await repo.createTransaction(db, { ...base, account_id: account, ...point });
    expect(await repo.getTransaction(db, id)).toMatchObject(point);

    await repo.updateTransaction(db, id, { ...base, account_id: account, note: 'edited', ...point });
    expect(await repo.getTransaction(db, id)).toMatchObject({ note: 'edited', ...point });

    await repo.updateTransaction(db, id, { ...base, account_id: account, ...none });
    expect(await repo.getTransaction(db, id)).toMatchObject(none);
  });

  it('stores no location by default', async () => {
    const { db, account } = await setup();
    const id = await repo.createTransaction(db, { ...base, account_id: account });
    expect(await repo.getTransaction(db, id)).toMatchObject(none);
  });
});
