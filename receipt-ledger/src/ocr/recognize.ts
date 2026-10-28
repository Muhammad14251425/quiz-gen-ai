import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { requireOptionalNativeModule } from 'expo';
import type { RecognitionResult } from 'expo-mlkit-ocr';

import type { OcrBlock } from '../parser';

/** Width cap keeps text legible for ML Kit while bounding memory for huge screenshots. */
const MAX_WIDTH = 1440;
const MAX_PIXELS = 12_000_000;

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Normalizes any input (HEIC, PNG, huge or long screenshots) to a JPEG no wider
 * than MAX_WIDTH. The result is also the copy stored with the transaction.
 */
export async function prepareImage(uri: string): Promise<PreparedImage> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width, height } = original;
  const scale = Math.min(1, MAX_WIDTH / width, Math.sqrt(MAX_PIXELS / (width * height)));
  const image =
    scale < 1
      ? await ImageManipulator.manipulate(original)
          .resize({ width: Math.round(width * scale) })
          .renderAsync()
      : original;
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
  /** Set when recognition failed; the caller falls back to manual entry. */
  error?: string;
}

interface MlKitModule {
  recognizeText(uri: string): Promise<RecognitionResult>;
}

/**
 * Loaded optionally (not via `import 'expo-mlkit-ocr'`, which throws when the
 * native module is missing) so the app still runs in Expo Go, where ML Kit is
 * not available: imports then fall back to manual entry.
 */
const MlKit = requireOptionalNativeModule<MlKitModule>('ExpoMlkitOcr');

export function isOcrAvailable(): boolean {
  return MlKit != null;
}

/** On-device text recognition with ML Kit v2 (bundled Latin model, works offline). */
export async function recognize(uri: string): Promise<OcrResult> {
  if (!MlKit) return { text: '', blocks: [], error: 'OCR is not available in this build (Expo Go)' };
  try {
    const result = await MlKit.recognizeText(uri);
    const blocks: OcrBlock[] = result.blocks.map((b) => ({
      text: b.text,
      frame: b.boundingBox,
      lines: b.lines.map((l) => ({ text: l.text, frame: l.boundingBox })),
    }));
    return { text: result.text ?? '', blocks };
  } catch (e) {
    return { text: '', blocks: [], error: e instanceof Error ? e.message : String(e) };
  }
}
