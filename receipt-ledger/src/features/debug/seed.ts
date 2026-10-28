import type { Db } from '../../db/driver';
import * as repo from '../../db/repositories';
import type { TxType } from '../../db/types';
import { fromLocalParts, toLocalParts } from '../../utils/timezone';

interface SeedTx {
  account: 'hbl' | 'jazz' | 'easy' | 'naya';
  daysAgo: number;
  hour: number;
  type: TxType;
  rupees: number;
  counterparty: string;
  category?: string;
  reference?: string;
  place?: keyof typeof PLACES;
}

/** Demo spots for the spending map (lat, lng). */
const PLACES = {
  dha: [24.8031, 67.0637],
  clifton: [24.8138, 67.03],
  saddar: [24.8556, 67.029],
  gulshan: [24.918, 67.0971],
  gulberg: [31.512, 74.3456],
  f7: [33.7217, 73.0551],
} as const;

const SAMPLE_TXS: SeedTx[] = [
  {
    account: 'hbl',
    daysAgo: 0,
    hour: 9,
    type: 'received',
    rupees: 185000,
    counterparty: 'Acme Pvt Ltd',
    place: 'saddar',
    category: 'Salary',
  },
  {
    account: 'hbl',
    daysAgo: 1,
    hour: 18,
    type: 'sent',
    rupees: 45000,
    counterparty: 'Landlord Imran',
    place: 'dha',
    category: 'Rent',
  },
  {
    account: 'jazz',
    daysAgo: 1,
    hour: 13,
    type: 'sent',
    rupees: 850,
    counterparty: 'Cafe Aylanto',
    place: 'clifton',
    category: 'Food',
  },
  {
    account: 'easy',
    daysAgo: 2,
    hour: 20,
    type: 'sent',
    rupees: 3610,
    counterparty: 'StormFiber',
    place: 'gulshan',
    category: 'Bills',
  },
  {
    account: 'naya',
    daysAgo: 3,
    hour: 11,
    type: 'sent',
    rupees: 1500,
    counterparty: 'Careem',
    place: 'clifton',
    category: 'Transport',
  },
  {
    account: 'jazz',
    daysAgo: 4,
    hour: 15,
    type: 'received',
    rupees: 5000,
    counterparty: 'Sara Ahmed',
    place: 'gulshan',
    category: 'Family',
  },
  {
    account: 'hbl',
    daysAgo: 6,
    hour: 10,
    type: 'sent',
    rupees: 4321.5,
    counterparty: 'K-Electric',
    place: 'dha',
    category: 'Bills',
  },
  {
    account: 'easy',
    daysAgo: 8,
    hour: 19,
    type: 'sent',
    rupees: 2200,
    counterparty: 'Imtiaz Store',
    place: 'gulshan',
    category: 'Shopping',
  },
  {
    account: 'naya',
    daysAgo: 10,
    hour: 21,
    type: 'sent',
    rupees: 150,
    counterparty: 'Akhter Naeem',
    place: 'dha',
    category: 'Food',
  },
  {
    account: 'hbl',
    daysAgo: 12,
    hour: 12,
    type: 'sent',
    rupees: 10000,
    counterparty: 'Ammi',
    place: 'gulberg',
    category: 'Family',
  },
  {
    account: 'jazz',
    daysAgo: 15,
    hour: 17,
    type: 'sent',
    rupees: 1200,
    counterparty: 'Cafe Aylanto',
    place: 'clifton',
    category: 'Food',
  },
  {
    account: 'hbl',
    daysAgo: 33,
    hour: 9,
    type: 'received',
    rupees: 185000,
    counterparty: 'Acme Pvt Ltd',
    place: 'saddar',
    category: 'Salary',
  },
  {
    account: 'hbl',
    daysAgo: 34,
    hour: 18,
    type: 'sent',
    rupees: 45000,
    counterparty: 'Landlord Imran',
    place: 'dha',
    category: 'Rent',
  },
  {
    account: 'easy',
    daysAgo: 36,
    hour: 14,
    type: 'sent',
    rupees: 3610,
    counterparty: 'StormFiber',
    place: 'gulshan',
    category: 'Bills',
  },
  {
    account: 'naya',
    daysAgo: 40,
    hour: 22,
    type: 'sent',
    rupees: 2750,
    counterparty: 'Daraz',
    place: 'f7',
    category: 'Shopping',
  },
];

/** Loads demo banks, accounts and two months of transactions. Returns the number of transactions created. */
export async function seedSampleData(db: Db, now = Date.now()): Promise<number> {
  const banks = {
    hbl: await repo.createBank(db, { name: 'HBL', color: '#00856F', icon: 'hbl' }),
    jazz: await repo.createBank(db, { name: 'JazzCash', color: '#C8102E', icon: 'jazzcash' }),
    easy: await repo.createBank(db, { name: 'Easypaisa', color: '#1EB25A', icon: 'easypaisa' }),
    naya: await repo.createBank(db, { name: 'NayaPay', color: '#F15A24', icon: 'nayapay' }),
  };
  const accounts = {
    hbl: await repo.createAccount(db, {
      bank_id: banks.hbl,
      label: 'Current',
      last4: '4521',
      currency: 'PKR',
      opening_balance_minor: 250_000_00,
    }),
    jazz: await repo.createAccount(db, {
      bank_id: banks.jazz,
      label: 'Wallet',
      last4: '5678',
      currency: 'PKR',
      opening_balance_minor: 12_000_00,
    }),
    easy: await repo.createAccount(db, {
      bank_id: banks.easy,
      label: 'Wallet',
      last4: '4567',
      currency: 'PKR',
      opening_balance_minor: 20_000_00,
    }),
    naya: await repo.createAccount(db, {
      bank_id: banks.naya,
      label: 'Wallet',
      last4: null,
      currency: 'PKR',
      opening_balance_minor: 40_000_00,
    }),
  };
  await repo.createAccount(db, {
    bank_id: banks.hbl,
    label: 'Savings',
    last4: '9981',
    currency: 'PKR',
    opening_balance_minor: 500_000_00,
  });

  const categories = await repo.listCategories(db);
  for (const [i, s] of SAMPLE_TXS.entries()) {
    const p = toLocalParts(now - s.daysAgo * 86_400_000);
    await repo.createTransaction(db, {
      account_id: accounts[s.account],
      type: s.type,
      amount_minor: Math.round(s.rupees * 100),
      occurred_at: fromLocalParts(p.year, p.month, p.day, s.hour, 15).getTime(),
      counterparty: s.counterparty,
      reference: s.reference ?? null,
      category_id: categories.find((c) => c.name === s.category)?.id ?? null,
      note: null,
      receipt_path: null,
      source: 'manual',
      // Small deterministic offsets so repeated visits form a hotspot rather than one dot.
      latitude: s.place ? PLACES[s.place][0] + ((i % 5) - 2) * 0.0012 : null,
      longitude: s.place ? PLACES[s.place][1] + ((i % 3) - 1) * 0.0015 : null,
      location_accuracy: s.place ? 20 : null,
    });
  }
  return SAMPLE_TXS.length;
}
