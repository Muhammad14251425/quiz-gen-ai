import { parseReceipt } from '../../parser';
import type { PipelineResult } from './pipeline';

/** Used by the dev debug screen to demo the flow on emulators without OCR. */
export async function runPresetPipeline(uri: string, text: string): Promise<PipelineResult> {
  return { imageUri: uri, parsed: parseReceipt(text), ocrText: text };
}
