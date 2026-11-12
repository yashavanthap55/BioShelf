import { CATEGORY_INFO, STOCK_LABEL, STORAGE_INFO, statusLabel } from './entities';
import type { AssetInsight } from './evaluator';

const HEADER = [
  'Name',
  'Category',
  'Batch',
  'Manufacturer',
  'Quantity',
  'Unit',
  'Reorder level',
  'Location',
  'Storage',
  'Manufactured',
  'Expiry / service due',
  'Days remaining',
  'Status',
  'Stock',
];

const escape = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Serialises the inventory to RFC 4180 CSV for spreadsheets or audits. */
export function exportCsv(insights: Iterable<AssetInsight>): string {
  const rows = [HEADER.map(escape).join(',')];
  for (const insight of insights) {
    const a = insight.asset;
    rows.push(
      [
        a.name,
        CATEGORY_INFO[a.category].label,
        a.batchNumber,
        a.manufacturer,
        String(a.quantity),
        a.unit,
        String(a.reorderLevel),
        a.location,
        STORAGE_INFO[a.storage].label,
        a.manufactureDate ?? '',
        a.expiryDate,
        String(insight.daysRemaining),
        statusLabel(insight.status),
        STOCK_LABEL[insight.stockStatus],
      ]
        .map(escape)
        .join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}
