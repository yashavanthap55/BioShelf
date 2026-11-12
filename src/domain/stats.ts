import { isColdChain, type AssetCategory, type ExpiryStatus } from './entities';
import { parseISODate, type ISODate } from './dates';
import type { AssetInsight } from './evaluator';

export interface MonthlyExpiryBucket {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  readonly count: number;
}

/** Aggregate numbers shown on the dashboard and alerts screen. */
export interface InventoryStats {
  readonly total: number;
  readonly expired: number;
  readonly critical: number;
  readonly warning: number;
  readonly safe: number;
  /** Includes out-of-stock items. */
  readonly lowStock: number;
  readonly outOfStock: number;
  readonly coldChain: number;
  /** Distinct assets that are expired, critical or low on stock. */
  readonly attention: number;
  readonly byCategory: Partial<Record<AssetCategory, number>>;
  /** Upcoming expiries for the current month and the five after it. */
  readonly outlook: readonly MonthlyExpiryBucket[];
  /** 0..1 score weighted by how close each asset is to expiry. */
  readonly healthScore: number;
}

export const EMPTY_STATS: InventoryStats = {
  total: 0,
  expired: 0,
  critical: 0,
  warning: 0,
  safe: 0,
  lowStock: 0,
  outOfStock: 0,
  coldChain: 0,
  attention: 0,
  byCategory: {},
  outlook: [],
  healthScore: 1,
};

export const countForStatus = (stats: InventoryStats, status: ExpiryStatus) => stats[status];

export function computeStats(insights: readonly AssetInsight[], today: ISODate): InventoryStats {
  const counts = { expired: 0, critical: 0, warning: 0, safe: 0 };
  let lowStock = 0;
  let outOfStock = 0;
  let coldChain = 0;
  let attention = 0;
  const byCategory: Partial<Record<AssetCategory, number>> = {};

  for (const insight of insights) {
    counts[insight.status]++;
    if (insight.isLowStock) lowStock++;
    if (insight.stockStatus === 'outOfStock') outOfStock++;
    if (isColdChain(insight.asset.storage)) coldChain++;
    if (insight.needsAttention) attention++;
    byCategory[insight.asset.category] = (byCategory[insight.asset.category] ?? 0) + 1;
  }

  const { year, month } = parseISODate(today);
  const outlook = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 + i, 1));
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const count = insights.filter((x) => {
      if (x.daysRemaining < 0) return false;
      const exp = parseISODate(x.asset.expiryDate);
      return exp.year === y && exp.month === m;
    }).length;
    return { year: y, month: m, count };
  });

  const total = insights.length;
  const healthScore =
    total === 0 ? 1 : (counts.safe + counts.warning * 0.6 + counts.critical * 0.25) / total;

  return {
    total,
    ...counts,
    lowStock,
    outOfStock,
    coldChain,
    attention,
    byCategory,
    outlook,
    healthScore,
  };
}
