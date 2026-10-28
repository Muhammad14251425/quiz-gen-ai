import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '../src/components/display';
import { AppText, Banner, Button, Card, Divider, ListRow, SectionTitle } from '../src/components/ui';
import { useDb } from '../src/db/client';
import { seedSampleData } from '../src/features/debug/seed';
import { useImportQueue } from '../src/features/import/queue';
import { showToast } from '../src/features/toast/store';
import { isOcrAvailable } from '../src/ocr/recognize';
import { bumpData } from '../src/store/data';
import { useSettings } from '../src/store/settings';
import { copyToIncoming } from '../src/utils/files';

type Sample = { name: string; key: string; module: number };
// Required only in development so production bundles don't ship the sample images.
const SAMPLES: Sample[] = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('../src/features/debug/samples') as { SAMPLE_RECEIPTS: Sample[] }).SAMPLE_RECEIPTS
  : [];
const SAMPLE_TEXTS: Record<string, string> = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('../src/features/debug/sampleTexts') as { SAMPLE_TEXTS: Record<string, string> }).SAMPLE_TEXTS
  : {};

async function sampleUri(sample: Sample): Promise<string> {
  const asset = Asset.fromModule(sample.module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  try {
    return await copyToIncoming(uri);
  } catch {
    return uri; // web has no file system; the image is still viewable
  }
}

/** Developer tools: seed demo data and push the bundled sample receipts through the real import pipeline. */
export default function DebugScreen() {
  const db = useDb();
  const update = useSettings((s) => s.update);
  const enqueue = useImportQueue((s) => s.enqueue);
  const enqueueItems = useImportQueue((s) => s.enqueueItems);
  const [busy, setBusy] = useState(false);

  if (!__DEV__) return null;

  const queue = async (samples: Sample[]) => {
    setBusy(true);
    try {
      const uris = [];
      for (const s of samples) uris.push(await sampleUri(s));
      enqueue(uris, 'share');
      router.push('/import');
    } catch (e) {
      Alert.alert('Could not load samples', String(e));
    } finally {
      setBusy(false);
    }
  };

  // Emulators/web: skip ML Kit and feed the receipts' recorded OCR text through the same parser and form.
  const simulate = async () => {
    setBusy(true);
    try {
      const items = [];
      for (const s of SAMPLES) {
        items.push({ sourceUri: await sampleUri(s), source: 'share' as const, presetText: SAMPLE_TEXTS[s.key] ?? '' });
      }
      enqueueItems(items);
      router.push('/import');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Banner tone="info">Development build only. These tools are hidden in production.</Banner>
      <Card style={{ gap: 4 }}>
        <AppText>
          ML Kit OCR available: {isOcrAvailable() ? 'yes' : 'no (use a dev build on a device/emulator)'}
        </AppText>
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Button
        title="Load sample banks & transactions"
        icon="flask-outline"
        loading={busy}
        onPress={async () => {
          const n = await seedSampleData(db);
          await update(db, { onboarded: true });
          bumpData();
          showToast({ message: `Loaded 4 banks and ${n} transactions` });
        }}
      />

      <SectionTitle>Sample receipts (real OCR)</SectionTitle>
      <Button
        title={`Share all ${SAMPLES.length} receipts to the app`}
        icon="images-outline"
        loading={busy}
        onPress={() => void queue(SAMPLES)}
      />
      <Button
        title="Simulate share without OCR (emulator)"
        variant="secondary"
        icon="document-text-outline"
        loading={busy}
        onPress={() => void simulate()}
      />
      <Card style={{ paddingVertical: 0 }}>
        {SAMPLES.map((s, i) => (
          <View key={s.name}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={s.name} icon="receipt-outline" onPress={() => void queue([s])} />
          </View>
        ))}
      </Card>

      <SectionTitle>Onboarding</SectionTitle>
      <Button
        title="Show onboarding again"
        variant="secondary"
        onPress={async () => {
          await update(db, { onboarded: false });
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}
