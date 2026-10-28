import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { useImportQueue } from './queue';

/** Lets users without the share sheet run the same OCR pipeline on gallery images. */
export async function importFromGallery(): Promise<void> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
    exif: false,
  });
  if (result.canceled || result.assets.length === 0) return;
  useImportQueue.getState().enqueue(
    result.assets.map((a) => a.uri),
    'gallery',
  );
  router.navigate('/import');
}
