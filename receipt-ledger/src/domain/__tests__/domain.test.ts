import { preselectAccount } from '../accountPick';
import { formatMinor, formatMoney, minorToInput, parseMoneyInput } from '../money';

describe('money', () => {
  it('parses user input into integer paisa without floats', () => {
    expect(parseMoneyInput('1,250')).toBe(125000);
    expect(parseMoneyInput('1250.5')).toBe(125050);
    expect(parseMoneyInput('Rs. 0.07')).toBe(7);
    expect(parseMoneyInput('0.1')).toBe(10);
    expect(parseMoneyInput('19.99')).toBe(1999);
    expect(parseMoneyInput('-5')).toBeNull();
    expect(parseMoneyInput('1.234')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
  });

  it('formats minor units', () => {
    expect(formatMinor(125000)).toBe('1,250');
    expect(formatMinor(125050)).toBe('1,250.50');
    expect(formatMinor(1234567890)).toBe('12,345,678.90');
    expect(formatMoney(-50000)).toBe('−Rs 500');
    expect(formatMoney(50000, 'PKR', { sign: true })).toBe('+Rs 500');
    expect(minorToInput(125050)).toBe('1250.50');
    expect(minorToInput(125000)).toBe('1250');
  });
});

describe('account preselection', () => {
  const accounts = [
    { id: 1, bank_icon: 'hbl', bank_name: 'HBL' },
    { id: 2, bank_icon: 'jazzcash', bank_name: 'JazzCash' },
    { id: 3, bank_icon: null, bank_name: 'NayaPay' },
  ];
  const empty = { lastAccountByBank: {}, lastAccountId: null };

  it('prefers the last account used for the detected bank', () => {
    expect(preselectAccount(accounts, 'hbl', { lastAccountByBank: { hbl: 1 }, lastAccountId: 2 })).toBe(1);
  });
  it('matches the detected bank by preset id or name', () => {
    expect(preselectAccount(accounts, 'jazzcash', empty)).toBe(2);
    expect(preselectAccount(accounts, 'nayapay', empty)).toBe(3);
  });
  it('falls back to the last used account, then the only account', () => {
    expect(preselectAccount(accounts, 'meezan', { lastAccountByBank: {}, lastAccountId: 2 })).toBe(2);
    expect(preselectAccount(accounts, undefined, empty)).toBeNull();
    expect(preselectAccount([accounts[0]], undefined, empty)).toBe(1);
    expect(preselectAccount(accounts, 'hbl', { lastAccountByBank: { hbl: 99 }, lastAccountId: null })).toBe(1);
  });
});
