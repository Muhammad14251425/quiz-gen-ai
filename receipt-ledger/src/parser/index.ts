import { extractAmount } from './amount';
import { detectBank } from './bank';
import { extractCounterparty } from './counterparty';
import { extractDate } from './date';
import { extractDirection } from './direction';
import { textFromBlocks } from './layout';
import { normalizeText } from './normalize';
import { extractReference } from './reference';
import type { OcrBlock, ParseOptions, ParseResult } from './types';

export type { OcrBlock, ParseOptions, ParseResult, BankProfile, Direction, ParsedField } from './types';
export { BANK_PROFILES, getBankProfile } from './bankProfiles';

/** Fields at or below this confidence are highlighted for the user to check. */
export const LOW_CONFIDENCE = 0.6;

/**
 * Extracts amount, date/time, counterparty, reference, bank and direction from
 * the OCR text of a payment receipt. Pure and synchronous.
 *
 * When `ocrBlocks` carry geometry, visual rows are rebuilt from them (two-column
 * receipts read better that way); otherwise `ocrText` is used as-is.
 */
export function parseReceipt(ocrText: string, ocrBlocks?: OcrBlock[], options: ParseOptions = {}): ParseResult {
  const now = options.now ?? new Date();
  const source = textFromBlocks(ocrBlocks) ?? ocrText ?? '';
  const lines = normalizeText(source);
  const flat = lines.join('\n');

  const bank = detectBank(lines);
  const direction = extractDirection(flat);
  const dateResult = extractDate(lines, now);
  const amount = extractAmount(lines, dateResult.spans);
  const counterparty = extractCounterparty(lines, direction.direction, bank.bank?.counterpartyLabels);
  const reference = extractReference(lines, bank.bank?.referenceLabels);

  let date = dateResult.date;
  let dateConfidence = dateResult.confidence;
  if (!date) {
    if (options.fallbackDate && !Number.isNaN(options.fallbackDate.getTime())) {
      date = options.fallbackDate;
      dateConfidence = 0.3;
    } else {
      date = now;
      dateConfidence = 0.1;
    }
  }

  return {
    amount: amount.amount,
    currency: amount.amount !== undefined ? 'PKR' : undefined,
    date,
    counterparty: counterparty.counterparty,
    reference: reference.reference,
    bankHint: bank.bank?.id,
    directionHint: direction.direction,
    confidence: {
      amount: amount.confidence,
      date: dateConfidence,
      counterparty: counterparty.confidence,
      reference: reference.confidence,
      bank: bank.confidence,
      direction: direction.confidence,
    },
  };
}
