import type { Direction } from '../types';

export interface FixtureCase {
  file: string;
  /** Rupee amount as a string to avoid float literals; converted to paisa in tests. */
  amount?: string;
  /** Asia/Karachi wall time "YYYY-MM-DD HH:mm". */
  date?: string;
  counterparty?: string;
  reference?: string;
  bank?: string;
  direction?: Direction;
  /** Receipt has no date; the parser must fall back to the file date. */
  noDate?: boolean;
}

export const CASES: FixtureCase[] = [
  {
    file: '01_jazzcash_sent.txt',
    amount: '1250.00',
    date: '2026-10-28 17:41',
    counterparty: 'Muhammad Ali Khan',
    reference: '012345678901',
    bank: 'jazzcash',
    direction: 'sent',
  },
  {
    file: '02_easypaisa_sent.txt',
    amount: '2500',
    date: '2026-10-27 11:05',
    counterparty: 'Ayesha Siddiqui',
    reference: '31234567890',
    bank: 'easypaisa',
    direction: 'sent',
  },
  {
    file: '03_hbl_funds_transfer.txt',
    amount: '25000.00',
    date: '2026-10-28 14:22',
    counterparty: 'Sara Ahmed',
    reference: 'FT26301ABC12',
    bank: 'hbl',
    direction: 'sent',
  },
  {
    file: '04_meezan_received.txt',
    amount: '15000.00',
    date: '2026-10-15 09:30',
    counterparty: 'Zubair Hassan',
    reference: '554433221100',
    bank: 'meezan',
    direction: 'received',
  },
  {
    file: '05_ubl_raast.txt',
    amount: '3750',
    date: '2026-10-28 08:15',
    counterparty: 'Hamza Tariq',
    reference: 'RST2610284455',
    bank: 'ubl',
    direction: 'sent',
  },
  {
    file: '06_allied_noisy.txt',
    amount: '10500.00',
    date: '2026-10-03 19:45',
    counterparty: 'Kamran Akmal',
    reference: 'ABL9981234',
    bank: 'allied',
    direction: 'sent',
  },
  {
    file: '07_mcb_bill_payment.txt',
    amount: '4321.50',
    date: '2026-10-05 10:12',
    counterparty: 'K-Electric',
    reference: 'MCB20261005XYZ',
    bank: 'mcb',
    direction: 'sent',
  },
  {
    file: '08_alfalah_sentence.txt',
    amount: '7000.00',
    date: '2026-10-20 15:05',
    counterparty: 'Fatima Noor',
    reference: '629301778899',
    bank: 'alfalah',
    direction: 'sent',
  },
  {
    file: '09_sadapay_received.txt',
    amount: '1200',
    date: '2026-10-26 21:18',
    counterparty: 'Usman Ghani',
    reference: 'SP-8f3a2c19',
    bank: 'sadapay',
    direction: 'received',
  },
  {
    file: '10_nayapay_sent.txt',
    amount: '850',
    date: '2026-10-21 13:47',
    counterparty: 'Hira Baig',
    reference: 'NP2610211347A',
    bank: 'nayapay',
    direction: 'sent',
  },
  {
    file: '11_faysal_credit_alert.txt',
    amount: '50000.00',
    date: '2026-10-01 10:00',
    counterparty: 'Abc Traders Pvt Ltd',
    reference: 'FBL0110265566',
    bank: 'faysal',
    direction: 'received',
  },
  {
    file: '12_askari_ibft.txt',
    amount: '12345.67',
    date: '2026-10-12 18:20',
    counterparty: 'Naveed Iqbal',
    reference: 'AKB12102026182000',
    bank: 'askari',
    direction: 'sent',
  },
  {
    file: '13_konnect_sent.txt',
    amount: '1500',
    date: '2026-10-28 12:30',
    counterparty: 'Shahid Afridi',
    reference: 'KN99887766',
    bank: 'konnect',
    direction: 'sent',
  },
  {
    file: '14_jazzcash_received_noisy.txt',
    amount: '500.00',
    date: '2026-10-27 20:05',
    counterparty: 'Nadia Perveen',
    reference: '098765432109',
    bank: 'jazzcash',
    direction: 'received',
  },
  {
    file: '15_easypaisa_sms_style.txt',
    amount: '3000.00',
    date: '2026-10-22 16:10',
    counterparty: 'Imran Shah',
    reference: '41239876543',
    bank: 'easypaisa',
    direction: 'received',
  },
  {
    file: '16_raast_generic.txt',
    amount: '999',
    date: '2026-10-18 22:05',
    counterparty: 'Ghulam Mustafa',
    reference: '7G8H9J0K1L',
    bank: 'raast',
    direction: 'sent',
  },
  // ---------------------------------------------------------------------------
  // Real receipts (assets/samples/real_*.jpg). The .txt files are genuine OCR
  // output (Tesseract, used offline as a stand-in for ML Kit in CI), noise
  // included. Expected values were read off the images by hand.
  // ---------------------------------------------------------------------------
  // Easypaisa "Successfully Sent to" screens: no date and only a logo for the bank.
  {
    file: 'real_01_easypaisa_talha.txt',
    amount: '350.00',
    counterparty: 'Muhammad Talha Sharif',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  {
    file: 'real_02_easypaisa_mushtaq.txt',
    amount: '200.00',
    counterparty: 'Mushtaq Ahmed',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  {
    file: 'real_03_easypaisa_aliza.txt',
    amount: '200.00',
    counterparty: 'Aliza Hasan',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  {
    file: 'real_04_easypaisa_tabsheer_raast.txt',
    amount: '1483.00',
    counterparty: 'Muhammad Tabsheer',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  {
    file: 'real_05_easypaisa_arooba.txt',
    amount: '1700.00',
    counterparty: 'Arooba',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  {
    file: 'real_06_easypaisa_tabsheer_jazzcash.txt',
    amount: '500.00',
    counterparty: 'Muhammad Tabsheer',
    bank: 'easypaisa',
    direction: 'sent',
    noDate: true,
  },
  // myABL two-column layout: OCR scrambles the columns and misreads the logo, so no bank.
  {
    file: 'real_07_myabl_ft.txt',
    amount: '107360.00',
    date: '2026-09-18 15:24',
    counterparty: 'Khi School For Business',
    reference: '374102',
    direction: 'sent',
  },
  {
    file: 'real_08_nayapay_stormfiber.txt',
    amount: '3610',
    date: '2026-10-25 14:47',
    counterparty: 'Stormfiber',
    // OCR read "1397c84" as "1397¢c84"; the parser returns what OCR saw.
    reference: '6addd02814c40278f1397cc84',
    bank: 'nayapay',
    direction: 'sent',
  },
  {
    file: 'real_09_nayapay_raast_meezan.txt',
    amount: '34000',
    date: '2026-10-15 18:49',
    counterparty: 'Muhammad Ammar Khan',
    reference: '6ad0d9cf2f0f1f120289b304',
    bank: 'nayapay',
    direction: 'sent',
  },
  {
    file: 'real_10_nayapay_retail.txt',
    amount: '150',
    date: '2026-10-12 21:01',
    counterparty: 'Akhter Naeem',
    reference: '6acd0474a7724a6dd8f8796d',
    bank: 'nayapay',
    direction: 'sent',
  },
  {
    file: 'real_11_nayapay_muneeb.txt',
    amount: '500',
    date: '2026-10-04 12:26',
    counterparty: 'Muneeb Ahmer Akhund',
    // OCR misread of 6ac1ffb4bd21d35ea5898a70; the parser returns what OCR saw.
    reference: '6acl1ffbabd21d35ea5898a70',
    bank: 'nayapay',
    direction: 'sent',
  },
  {
    file: 'real_12_nayapay_daniyal.txt',
    amount: '105',
    date: '2026-09-23 22:27',
    counterparty: 'Muhammad Daniyal',
    reference: '6ab40bf46688ff49b4a39fb0',
    bank: 'nayapay',
    direction: 'sent',
  },
];
