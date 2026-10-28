/**
 * OCR text normalization. Produces trimmed, non-empty lines with:
 *  - a single canonical currency token "Rs " in front of amounts (Rs, Rs., RS, PKR, ₨),
 *  - common OCR letter/digit confusions fixed inside numeric tokens (O→0, l/I/|→1, S→5),
 *  - collapsed whitespace and unified punctuation.
 */

const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0',
  o: '0',
  l: '1',
  I: '1',
  '|': '1',
  S: '5',
};

/** Characters allowed in a token we treat as "numeric with OCR noise". */
const NUMERIC_NOISY = /^[-+]?[0-9OolI|S,.:/-]+$/;

function fixNumericToken(token: string): string {
  // Keep trailing sentence punctuation outside the fix.
  const m = /^(.*?)([,.;:)]*)$/.exec(token);
  const core = m ? m[1] : token;
  const tail = m ? m[2] : '';
  if (!core || !NUMERIC_NOISY.test(core)) return token;
  const digits = (core.match(/\d/g) ?? []).length;
  // A real digit is required so words like "SOS" or "lol" stay untouched.
  if (digits === 0) return token;
  return core.replace(/[OolI|S]/g, (c) => LETTER_TO_DIGIT[c]) + tail;
}

const CURRENCY = /(^|[^A-Za-z])(₨|PKR|Pkr|pkr|Rs|RS|rs)\.?\s*(?=[-+]?\s?[0-9OolI])/g;

export function normalizeLine(line: string): string {
  let s = line
    .replace(/[  -​  　\t]/g, ' ')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/₨\s*/g, 'Rs ')
    .replace(/¢/g, 'c'); // common OCR confusion inside hex transaction IDs

  // Split "Rs1O" style glued tokens before fixing digits.
  s = s.replace(CURRENCY, (_m, pre: string) => `${pre}Rs `);
  s = s.split(/\s+/).map(fixNumericToken).join(' ');
  // Re-run currency unification now that digits are fixed ("Rs.5OO" → "Rs 500").
  s = s.replace(CURRENCY, (_m, pre: string) => `${pre}Rs `);
  return s.replace(/\s+/g, ' ').trim();
}

export function normalizeText(raw: string): string[] {
  return (raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .filter((l) => l.length > 0);
}
