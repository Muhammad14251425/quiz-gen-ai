export interface OcrFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrLine {
  text: string;
  frame?: OcrFrame;
}

export interface OcrBlock {
  text: string;
  frame?: OcrFrame;
  lines?: OcrLine[];
}

export type Direction = 'sent' | 'received';

export type ParsedField = 'amount' | 'date' | 'counterparty' | 'reference' | 'bank' | 'direction';

export interface ParseResult {
  /** Amount in minor units (paisa). Always a positive integer when present. */
  amount?: number;
  currency?: string;
  /** Instant of the transaction. Receipt-local times are interpreted as Asia/Karachi. */
  date?: Date;
  counterparty?: string;
  reference?: string;
  /** Bank profile id (see bankProfiles.ts), e.g. "jazzcash". */
  bankHint?: string;
  /** Only a suggestion; the user always confirms. */
  directionHint?: Direction;
  /** 0..1 per field. Missing fields have confidence 0. */
  confidence: Record<ParsedField, number>;
}

export interface ParseOptions {
  /** e.g. the screenshot file's modification time; used when no date is found in the text. */
  fallbackDate?: Date;
  /** Injected for tests; defaults to new Date(). */
  now?: Date;
}

export interface BankProfile {
  /** Stable id stored in the DB as the bank's preset/icon id. */
  id: string;
  name: string;
  /** Brand-ish color used for the bank card. */
  color: string;
  /** Lowercase keywords matched on word boundaries. */
  keywords: string[];
  /**
   * Multiplier when several profiles match. Payment rails that appear on many
   * banks' receipts (Raast) get < 1; sub-brands (Konnect by HBL) get > 1.
   */
  priority?: number;
  /**
   * Weak layout phrases typical of this app's receipts when its name is only a
   * logo (e.g. Easypaisa's "Successfully Sent to"). Each hit scores 0.5.
   */
  layoutHints?: string[];
  /** Extra labels (lowercase) that introduce the counterparty on this bank's receipts. */
  counterpartyLabels?: string[];
  /** Extra labels (lowercase) that introduce the transaction reference. */
  referenceLabels?: string[];
  kind: 'bank' | 'wallet' | 'rail';
}
