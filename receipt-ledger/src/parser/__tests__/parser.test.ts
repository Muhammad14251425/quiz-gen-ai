import { readFileSync } from 'fs';
import { join } from 'path';

import { parseMoneyInput } from '../../domain/money';
import { fromLocalParts, toLocalParts } from '../../utils/timezone';
import { CASES } from '../__fixtures__/cases';
import { BANK_PROFILES, parseReceipt } from '../index';
import { normalizeLine, normalizeText } from '../normalize';
import { cleanName } from '../counterparty';
import { textFromBlocks } from '../layout';
import { detectBank, compileProfiles } from '../bank';

const NOW = fromLocalParts(2026, 10, 28, 18, 0);
const fixture = (name: string) => readFileSync(join(__dirname, '..', '__fixtures__', name), 'utf8');

function localString(d: Date): string {
  const p = toLocalParts(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

describe('fixtures', () => {
  it('has at least 15 receipt fixtures', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(15);
  });

  describe.each(CASES)('$file', (c) => {
    const result = parseReceipt(fixture(c.file), undefined, { now: NOW });

    it('extracts the amount in paisa', () => {
      expect(result.amount).toBe(parseMoneyInput(c.amount));
      expect(Number.isInteger(result.amount)).toBe(true);
      expect(result.confidence.amount).toBeGreaterThan(0.5);
    });
    it('extracts the date and time (Asia/Karachi)', () => {
      if (c.noDate) {
        expect(result.date).toEqual(NOW); // fallback, flagged as low confidence
        expect(result.confidence.date).toBeLessThan(0.5);
      } else {
        expect(result.date && localString(result.date)).toBe(c.date);
        expect(result.confidence.date).toBeGreaterThan(0.5);
      }
    });
    it('extracts the counterparty', () => {
      expect(result.counterparty).toBe(c.counterparty);
    });
    it('extracts the reference', () => {
      expect(result.reference).toBe(c.reference);
    });
    it('detects the bank', () => {
      expect(result.bankHint).toBe(c.bank);
    });
    it('suggests the direction', () => {
      expect(result.directionHint).toBe(c.direction);
    });
  });

  it('handles unreadable text without throwing and falls back to the file date', () => {
    const fileDate = fromLocalParts(2026, 10, 1, 9, 0);
    const r = parseReceipt(fixture('17_unreadable.txt'), undefined, { now: NOW, fallbackDate: fileDate });
    expect(r.amount).toBeUndefined();
    expect(r.counterparty).toBeUndefined();
    expect(r.reference).toBeUndefined();
    expect(r.date).toEqual(fileDate);
    expect(r.confidence.date).toBeLessThan(0.5);
    expect(r.confidence.amount).toBe(0);
  });

  it('falls back to now when there is no date and no file date', () => {
    const r = parseReceipt('', undefined, { now: NOW });
    expect(r.date).toEqual(NOW);
    expect(r.confidence.date).toBeLessThan(0.2);
  });
});

describe('normalization', () => {
  it('unifies currency tokens', () => {
    expect(normalizeLine('PKR25,000')).toBe('Rs 25,000');
    expect(normalizeLine('Rs.1,250.00')).toBe('Rs 1,250.00');
    expect(normalizeLine('₨ 500')).toBe('Rs 500');
    expect(normalizeLine('RS 10')).toBe('Rs 10');
  });
  it('fixes OCR confusions only inside numeric tokens', () => {
    expect(normalizeLine('Rs.1O,5OO.OO')).toBe('Rs 10,500.00');
    expect(normalizeLine('TID O98765432l09')).toBe('TID 098765432109');
    expect(normalizeLine('Total 1S0')).toBe('Total 150');
    expect(normalizeLine('SOS Oil lol')).toBe('SOS Oil lol');
  });
  it('collapses whitespace and drops empty lines', () => {
    expect(normalizeText('  a   b \n\n\t c ')).toEqual(['a b', 'c']);
  });
});

describe('amount', () => {
  const amountOf = (text: string) => parseReceipt(text, undefined, { now: NOW }).amount;

  it.each([
    ['Rs. 1,250.00', 125000],
    ['PKR 25,000', 2500000],
    ['Amount\n1250', 125000],
    ['Amount Transferred: 3,000', 300000],
    ['Total Amount Rs 4,321.5', 432150],
    ['Amount Sent Rs 75', 7500],
  ])('parses %p', (text, expected) => {
    expect(amountOf(text)).toBe(expected);
  });

  it('prefers the labeled amount over fees, balances and IDs', () => {
    const text =
      'Fee Rs 25\nAvailable Balance Rs 99,000\nTransaction ID 123456789012\nAmount Rs 1,000\nMobile 03001234567';
    expect(amountOf(text)).toBe(100000);
  });

  it('ignores years, dates, times and phone numbers', () => {
    expect(amountOf('28 Oct 2026 05:41 PM\n0301-2345678\nRs 600')).toBe(60000);
  });

  it('never returns zero or negative amounts', () => {
    expect(amountOf('Amount Rs 0.00')).toBeUndefined();
    expect(amountOf('- Rs 850')).toBe(85000);
  });
});

describe('dates', () => {
  const dateOf = (text: string) => {
    const d = parseReceipt(text, undefined, { now: NOW }).date;
    return d ? localString(d) : undefined;
  };

  it.each([
    ['28 Oct 2026', '2026-10-28 00:00'],
    ['28-10-2026', '2026-10-28 00:00'],
    ['28/10/26', '2026-10-28 00:00'],
    ['Oct 28, 2026 05:41 PM', '2026-10-28 17:41'],
    ['2026-10-28 17:41:03', '2026-10-28 17:41'],
    ['10/28/2026', '2026-10-28 00:00'],
    ['Date: 1st November 2025 12:05 am', '2025-11-01 00:05'],
  ])('parses %p', (text, expected) => {
    expect(dateOf(text)).toBe(expected);
  });

  it('defaults to day-first for ambiguous numeric dates', () => {
    expect(dateOf('03/04/2026')).toBe('2026-04-03 00:00');
    expect(parseReceipt('03/04/2026', undefined, { now: NOW }).confidence.date).toBeLessThan(0.8);
  });

  it('stores times as Asia/Karachi instants', () => {
    const d = parseReceipt('2026-10-28 17:41', undefined, { now: NOW }).date!;
    expect(d.toISOString()).toBe('2026-10-28T12:41:00.000Z');
  });
});

describe('counterparty', () => {
  it('strips account numbers, IBANs and phones and title-cases', () => {
    expect(cleanName('ALI RAZA 03001234567')).toBe('Ali Raza');
    expect(cleanName('Sana Mir (A/C ****1234)')).toBe('Sana Mir');
    expect(cleanName('BILAL PK36MEZN0001230104567890')).toBe('Bilal');
    expect(cleanName("o'brien & sons")).toBe("O'Brien & Sons");
    expect(cleanName('0300-1234567')).toBeUndefined();
  });

  it('uses the "from" side for received money', () => {
    const r = parseReceipt('You received Rs 500\nFrom: Kashif Ali\nTo: My Account', undefined, { now: NOW });
    expect(r.directionHint).toBe('received');
    expect(r.counterparty).toBe('Kashif Ali');
  });
});

describe('ocr blocks layout', () => {
  it('rebuilds rows from two-column blocks', () => {
    const blocks = [
      {
        text: 'Amount\nTo',
        lines: [
          { text: 'Amount', frame: { x: 10, y: 100, width: 80, height: 20 } },
          { text: 'To', frame: { x: 10, y: 140, width: 30, height: 20 } },
        ],
      },
      {
        text: 'Rs 4,000\nAli Khan',
        lines: [
          { text: 'Rs 4,000', frame: { x: 200, y: 102, width: 90, height: 20 } },
          { text: 'Ali Khan', frame: { x: 200, y: 141, width: 90, height: 20 } },
        ],
      },
    ];
    expect(textFromBlocks(blocks)).toBe('Amount Rs 4,000\nTo Ali Khan');
    const r = parseReceipt('Amount\nTo\nRs 4,000\nAli Khan', blocks, { now: NOW });
    expect(r.amount).toBe(400000);
    expect(r.counterparty).toBe('Ali Khan');
  });

  it('falls back to plain text when blocks have no geometry', () => {
    expect(textFromBlocks([{ text: 'hello' }])).toBeNull();
  });
});

describe('bank profiles', () => {
  it('ignores the beneficiary bank when detecting the sender bank', () => {
    expect(detectBank(['HBL Mobile', 'Beneficiary Bank: Meezan Bank']).bank?.id).toBe('hbl');
  });

  it('are data-driven: a new profile is detected without parser changes', () => {
    const profiles = compileProfiles([
      ...BANK_PROFILES,
      { id: 'bop', name: 'Bank of Punjab', color: '#000', kind: 'bank', keywords: ['bank of punjab', 'bop'] },
    ]);
    expect(detectBank(['BOP Digital', 'Amount Rs 100'], profiles).bank?.id).toBe('bop');
  });

  it('has unique ids', () => {
    const ids = BANK_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
