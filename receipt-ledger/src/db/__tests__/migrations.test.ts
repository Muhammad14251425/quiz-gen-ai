import { DEFAULT_CATEGORIES, getSchemaVersion, LATEST_VERSION, migrate, MIGRATIONS } from '../migrations';
import { createTestDb } from './testDb';

const tables = async (db: ReturnType<typeof createTestDb>) =>
  (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map(
    (r) => r.name,
  );

describe('migrations', () => {
  it('creates the full schema on a fresh database', async () => {
    const db = createTestDb();
    expect(await migrate(db)).toBe(LATEST_VERSION);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await tables(db)).toEqual(
      expect.arrayContaining(['accounts', 'banks', 'categories', 'counterparties', 'settings', 'transactions']),
    );
    const indexes = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'")).map(
      (r) => r.name,
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        'idx_transactions_account_time',
        'idx_transactions_reference',
        'idx_transactions_counterparty',
      ]),
    );
    const cats = await db.all<{ name: string }>('SELECT name FROM categories ORDER BY id');
    expect(cats.map((c) => c.name)).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
  });

  it('is idempotent', async () => {
    const db = createTestDb();
    await migrate(db);
    await migrate(db);
    expect(await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM categories')).toEqual({
      n: DEFAULT_CATEGORIES.length,
    });
  });

  it('upgrades an existing v1 database and keeps its data', async () => {
    const db = createTestDb();
    await migrate(
      db,
      MIGRATIONS.filter((m) => m.version === 1),
    );
    expect(await getSchemaVersion(db)).toBe(1);
    await db.run("INSERT INTO banks (name, color, created_at) VALUES ('HBL', '#000', 1)");
    expect(await tables(db)).not.toContain('settings');

    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await tables(db)).toContain('settings');
    expect(await db.get<{ name: string }>('SELECT name FROM banks')).toEqual({ name: 'HBL' });
  });

  it('rolls back a failing migration and leaves the version untouched', async () => {
    const db = createTestDb();
    await migrate(db);
    const broken = [
      ...MIGRATIONS,
      { version: LATEST_VERSION + 1, name: 'broken', statements: ['CREATE TABLE x (id INTEGER)', 'NOT SQL'] },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await tables(db)).not.toContain('x');
  });

  it('enforces positive amounts and valid types', async () => {
    const db = createTestDb();
    await migrate(db);
    await db.run("INSERT INTO banks (name, color, created_at) VALUES ('B', '#000', 1)");
    await db.run("INSERT INTO accounts (bank_id, label, created_at) VALUES (1, 'A', 1)");
    const insert = (type: string, amount: number) =>
      db.run(
        "INSERT INTO transactions (account_id, type, amount_minor, occurred_at, source, created_at, updated_at) VALUES (1, ?, ?, 1, 'manual', 1, 1)",
        [type, amount],
      );
    await expect(insert('sent', 0)).rejects.toThrow();
    await expect(insert('sent', -5)).rejects.toThrow();
    await expect(insert('gift', 5)).rejects.toThrow();
    await expect(insert('received', 5)).resolves.toBeDefined();
  });
});
