import type { TxFilter } from '../../db/repositories';
import type { TxType } from '../../db/types';
import { startOfLocalDay, startOfLocalMonth, toLocalParts } from '../../utils/timezone';

export type RangePreset = 'all' | 'thisMonth' | 'lastMonth' | 'last30' | 'custom';

export interface ActivityFilters {
  search: string;
  range: RangePreset;
  customFrom: number | null;
  customTo: number | null;
  type: TxType | null;
  bankIds: number[];
  accountIds: number[];
  categoryIds: number[];
}

export const EMPTY_FILTERS: ActivityFilters = {
  search: '',
  range: 'all',
  customFrom: null,
  customTo: null,
  type: null,
  bankIds: [],
  accountIds: [],
  categoryIds: [],
};

export function rangeBounds(f: ActivityFilters, now = Date.now()): { from?: number; to?: number } {
  const p = toLocalParts(now);
  switch (f.range) {
    case 'thisMonth':
      return {
        from: startOfLocalMonth(p.year, p.month).getTime(),
        to: startOfLocalMonth(p.year, p.month + 1).getTime(),
      };
    case 'lastMonth':
      return {
        from: startOfLocalMonth(p.year, p.month - 1).getTime(),
        to: startOfLocalMonth(p.year, p.month).getTime(),
      };
    case 'last30':
      return { from: startOfLocalDay(now - 29 * 86_400_000).getTime() };
    case 'custom':
      return {
        from: f.customFrom != null ? startOfLocalDay(f.customFrom).getTime() : undefined,
        to: f.customTo != null ? startOfLocalDay(f.customTo).getTime() + 86_400_000 : undefined,
      };
    default:
      return {};
  }
}

export function toTxFilter(f: ActivityFilters, now = Date.now()): TxFilter {
  return {
    search: f.search,
    type: f.type ?? undefined,
    bankIds: f.bankIds,
    accountIds: f.accountIds,
    categoryIds: f.categoryIds,
    ...rangeBounds(f, now),
  };
}

export function activeFilterCount(f: ActivityFilters): number {
  return (
    (f.range !== 'all' ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.bankIds.length ? 1 : 0) +
    (f.accountIds.length ? 1 : 0) +
    (f.categoryIds.length ? 1 : 0)
  );
}

export function toggle(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
