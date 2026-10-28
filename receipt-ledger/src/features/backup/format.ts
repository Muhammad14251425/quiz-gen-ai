import JSZip from 'jszip';

import type { DataDump } from '../../db/repositories';
import type { TransactionView } from '../../db/types';
import { formatMinor } from '../../domain/money';
import { toLocalParts } from '../../utils/timezone';

export const BACKUP_APP_ID = 'receipt-ledger';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  data: DataDump;
}

export interface ReceiptFile {
  /** Relative path stored in transactions.receipt_path, e.g. "receipts/abc.jpg". */
  path: string;
  bytes: Uint8Array;
}

/** Zip layout: backup.json + receipts/<files>. */
export async function createBackupZip(
  data: DataDump,
  receipts: ReceiptFile[],
  meta: { schemaVersion: number; exportedAt: Date },
): Promise<Uint8Array> {
  const zip = new JSZip();
  const manifest: BackupManifest = {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: meta.schemaVersion,
    exportedAt: meta.exportedAt.toISOString(),
    data,
  };
  zip.file('backup.json', JSON.stringify(manifest));
  for (const r of receipts) {
    if (/^receipts\/[\w.-]+$/.test(r.path)) zip.file(r.path, r.bytes);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
}

export class InvalidBackupError extends Error {}

export async function readBackupZip(bytes: Uint8Array): Promise<{ manifest: BackupManifest; receipts: ReceiptFile[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new InvalidBackupError('Not a zip file');
  }
  const json = zip.file('backup.json');
  if (!json) throw new InvalidBackupError('backup.json missing');
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await json.async('string')) as BackupManifest;
  } catch {
    throw new InvalidBackupError('backup.json is not valid JSON');
  }
  if (
    manifest.app !== BACKUP_APP_ID ||
    typeof manifest.data !== 'object' ||
    !Array.isArray(manifest.data.transactions)
  ) {
    throw new InvalidBackupError('Not a Receipt Ledger backup');
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION)
    throw new InvalidBackupError('Backup is from a newer app version');

  const receipts: ReceiptFile[] = [];
  for (const entry of Object.values(zip.files)) {
    // Only flat files under receipts/ — rejects path traversal like receipts/../x.
    if (entry.dir || !/^receipts\/[\w.-]+$/.test(entry.name) || entry.name.includes('..')) continue;
    receipts.push({ path: entry.name, bytes: await entry.async('uint8array') });
  }
  return { manifest, receipts };
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  // Quote when needed; neutralize spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function transactionsToCsv(txs: TransactionView[]): string {
  const header = [
    'date',
    'time',
    'type',
    'amount',
    'signed_amount',
    'currency',
    'bank',
    'account',
    'counterparty',
    'category',
    'reference',
    'note',
    'source',
    'latitude',
    'longitude',
  ];
  const rows = txs.map((tx) => {
    const p = toLocalParts(tx.occurred_at);
    const amount = formatMinor(tx.amount_minor, { decimals: 'always' }).replace(/,/g, '');
    return [
      `${p.year}-${pad(p.month)}-${pad(p.day)}`,
      `${pad(p.hour)}:${pad(p.minute)}`,
      tx.type,
      amount,
      tx.type === 'sent' ? `-${amount}` : amount,
      tx.account_currency,
      tx.bank_name,
      tx.account_label,
      tx.counterparty,
      tx.category_name,
      tx.reference,
      tx.note,
      tx.source,
      tx.latitude != null ? tx.latitude.toFixed(6) : '',
      tx.longitude != null ? tx.longitude.toFixed(6) : '',
    ]
      .map(csvCell)
      .join(',');
  });
  // BOM so Excel opens UTF-8 correctly.
  return `﻿${[header.join(','), ...rows].join('\r\n')}\r\n`;
}
