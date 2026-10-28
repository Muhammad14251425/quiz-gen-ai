import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MlKit from 'expo-mlkit-ocr';

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

export function isOcrAvailable(): boolean {
  try {
    return MlKit.isSupported();
  } catch {
    return false;
  }
}

/** On-device text recognition with ML Kit v2 (bundled Latin model, works offline). */
export async function recognize(uri: string): Promise<OcrResult> {
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
