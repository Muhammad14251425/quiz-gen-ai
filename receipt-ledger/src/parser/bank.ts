import { BANK_PROFILES } from './bankProfiles';
import type { BankProfile } from './types';

/** Lines naming the other party's bank should not decide which app produced the receipt. */
const COUNTERPARTY_BANK_LINE =
  /\b(beneficiary|receiver|recipient|sender|to|destination|payee)('s)?\s+(bank|institution|wallet)\b|^bank\s*(name)?\s*[:\-]/i;

const HEADER_LINES = 3;

/** "Sent with NayaPay", "Paid via JazzCash", "Powered by HBL" name the app that made the receipt. */
const SOURCE_APP_LINE = /\b((sent|paid|transferred)\s+(with|via|using|from)|powered\s+by)\b/i;

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i');
}

export function compileProfiles(profiles: BankProfile[]) {
  return profiles.map((profile) => ({
    profile,
    regexes: profile.keywords.map(keywordRegex),
    hints: (profile.layoutHints ?? []).map(keywordRegex),
  }));
}

const COMPILED = compileProfiles(BANK_PROFILES);

export interface BankExtraction {
  bank?: BankProfile;
  confidence: number;
}

export function detectBank(lines: string[], profiles = COMPILED): BankExtraction {
  let best: { profile: BankProfile; score: number } | undefined;
  for (const { profile, regexes, hints } of profiles) {
    let score = 0;
    lines.forEach((line, i) => {
      if (COUNTERPARTY_BANK_LINE.test(line)) return;
      if (regexes.some((r) => r.test(line))) {
        score += SOURCE_APP_LINE.test(line) ? 3 : i < HEADER_LINES ? 2 : 1;
      } else if (hints.some((r) => r.test(line))) {
        score += 0.5;
      }
    });
    score *= profile.priority ?? 1;
    if (score > 0 && (!best || score > best.score)) best = { profile, score };
  }
  if (!best) return { confidence: 0 };
  return { bank: best.profile, confidence: best.score >= 2 ? 0.9 : best.score >= 1 ? 0.6 : 0.35 };
}
