import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Db } from '../../db/driver';
import { getSchemaVersion } from '../../db/migrations';
import * as repo from '../../db/repositories';
import { bumpData } from '../../store/data';
import { useSettings } from '../../store/settings';
import { cacheFile, deleteAllReceipts, receiptsDir } from '../../utils/files';
import { localDayKey } from '../../utils/timezone';
import { createBackupZip, readBackupZip, transactionsToCsv, type BackupManifest, type ReceiptFile } from './format';

async function share(file: File, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.zip-archive',
  });
}

export async function exportBackup(db: Db): Promise<void> {
  const data = await repo.dumpAll(db);
  const receipts: ReceiptFile[] = [];
  for (const row of data.transactions) {
    const path = row.receipt_path;
    if (typeof path !== 'string') continue;
    const f = new File(Paths.document, path);
    if (f.exists) receipts.push({ path, bytes: await f.bytes() });
  }
  const bytes = await createBackupZip(data, receipts, {
    schemaVersion: await getSchemaVersion(db),
    exportedAt: new Date(),
  });
  const out = cacheFile(`receipt-ledger-backup-${localDayKey(Date.now())}.zip`);
  if (out.exists) out.delete();
  await out.write(bytes);
  await share(out, 'application/zip', 'Receipt Ledger backup');
}

/** Lets the user pick a backup and returns its parsed contents without applying it. */
export async function pickBackup(): Promise<{ manifest: BackupManifest; receipts: ReceiptFile[] } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const bytes = await new File(result.assets[0].uri).bytes();
  return readBackupZip(bytes);
}

/** Replaces all data and receipt images with the backup's. */
export async function applyBackup(
  db: Db,
  backup: { manifest: BackupManifest; receipts: ReceiptFile[] },
): Promise<void> {
  await repo.restoreAll(db, backup.manifest.data);
  deleteAllReceipts();
  const dir = receiptsDir();
  for (const r of backup.receipts) {
    await new File(dir, r.path.slice('receipts/'.length)).write(r.bytes);
  }
  await useSettings.getState().load(db);
  bumpData();
}

export async function exportCsv(db: Db): Promise<void> {
  const txs = await repo.listTransactions(db);
  const out = cacheFile(`receipt-ledger-transactions-${localDayKey(Date.now())}.csv`);
  if (out.exists) out.delete();
  await out.write(transactionsToCsv(txs));
  await share(out, 'text/csv', 'Transactions CSV');
}

export async function wipeEverything(db: Db): Promise<void> {
  await repo.deleteAllData(db);
  deleteAllReceipts();
  await useSettings.getState().load(db);
  bumpData();
}
