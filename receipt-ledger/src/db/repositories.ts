import { counterpartyKey, findSimilar } from '../domain/counterparty';
import {
  findDuplicates,
  normalizeReference,
  type DuplicateCandidate,
  type DuplicateReason,
} from '../domain/duplicates';
import { startOfLocalDay } from '../utils/timezone';
import type { Db, SqlValue } from './driver';
import { DEFAULT_CATEGORIES } from './migrations';
import type {
  Account,
  AccountWithBalance,
  Bank,
  Category,
  Counterparty,
  NewTransaction,
  Transaction,
  TransactionView,
  TxType,
} from './types';

const now = () => Date.now();
const bool = (b: boolean | undefined) => (b ? 1 : 0);

// ---------------------------------------------------------------------------
// Banks
// ---------------------------------------------------------------------------

export interface BankInput {
  name: string;
  color: string;
  icon: string | null;
}

export async function listBanks(db: Db, opts: { includeArchived?: boolean } = {}): Promise<Bank[]> {
  return db.all<Bank>(
    `SELECT * FROM banks ${opts.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, name COLLATE NOCASE`,
  );
}

export async function getBank(db: Db, id: number): Promise<Bank | null> {
  return db.get<Bank>('SELECT * FROM banks WHERE id = ?', [id]);
}

export async function createBank(db: Db, input: BankInput): Promise<number> {
  const r = await db.run('INSERT INTO banks (name, color, icon, archived, created_at) VALUES (?, ?, ?, 0, ?)', [
    input.name.trim(),
    input.color,
    input.icon,
    now(),
  ]);
  return r.lastInsertRowId;
}

export async function updateBank(db: Db, id: number, input: BankInput): Promise<void> {
  await db.run('UPDATE banks SET name = ?, color = ?, icon = ? WHERE id = ?', [
    input.name.trim(),
    input.color,
    input.icon,
    id,
  ]);
}

/** Archiving a bank archives its accounts too; history is kept. */
export async function setBankArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.transaction(async () => {
    await db.run('UPDATE banks SET archived = ? WHERE id = ?', [bool(archived), id]);
    await db.run('UPDATE accounts SET archived = ? WHERE bank_id = ?', [bool(archived), id]);
  });
}

export async function countBankTransactions(db: Db, bankId: number): Promise<number> {
  const row = await db.get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE a.bank_id = ?',
    [bankId],
  );
  return row?.n ?? 0;
}

/** Permanently deletes a bank with its accounts and transactions. Returns receipt paths to clean up. */
export async function deleteBankCascade(db: Db, id: number): Promise<string[]> {
  const receipts = await db.all<{ receipt_path: string }>(
    `SELECT t.receipt_path FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.bank_id = ? AND t.receipt_path IS NOT NULL`,
    [id],
  );
  await db.run('DELETE FROM banks WHERE id = ?', [id]);
  return receipts.map((r) => r.receipt_path);
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface AccountInput {
  bank_id: number;
  label: string;
  last4: string | null;
  currency: string;
  opening_balance_minor: number;
}

const ACCOUNT_BALANCE_SELECT = `
  SELECT a.*,
         b.name AS bank_name, b.color AS bank_color, b.icon AS bank_icon, b.archived AS bank_archived,
         a.opening_balance_minor + COALESCE((
           SELECT SUM(CASE WHEN t.type = 'received' THEN t.amount_minor ELSE -t.amount_minor END)
           FROM transactions t WHERE t.account_id = a.id
         ), 0) AS balance_minor
  FROM accounts a JOIN banks b ON b.id = a.bank_id`;

export async function listAccounts(
  db: Db,
  opts: { includeArchived?: boolean; bankId?: number } = {},
): Promise<AccountWithBalance[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (!opts.includeArchived) where.push('a.archived = 0 AND b.archived = 0');
  if (opts.bankId !== undefined) {
    where.push('a.bank_id = ?');
    params.push(opts.bankId);
  }
  return db.all<AccountWithBalance>(
    `${ACCOUNT_BALANCE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY b.name COLLATE NOCASE, a.label COLLATE NOCASE`,
    params,
  );
}

export async function getAccount(db: Db, id: number): Promise<AccountWithBalance | null> {
  return db.get<AccountWithBalance>(`${ACCOUNT_BALANCE_SELECT} WHERE a.id = ?`, [id]);
}

export async function createAccount(db: Db, input: AccountInput): Promise<number> {
  const r = await db.run(
    `INSERT INTO accounts (bank_id, label, last4, currency, opening_balance_minor, archived, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [input.bank_id, input.label.trim(), input.last4, input.currency, input.opening_balance_minor, now()],
  );
  return r.lastInsertRowId;
}

export async function updateAccount(db: Db, id: number, input: AccountInput): Promise<void> {
  await db.run(
    'UPDATE accounts SET bank_id = ?, label = ?, last4 = ?, currency = ?, opening_balance_minor = ? WHERE id = ?',
    [input.bank_id, input.label.trim(), input.last4, input.currency, input.opening_balance_minor, id],
  );
}

export async function setAccountArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.run('UPDATE accounts SET archived = ? WHERE id = ?', [bool(archived), id]);
}

export async function deleteAccountCascade(db: Db, id: number): Promise<string[]> {
  const receipts = await db.all<{ receipt_path: string }>(
    'SELECT receipt_path FROM transactions WHERE account_id = ? AND receipt_path IS NOT NULL',
    [id],
  );
  await db.run('DELETE FROM accounts WHERE id = ?', [id]);
  return receipts.map((r) => r.receipt_path);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(db: Db): Promise<Category[]> {
  return db.all<Category>('SELECT * FROM categories ORDER BY id');
}

export async function createCategory(db: Db, input: Omit<Category, 'id'>): Promise<number> {
  const r = await db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', [
    input.name.trim(),
    input.color,
    input.icon,
  ]);
  return r.lastInsertRowId;
}

export async function updateCategory(db: Db, id: number, input: Omit<Category, 'id'>): Promise<void> {
  await db.run('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?', [
    input.name.trim(),
    input.color,
    input.icon,
    id,
  ]);
}

/** Transactions keep existing; their category becomes empty (ON DELETE SET NULL). */
export async function deleteCategory(db: Db, id: number): Promise<void> {
  await db.run('DELETE FROM categories WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface TxFilter {
  search?: string;
  accountIds?: number[];
  bankIds?: number[];
  type?: TxType;
  categoryIds?: number[];
  /** Inclusive start, epoch ms. */
  from?: number;
  /** Exclusive end, epoch ms. */
  to?: number;
  limit?: number;
}

const TX_VIEW_SELECT = `
  SELECT t.*, a.label AS account_label, a.currency AS account_currency,
         b.id AS bank_id, b.name AS bank_name, b.color AS bank_color,
         c.name AS category_name, c.color AS category_color
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN banks b ON b.id = a.bank_id
  LEFT JOIN categories c ON c.id = t.category_id`;

function inList(column: string, ids: number[], where: string[], params: SqlValue[]) {
  where.push(`${column} IN (${ids.map(() => '?').join(', ')})`);
  params.push(...ids);
}

export async function listTransactions(db: Db, filter: TxFilter = {}): Promise<TransactionView[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (filter.search?.trim()) {
    const q = `%${filter.search.trim().replace(/[%_]/g, '')}%`;
    where.push('(t.counterparty LIKE ? OR t.note LIKE ? OR t.reference LIKE ?)');
    params.push(q, q, q);
  }
  if (filter.accountIds?.length) inList('t.account_id', filter.accountIds, where, params);
  if (filter.bankIds?.length) inList('a.bank_id', filter.bankIds, where, params);
  if (filter.categoryIds?.length) inList('t.category_id', filter.categoryIds, where, params);
  if (filter.type) {
    where.push('t.type = ?');
    params.push(filter.type);
  }
  if (filter.from !== undefined) {
    where.push('t.occurred_at >= ?');
    params.push(filter.from);
  }
  if (filter.to !== undefined) {
    where.push('t.occurred_at < ?');
    params.push(filter.to);
  }
  const limit = filter.limit ? `LIMIT ${Math.floor(filter.limit)}` : '';
  return db.all<TransactionView>(
    `${TX_VIEW_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.occurred_at DESC, t.id DESC ${limit}`,
    params,
  );
}

export async function getTransaction(db: Db, id: number): Promise<TransactionView | null> {
  return db.get<TransactionView>(`${TX_VIEW_SELECT} WHERE t.id = ?`, [id]);
}

function assertValidAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Amount must be a positive whole number of paisa');
}

/** Inserts a transaction and updates counterparty memory in one DB transaction. */
export async function createTransaction(db: Db, tx: NewTransaction): Promise<number> {
  assertValidAmount(tx.amount_minor);
  return db.transaction(async () => {
    const t = now();
    const r = await db.run(
      `INSERT INTO transactions (account_id, type, amount_minor, occurred_at, counterparty, reference, category_id,
        note, receipt_path, source, latitude, longitude, location_accuracy, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.account_id,
        tx.type,
        tx.amount_minor,
        tx.occurred_at,
        tx.counterparty,
        tx.reference,
        tx.category_id,
        tx.note,
        tx.receipt_path,
        tx.source,
        tx.latitude ?? null,
        tx.longitude ?? null,
        tx.location_accuracy ?? null,
        t,
        t,
      ],
    );
    await rememberCounterparty(db, tx.counterparty, tx.category_id, tx.type);
    return r.lastInsertRowId;
  });
}

export async function updateTransaction(db: Db, id: number, tx: NewTransaction): Promise<void> {
  assertValidAmount(tx.amount_minor);
  await db.transaction(async () => {
    await db.run(
      `UPDATE transactions SET account_id = ?, type = ?, amount_minor = ?, occurred_at = ?, counterparty = ?,
        reference = ?, category_id = ?, note = ?, receipt_path = ?, source = ?, latitude = ?, longitude = ?,
        location_accuracy = ?, updated_at = ? WHERE id = ?`,
      [
        tx.account_id,
        tx.type,
        tx.amount_minor,
        tx.occurred_at,
        tx.counterparty,
        tx.reference,
        tx.category_id,
        tx.note,
        tx.receipt_path,
        tx.source,
        tx.latitude ?? null,
        tx.longitude ?? null,
        tx.location_accuracy ?? null,
        now(),
        id,
      ],
    );
    await rememberCounterparty(db, tx.counterparty, tx.category_id, tx.type, false);
  });
}

/** Returns the deleted row's receipt path (if any) so the caller can remove the file. */
export async function deleteTransaction(db: Db, id: number): Promise<string | null> {
  const row = await db.get<{ receipt_path: string | null }>('SELECT receipt_path FROM transactions WHERE id = ?', [id]);
  await db.run('DELETE FROM transactions WHERE id = ?', [id]);
  return row?.receipt_path ?? null;
}

/** Candidates with the same reference or the same amount on the same local day (±1 day window). */
export async function findDuplicateTransactions(
  db: Db,
  candidate: DuplicateCandidate,
): Promise<{ tx: TransactionView; reason: DuplicateReason }[]> {
  const dayStart = startOfLocalDay(candidate.occurred_at).getTime();
  const ref = normalizeReference(candidate.reference);
  const rows = await db.all<TransactionView>(
    `${TX_VIEW_SELECT}
     WHERE (t.amount_minor = ? AND t.occurred_at >= ? AND t.occurred_at < ?)
        ${ref.length >= 4 ? "OR UPPER(REPLACE(REPLACE(REPLACE(t.reference, '-', ''), ' ', ''), '/', '')) = ?" : ''}`,
    ref.length >= 4
      ? [candidate.amount_minor, dayStart - 86_400_000, dayStart + 2 * 86_400_000, ref]
      : [candidate.amount_minor, dayStart - 86_400_000, dayStart + 2 * 86_400_000],
  );
  return findDuplicates(candidate, rows);
}

// ---------------------------------------------------------------------------
// Counterparty memory
// ---------------------------------------------------------------------------

export async function rememberCounterparty(
  db: Db,
  name: string | null,
  categoryId: number | null,
  type: TxType,
  countUse = true,
): Promise<void> {
  const key = counterpartyKey(name);
  if (!name || !key) return;
  await db.run(
    `INSERT INTO counterparties (name, key, last_category_id, last_type, use_count) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET name = excluded.name,
       last_category_id = COALESCE(excluded.last_category_id, counterparties.last_category_id),
       last_type = excluded.last_type,
       use_count = counterparties.use_count + ?`,
    [name.trim(), key, categoryId, type, countUse ? 1 : 0],
  );
}

/** Exact key match first, then the most similar remembered name. */
export async function suggestForCounterparty(db: Db, name: string | null | undefined): Promise<Counterparty | null> {
  const key = counterpartyKey(name);
  if (!key) return null;
  const exact = await db.get<Counterparty>('SELECT * FROM counterparties WHERE key = ?', [key]);
  if (exact) return exact;
  const all = await db.all<Counterparty>('SELECT * FROM counterparties ORDER BY use_count DESC LIMIT 500');
  return findSimilar(key, all) ?? null;
}

export async function listCounterpartyNames(db: Db, prefix: string, limit = 5): Promise<string[]> {
  const rows = await db.all<{ name: string }>(
    'SELECT name FROM counterparties WHERE name LIKE ? ORDER BY use_count DESC LIMIT ?',
    [`${prefix.replace(/[%_]/g, '')}%`, limit],
  );
  return rows.map((r) => r.name);
}

// ---------------------------------------------------------------------------
// Settings (key/value, JSON encoded)
// ---------------------------------------------------------------------------

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface GroupTotal {
  key: string;
  label: string;
  color: string | null;
  total_minor: number;
  count: number;
}

export async function spendingBy(
  db: Db,
  dimension: 'counterparty' | 'category' | 'bank',
  range: { from: number; to: number },
  type: TxType = 'sent',
  currency = 'PKR',
): Promise<GroupTotal[]> {
  const group = {
    counterparty: {
      key: "COALESCE(NULLIF(TRIM(t.counterparty), ''), '—')",
      label: "COALESCE(NULLIF(TRIM(t.counterparty), ''), '—')",
      color: 'NULL',
    },
    category: { key: 'COALESCE(c.id, 0)', label: "COALESCE(c.name, 'Uncategorized')", color: 'c.color' },
    bank: { key: 'b.id', label: 'b.name', color: 'b.color' },
  }[dimension];
  return db.all<GroupTotal>(
    `SELECT CAST(${group.key} AS TEXT) AS key, ${group.label} AS label, MAX(${group.color}) AS color,
            SUM(t.amount_minor) AS total_minor, COUNT(*) AS count
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN banks b ON b.id = a.bank_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.type = ? AND t.occurred_at >= ? AND t.occurred_at < ? AND a.currency = ?
     GROUP BY ${group.key}
     ORDER BY total_minor DESC`,
    [type, range.from, range.to, currency],
  );
}

export async function flowBetween(
  db: Db,
  range: { from: number; to: number },
  currency = 'PKR',
): Promise<{ sent: number; received: number }> {
  const row = await db.get<{ sent: number | null; received: number | null }>(
    `SELECT SUM(CASE WHEN t.type = 'sent' THEN t.amount_minor END) AS sent,
            SUM(CASE WHEN t.type = 'received' THEN t.amount_minor END) AS received
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE t.occurred_at >= ? AND t.occurred_at < ? AND a.currency = ?`,
    [range.from, range.to, currency],
  );
  return { sent: row?.sent ?? 0, received: row?.received ?? 0 };
}

// ---------------------------------------------------------------------------
// Whole-database helpers (backup / reset)
// ---------------------------------------------------------------------------

export const DATA_TABLES = ['banks', 'accounts', 'categories', 'transactions', 'counterparties', 'settings'] as const;
export type DataTable = (typeof DATA_TABLES)[number];
export type DataDump = Record<DataTable, Record<string, SqlValue>[]>;

export async function dumpAll(db: Db): Promise<DataDump> {
  const out = {} as DataDump;
  for (const table of DATA_TABLES) out[table] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${table}`);
  return out;
}

/** Replaces all data. Column names are validated against the live schema. */
export async function restoreAll(db: Db, dump: Partial<DataDump>): Promise<void> {
  await db.transaction(async () => {
    for (const table of [...DATA_TABLES].reverse()) await db.run(`DELETE FROM ${table}`);
    for (const table of DATA_TABLES) {
      const rows = dump[table] ?? [];
      if (rows.length === 0) continue;
      const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
      for (const row of rows) {
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (keys.length === 0) continue;
        await db.run(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k] ?? null),
        );
      }
    }
  });
}

/** Wipes everything and restores the default categories. */
export async function deleteAllData(db: Db): Promise<void> {
  await db.transaction(async () => {
    for (const table of ['transactions', 'accounts', 'banks', 'counterparties', 'settings', 'categories']) {
      await db.run(`DELETE FROM ${table}`);
    }
    for (const c of DEFAULT_CATEGORIES) {
      await db.run('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)', [c.name, c.color, c.icon]);
    }
  });
}

export type { Account, Bank, Category, Counterparty, Transaction, TransactionView };
