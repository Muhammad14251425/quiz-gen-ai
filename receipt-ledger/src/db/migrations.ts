import type { Db } from './driver';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export const DEFAULT_CATEGORIES: { name: string; color: string; icon: string }[] = [
  { name: 'Food', color: '#F59E0B', icon: 'fast-food' },
  { name: 'Bills', color: '#3B82F6', icon: 'flash' },
  { name: 'Rent', color: '#8B5CF6', icon: 'home' },
  { name: 'Transport', color: '#06B6D4', icon: 'car' },
  { name: 'Shopping', color: '#EC4899', icon: 'bag-handle' },
  { name: 'Family', color: '#10B981', icon: 'people' },
  { name: 'Salary', color: '#22C55E', icon: 'briefcase' },
  { name: 'Other', color: '#6B7280', icon: 'ellipsis-horizontal' },
];

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Append-only list. Never edit a shipped migration; add a new version instead.
 * Balances are never stored; they are always computed from transactions.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        last4 TEXT,
        currency TEXT NOT NULL DEFAULT 'PKR',
        opening_balance_minor INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT NOT NULL,
        icon TEXT
      )`,
      `CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('sent', 'received')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        occurred_at INTEGER NOT NULL,
        counterparty TEXT,
        reference TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        note TEXT,
        receipt_path TEXT,
        source TEXT NOT NULL CHECK (source IN ('share', 'gallery', 'manual')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE counterparties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        last_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        last_type TEXT CHECK (last_type IN ('sent', 'received')),
        use_count INTEGER NOT NULL DEFAULT 0
      )`,
      'CREATE INDEX idx_transactions_account_time ON transactions(account_id, occurred_at)',
      'CREATE INDEX idx_transactions_reference ON transactions(reference)',
      'CREATE INDEX idx_transactions_counterparty ON transactions(counterparty)',
      'CREATE INDEX idx_accounts_bank ON accounts(bank_id)',
      ...DEFAULT_CATEGORIES.map(
        (c) =>
          `INSERT INTO categories (name, color, icon) VALUES (${sqlString(c.name)}, ${sqlString(c.color)}, ${sqlString(c.icon)})`,
      ),
    ],
  },
  {
    version: 2,
    name: 'settings key/value store',
    statements: ['CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'],
  },
  {
    version: 3,
    name: 'optional transaction location',
    statements: [
      'ALTER TABLE transactions ADD COLUMN latitude REAL',
      'ALTER TABLE transactions ADD COLUMN longitude REAL',
      'ALTER TABLE transactions ADD COLUMN location_accuracy REAL',
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each in its own transaction, and records
 * progress in PRAGMA user_version. Safe to call on every app start.
 */
export async function migrate(db: Db, migrations: Migration[] = MIGRATIONS): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON');
  let current = await getSchemaVersion(db);
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      for (const sql of m.statements) await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return current;
}
