import { getBankProfile } from '../parser';

export interface PickableAccount {
  id: number;
  bank_icon: string | null;
  bank_name: string;
}

/**
 * Chooses the account to preselect for an imported receipt:
 *  1. the last account used for this detected bank,
 *  2. otherwise the first account of a bank matching the detected profile,
 *  3. otherwise the last account used at all,
 *  4. otherwise the only account, if there is exactly one.
 */
export function preselectAccount(
  accounts: PickableAccount[],
  bankHint: string | undefined,
  memory: { lastAccountByBank: Record<string, number>; lastAccountId: number | null },
): number | null {
  const exists = (id: number | null | undefined): id is number => id != null && accounts.some((a) => a.id === id);
  if (bankHint) {
    const remembered = memory.lastAccountByBank[bankHint];
    if (exists(remembered)) return remembered;
    const profileName = getBankProfile(bankHint)?.name.toLowerCase();
    const match = accounts.find(
      (a) => a.bank_icon === bankHint || (profileName && a.bank_name.toLowerCase() === profileName),
    );
    if (match) return match.id;
  }
  if (exists(memory.lastAccountId)) return memory.lastAccountId;
  return accounts.length === 1 ? accounts[0].id : null;
}
