import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

import { copyToIncoming } from '../../utils/files';
import { useImportQueue } from '../import/queue';

function toFileUri(path: string): string {
  return path.startsWith('/') ? `file://${path}` : path;
}

/**
 * Receives images shared from the gallery or other apps — whether the app was
 * cold-started, backgrounded or already open on another screen — copies them
 * into app storage, queues them and opens the Import screen.
 */
export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const enqueue = useImportQueue((s) => s.enqueue);

  useEffect(() => {
    if (!hasShareIntent) return;
    const files = (shareIntent.files ?? []).filter((f) => !f.mimeType || f.mimeType.startsWith('image/'));
    let cancelled = false;
    (async () => {
      const uris: string[] = [];
      for (const f of files) {
        const uri = toFileUri(f.path);
        try {
          uris.push(await copyToIncoming(uri));
        } catch {
          uris.push(uri);
        }
      }
      if (cancelled) return;
      resetShareIntent();
      if (uris.length > 0) {
        enqueue(uris, 'share');
        router.navigate('/import');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only react to new share intents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, shareIntent]);

  return null;
}
