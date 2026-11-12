import { daysBetween, toISODate, type ISODate } from './dates';
import type { ExpiryStatus, MedicalAsset, StockStatus } from './entities';
import type { ExpiryPolicy, ExpiryPolicyFactory } from './policies';

/**
 * An asset plus everything derived from it for a given day. Computed once per
 * refresh, so screens never re-run policy logic while rendering.
 */
export interface AssetInsight {
  readonly asset: MedicalAsset;
  /** Negative when the date has passed. */
  readonly daysRemaining: number;
  readonly status: ExpiryStatus;
  readonly policy: ExpiryPolicy;
  /** Fraction (0..1) of the shelf life or service interval already elapsed. */
  readonly shelfLifeUsed: number;
  readonly stockStatus: StockStatus;
  readonly isLowStock: boolean;
  readonly needsAttention: boolean;
}

export function stockStatusOf(asset: MedicalAsset): StockStatus {
  if (asset.quantity <= 0) return 'outOfStock';
  if (asset.quantity <= asset.reorderLevel) return 'low';
  return 'healthy';
}

export class AssetEvaluator {
  constructor(
    private readonly policyFactory: ExpiryPolicyFactory,
    private readonly today: ISODate,
  ) {}

  evaluate(asset: MedicalAsset): AssetInsight {
    const policy = this.policyFactory.forCategory(asset.category);
    const daysRemaining = daysBetween(this.today, asset.expiryDate);
    const start = asset.manufactureDate ?? toISODate(new Date(asset.createdAt));
    const total = daysBetween(start, asset.expiryDate);
    const elapsed = daysBetween(start, this.today);
    const shelfLifeUsed = total <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / total));
    const status = policy.evaluate(daysRemaining);
    const stockStatus = stockStatusOf(asset);
    const isLowStock = stockStatus !== 'healthy';
    return {
      asset,
      daysRemaining,
      status,
      policy,
      shelfLifeUsed,
      stockStatus,
      isLowStock,
      needsAttention: status === 'expired' || status === 'critical' || isLowStock,
    };
  }
}
