import type { BankProfile } from './types';

/**
 * Data-driven bank / wallet profiles. To support a new bank, add an entry here;
 * no parser logic needs to change. Keywords are matched case-insensitively on
 * word boundaries. Mentions on "Beneficiary bank"-style lines are ignored so the
 * destination bank does not override the sender's app.
 */
export const BANK_PROFILES: BankProfile[] = [
  {
    id: 'jazzcash',
    name: 'JazzCash',
    color: '#C8102E',
    kind: 'wallet',
    keywords: ['jazzcash', 'jazz cash', 'mobilink'],
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    color: '#1EB25A',
    kind: 'wallet',
    keywords: ['easypaisa', 'easy paisa', 'telenor microfinance'],
    layoutHints: ['successfully sent to'],
  },
  {
    id: 'hbl',
    name: 'HBL',
    color: '#00856F',
    kind: 'bank',
    keywords: ['hbl', 'habib bank'],
  },
  {
    id: 'meezan',
    name: 'Meezan Bank',
    color: '#6E1E5A',
    kind: 'bank',
    keywords: ['meezan'],
  },
  {
    id: 'ubl',
    name: 'UBL',
    color: '#0057A8',
    kind: 'bank',
    keywords: ['ubl', 'united bank'],
  },
  {
    id: 'allied',
    name: 'Allied Bank',
    color: '#1C3F94',
    kind: 'bank',
    keywords: ['allied bank', 'abl', 'myabl'],
  },
  {
    id: 'mcb',
    name: 'MCB',
    color: '#00704A',
    kind: 'bank',
    keywords: ['mcb', 'muslim commercial'],
  },
  {
    id: 'alfalah',
    name: 'Bank Alfalah',
    color: '#E2231A',
    kind: 'bank',
    keywords: ['bank alfalah', 'alfalah', 'alfa'],
  },
  {
    id: 'faysal',
    name: 'Faysal Bank',
    color: '#00A0AF',
    kind: 'bank',
    keywords: ['faysal', 'digibank'],
  },
  {
    id: 'askari',
    name: 'Askari Bank',
    color: '#00529B',
    kind: 'bank',
    keywords: ['askari'],
  },
  {
    id: 'sadapay',
    name: 'SadaPay',
    color: '#00C7B1',
    kind: 'wallet',
    keywords: ['sadapay', 'sada pay'],
  },
  {
    id: 'nayapay',
    name: 'NayaPay',
    color: '#F15A24',
    kind: 'wallet',
    keywords: ['nayapay', 'naya pay'],
  },
  {
    id: 'konnect',
    name: 'Konnect by HBL',
    color: '#2BB673',
    kind: 'wallet',
    keywords: ['konnect'],
    priority: 1.5,
  },
  {
    id: 'raast',
    name: 'Raast',
    color: '#2E3192',
    kind: 'rail',
    keywords: ['raast'],
    priority: 0.5,
    referenceLabels: ['raast reference'],
  },
];

export function getBankProfile(id: string | null | undefined): BankProfile | undefined {
  if (!id) return undefined;
  return BANK_PROFILES.find((p) => p.id === id);
}
