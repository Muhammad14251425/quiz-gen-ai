export type TxType = 'sent' | 'received';
export type TxSource = 'share' | 'gallery' | 'manual';

export interface Bank {
  id: number;
  name: string;
  color: string;
  /** Bank profile id from the parser presets (e.g. "jazzcash") or null for custom banks. */
  icon: string | null;
  archived: number;
  created_at: number;
}

export interface Account {
  id: number;
  bank_id: number;
  label: string;
  last4: string | null;
  currency: string;
  opening_balance_minor: number;
  archived: number;
  created_at: number;
}

export interface AccountWithBalance extends Account {
  balance_minor: number;
  bank_name: string;
  bank_color: string;
  bank_icon: string | null;
  bank_archived: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  type: TxType;
  amount_minor: number;
  occurred_at: number;
  counterparty: string | null;
  reference: string | null;
  category_id: number | null;
  note: string | null;
  /** Relative to the app's document directory, e.g. "receipts/abc.jpg". */
  receipt_path: string | null;
  source: TxSource;
  created_at: number;
  updated_at: number;
}

export interface TransactionView extends Transaction {
  account_label: string;
  account_currency: string;
  bank_id: number;
  bank_name: string;
  bank_color: string;
  category_name: string | null;
  category_color: string | null;
}

export interface Counterparty {
  id: number;
  name: string;
  key: string;
  last_category_id: number | null;
  last_type: TxType | null;
  use_count: number;
}

export type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'updated_at'>;
