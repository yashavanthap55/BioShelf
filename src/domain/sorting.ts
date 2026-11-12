import { EXPIRY_STATUSES } from './entities';
import type { AssetInsight } from './evaluator';

/** Strategy pattern for ordering the inventory list. */
export abstract class AssetSortStrategy {
  abstract compare(a: AssetInsight, b: AssetInsight): number;

  apply(items: Iterable<AssetInsight>): AssetInsight[] {
    return [...items].sort((a, b) => this.compare(a, b));
  }

  static byName(a: AssetInsight, b: AssetInsight) {
    return a.asset.name.toLowerCase().localeCompare(b.asset.name.toLowerCase());
  }
}

/** First-expiry-first-out: the order stock should actually be used in. */
export class SoonestExpiryFirst extends AssetSortStrategy {
  compare(a: AssetInsight, b: AssetInsight) {
    if (a.asset.expiryDate !== b.asset.expiryDate) {
      return a.asset.expiryDate < b.asset.expiryDate ? -1 : 1;
    }
    return AssetSortStrategy.byName(a, b);
  }
}

export class AlphabeticalOrder extends AssetSortStrategy {
  compare(a: AssetInsight, b: AssetInsight) {
    return AssetSortStrategy.byName(a, b);
  }
}

/** Items closest to (or furthest below) their reorder level first. */
export class LowestStockFirst extends AssetSortStrategy {
  compare(a: AssetInsight, b: AssetInsight) {
    const headroom = (x: AssetInsight) => x.asset.quantity - x.asset.reorderLevel;
    return headroom(a) - headroom(b) || AssetSortStrategy.byName(a, b);
  }
}

export class MostUrgentFirst extends AssetSortStrategy {
  compare(a: AssetInsight, b: AssetInsight) {
    const rank = EXPIRY_STATUSES.indexOf(a.status) - EXPIRY_STATUSES.indexOf(b.status);
    return rank || a.daysRemaining - b.daysRemaining;
  }
}

export class RecentlyUpdatedFirst extends AssetSortStrategy {
  compare(a: AssetInsight, b: AssetInsight) {
    return b.asset.updatedAt - a.asset.updatedAt;
  }
}

export type SortOption = 'soonestExpiry' | 'mostUrgent' | 'lowestStock' | 'alphabetical' | 'recentlyUpdated';

export const SORT_OPTIONS: Record<SortOption, { label: string; description: string; strategy: AssetSortStrategy }> = {
  soonestExpiry: {
    label: 'Soonest expiry',
    description: 'First-expiry, first-out (FEFO)',
    strategy: new SoonestExpiryFirst(),
  },
  mostUrgent: {
    label: 'Most urgent',
    description: 'Expired and critical items on top',
    strategy: new MostUrgentFirst(),
  },
  lowestStock: {
    label: 'Lowest stock',
    description: 'Closest to the reorder level',
    strategy: new LowestStockFirst(),
  },
  alphabetical: {
    label: 'Name (A–Z)',
    description: 'Alphabetical by item name',
    strategy: new AlphabeticalOrder(),
  },
  recentlyUpdated: {
    label: 'Recently updated',
    description: 'Latest edits and stock changes',
    strategy: new RecentlyUpdatedFirst(),
  },
};

export const SORT_OPTION_KEYS = Object.keys(SORT_OPTIONS) as SortOption[];
