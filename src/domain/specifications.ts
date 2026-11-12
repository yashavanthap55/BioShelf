import { CATEGORY_INFO, isColdChain, type AssetCategory, type ExpiryStatus } from './entities';
import type { AssetInsight } from './evaluator';

/**
 * Specification pattern: small, composable business rules. Inventory filters
 * are built by chaining specifications instead of a growing `if` ladder.
 */
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

/** Matches everything; the identity element for `and`. */
export class AnySpecification<T> extends Specification<T> {
  isSatisfiedBy(): boolean {
    return true;
  }

  override and(other: Specification<T>): Specification<T> {
    return other;
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T) {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super();
  }

  isSatisfiedBy(candidate: T) {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private readonly inner: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T) {
    return !this.inner.isSatisfiedBy(candidate);
  }
}

export class CategorySpecification extends Specification<AssetInsight> {
  constructor(readonly category: AssetCategory) {
    super();
  }

  isSatisfiedBy(candidate: AssetInsight) {
    return candidate.asset.category === this.category;
  }
}

export class ExpiryStatusSpecification extends Specification<AssetInsight> {
  constructor(readonly statuses: ReadonlySet<ExpiryStatus>) {
    super();
  }

  isSatisfiedBy(candidate: AssetInsight) {
    return this.statuses.has(candidate.status);
  }
}

export class LowStockSpecification extends Specification<AssetInsight> {
  isSatisfiedBy(candidate: AssetInsight) {
    return candidate.isLowStock;
  }
}

export class ColdChainSpecification extends Specification<AssetInsight> {
  isSatisfiedBy(candidate: AssetInsight) {
    return isColdChain(candidate.asset.storage);
  }
}

/** Case-insensitive match across the fields staff actually search by. */
export class TextSearchSpecification extends Specification<AssetInsight> {
  private readonly needle: string;

  constructor(query: string) {
    super();
    this.needle = query.trim().toLowerCase();
  }

  isSatisfiedBy({ asset }: AssetInsight) {
    if (!this.needle) return true;
    return [asset.name, asset.batchNumber, asset.manufacturer, asset.location, CATEGORY_INFO[asset.category].label]
      .some((field) => field.toLowerCase().includes(this.needle));
  }
}

/** Quick filters exposed as chips on the inventory screen. */
export type StatusFilter =
  | 'all'
  | 'expired'
  | 'critical'
  | 'expiringSoon'
  | 'safe'
  | 'lowStock'
  | 'coldChain';

export const STATUS_FILTERS: readonly StatusFilter[] = [
  'all',
  'expired',
  'critical',
  'expiringSoon',
  'safe',
  'lowStock',
  'coldChain',
];

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  expired: 'Expired',
  critical: 'Critical',
  expiringSoon: 'Expiring soon',
  safe: 'Safe',
  lowStock: 'Low stock',
  coldChain: 'Cold chain',
};

export function statusFilterSpecification(filter: StatusFilter): Specification<AssetInsight> {
  switch (filter) {
    case 'all':
      return new AnySpecification();
    case 'expired':
      return new ExpiryStatusSpecification(new Set(['expired']));
    case 'critical':
      return new ExpiryStatusSpecification(new Set(['critical']));
    case 'expiringSoon':
      return new ExpiryStatusSpecification(new Set(['warning']));
    case 'safe':
      return new ExpiryStatusSpecification(new Set(['safe']));
    case 'lowStock':
      return new LowStockSpecification();
    case 'coldChain':
      return new ColdChainSpecification();
  }
}

/** Immutable filter state that builds a composite specification. */
export class AssetFilter {
  constructor(
    readonly query: string = '',
    readonly category: AssetCategory | null = null,
    readonly status: StatusFilter = 'all',
  ) {}

  get isActive() {
    return this.query.trim() !== '' || this.category !== null || this.status !== 'all';
  }

  withQuery(query: string) {
    return new AssetFilter(query, this.category, this.status);
  }

  withCategory(category: AssetCategory | null) {
    return new AssetFilter(this.query, category, this.status);
  }

  withStatus(status: StatusFilter) {
    return new AssetFilter(this.query, this.category, status);
  }

  toSpecification(): Specification<AssetInsight> {
    let spec: Specification<AssetInsight> = new AnySpecification();
    if (this.query.trim()) spec = spec.and(new TextSearchSpecification(this.query));
    if (this.category) spec = spec.and(new CategorySpecification(this.category));
    if (this.status !== 'all') spec = spec.and(statusFilterSpecification(this.status));
    return spec;
  }
}
