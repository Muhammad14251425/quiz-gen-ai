import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const RECEIPTS_DIR = 'receipts';
const INCOMING_DIR = 'incoming';

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function receiptsDir(): Directory {
  return ensureDir(new Directory(Paths.document, RECEIPTS_DIR));
}

function extensionOf(uri: string): string {
  const m = /\.(jpe?g|png|webp|heic)(?:\?|$)/i.exec(uri);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

/**
 * Copies an image into app-private storage and returns its path relative to
 * the document directory. Relative paths survive iOS container path changes
 * and are portable in backups.
 */
export async function storeReceipt(sourceUri: string): Promise<string> {
  const name = `${Crypto.randomUUID()}.${extensionOf(sourceUri)}`;
  const dest = new File(receiptsDir(), name);
  await new File(sourceUri).copy(dest);
  return `${RECEIPTS_DIR}/${name}`;
}

export function resolveReceipt(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  return new File(Paths.document, relativePath).uri;
}

export function receiptExists(relativePath: string | null | undefined): boolean {
  if (!relativePath) return false;
  return new File(Paths.document, relativePath).exists;
}

export function deleteReceipt(relativePath: string | null | undefined): void {
  if (!relativePath) return;
  try {
    const f = new File(Paths.document, relativePath);
    if (f.exists) f.delete();
  } catch {
    // Missing files are fine; the DB row is the source of truth.
  }
}

export function deleteAllReceipts(): void {
  const dir = new Directory(Paths.document, RECEIPTS_DIR);
  if (dir.exists) dir.delete();
}

/**
 * Shared files can live in temporary locations owned by other apps; copy them
 * into our cache right away so the import queue survives backgrounding.
 */
export async function copyToIncoming(sourceUri: string): Promise<string> {
  const dir = ensureDir(new Directory(Paths.cache, INCOMING_DIR));
  const dest = new File(dir, `${Crypto.randomUUID()}.${extensionOf(sourceUri)}`);
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

/** Modification time of a file, used as the fallback receipt date. */
export function fileDate(uri: string): Date | undefined {
  try {
    const info = new File(uri).info();
    const t = info.modificationTime ?? info.creationTime;
    if (!t) return undefined;
    // Some platforms report seconds, others milliseconds.
    return new Date(t < 1e12 ? t * 1000 : t);
  } catch {
    return undefined;
  }
}

export function cacheFile(name: string): File {
  return new File(Paths.cache, name);
}
