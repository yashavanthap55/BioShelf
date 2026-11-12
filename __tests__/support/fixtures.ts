import { addDays, toISODate } from '../../src/domain/dates';
import type { AssetCategory, MedicalAsset, StorageCondition } from '../../src/domain/entities';

/** Fixed "now" so every date-based assertion is deterministic. */
export const NOW = new Date(2026, 9, 30, 9, 30);
export const TODAY = toISODate(NOW);

export function asset(
  id: string,
  opts: {
    name?: string;
    category?: AssetCategory;
    expiresInDays?: number;
    madeDaysAgo?: number | null;
    quantity?: number;
    reorderLevel?: number;
    batch?: string;
    location?: string;
    storage?: StorageCondition;
    updatedAt?: number;
  } = {},
): MedicalAsset {
  const made = opts.madeDaysAgo === undefined ? 200 : opts.madeDaysAgo;
  const stamp = opts.updatedAt ?? NOW.getTime();
  return {
    id,
    name: opts.name ?? `Asset ${id}`,
    category: opts.category ?? 'medicine',
    batchNumber: opts.batch ?? 'B-001',
    manufacturer: 'Acme Pharma',
    quantity: opts.quantity ?? 50,
    unit: 'units',
    reorderLevel: opts.reorderLevel ?? 10,
    location: opts.location ?? 'Pharmacy',
    storage: opts.storage ?? 'roomTemperature',
    manufactureDate: made === null ? null : addDays(TODAY, -made),
    expiryDate: addDays(TODAY, opts.expiresInDays ?? 200),
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
    imageRef: null,
  };
}
