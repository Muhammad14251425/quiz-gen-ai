import { getShareExtensionKey } from 'expo-share-intent';

/**
 * iOS share extension opens the app with `receiptledger://dataUrl=<key>`.
 * Send it to the Import screen instead of an unmatched route; the share
 * handler fills the queue moments later.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/import';
    return path;
  } catch {
    return '/';
  }
}
