import { prepareImage, recognize } from '../../ocr/recognize';
import { parseReceipt, type ParseResult } from '../../parser';
import { fileDate } from '../../utils/files';

export interface PipelineResult {
  /** Downscaled JPEG to show and store with the transaction. */
  imageUri: string;
  parsed: ParseResult;
  ocrText: string;
  ocrError?: string;
}

/** image → downscale → OCR → parse. Never throws: failures yield an empty, low-confidence result. */
export async function runPipeline(uri: string): Promise<PipelineResult> {
  const fallbackDate = fileDate(uri);
  let imageUri = uri;
  try {
    imageUri = (await prepareImage(uri)).uri;
  } catch {
    // Keep the original if it cannot be decoded/resized; OCR may still work.
  }
  const ocr = await recognize(imageUri);
  const parsed = parseReceipt(ocr.text, ocr.blocks, { fallbackDate });
  return {
    imageUri,
    parsed,
    ocrText: ocr.text,
    ocrError: ocr.error ?? (ocr.text.trim() ? undefined : 'empty'),
  };
}
