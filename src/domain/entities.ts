// Core domain types. Pure TypeScript: no React, React Native or Expo imports,
// so this layer is portable and unit-testable on its own.

import type { ISODate } from './dates';

export type AssetCategory =
  | 'medicine'
  | 'vaccine'
  | 'bloodProduct'
  | 'reagent'
  | 'consumable'
  | 'ppe'
  | 'equipment';

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  'medicine',
  'vaccine',
  'bloodProduct',
  'reagent',
  'consumable',
  'ppe',
  'equipment',
];

export const CATEGORY_INFO: Record<AssetCategory, { label: string; description: string }> = {
  medicine: { label: 'Medicines', description: 'Tablets, capsules, syrups and injectables' },
  vaccine: { label: 'Vaccines', description: 'Cold-chain immunisation stock' },
  bloodProduct: { label: 'Blood Products', description: 'Whole blood, PRBC, plasma and platelets' },
  reagent: { label: 'Lab Reagents', description: 'Diagnostic kits and reagents' },
  consumable: { label: 'Consumables', description: 'Syringes, cannulas, dressings' },
  ppe: { label: 'PPE', description: 'Gloves, masks, gowns and shields' },
  equipment: { label: 'Equipment', description: 'Devices due for calibration or service' },
};

/** Equipment tracks a calibration/service due date instead of an expiry. */
export const tracksServiceDate = (category: AssetCategory) => category === 'equipment';

export const dateLabelFor = (category: AssetCategory) =>
  tracksServiceDate(category) ? 'Service due' : 'Expiry date';

export type StorageCondition = 'roomTemperature' | 'cool' | 'refrigerated' | 'frozen' | 'controlled';

export const STORAGE_CONDITIONS: readonly StorageCondition[] = [
  'roomTemperature',
  'cool',
  'refrigerated',
  'frozen',
  'controlled',
];

export const STORAGE_INFO: Record<StorageCondition, { label: string; range: string }> = {
  roomTemperature: { label: 'Room temperature', range: '15–25 °C' },
  cool: { label: 'Cool', range: '8–15 °C' },
  refrigerated: { label: 'Refrigerated', range: '2–8 °C' },
  frozen: { label: 'Frozen', range: '−25 to −15 °C' },
  controlled: { label: 'Controlled cabinet', range: 'Locked, logged access' },
};

export const isColdChain = (storage: StorageCondition) =>
  storage === 'refrigerated' || storage === 'frozen';

/** Ordered from most to least urgent. */
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'safe';
export const EXPIRY_STATUSES: readonly ExpiryStatus[] = ['expired', 'critical', 'warning', 'safe'];

const STATUS_LABEL: Record<ExpiryStatus, string> = {
  expired: 'Expired',
  critical: 'Critical',
  warning: 'Expiring soon',
  safe: 'Safe',
};

const SERVICE_STATUS_LABEL: Record<ExpiryStatus, string> = {
  expired: 'Overdue',
  critical: 'Due now',
  warning: 'Due soon',
  safe: 'In service',
};

/** Equipment uses service vocabulary rather than expiry vocabulary. */
export const statusLabel = (status: ExpiryStatus, category?: AssetCategory) =>
  category && tracksServiceDate(category) ? SERVICE_STATUS_LABEL[status] : STATUS_LABEL[status];

export type StockStatus = 'outOfStock' | 'low' | 'healthy';

export const STOCK_LABEL: Record<StockStatus, string> = {
  outOfStock: 'Out of stock',
  low: 'Low stock',
  healthy: 'In stock',
};

/** One batch/lot of a healthcare asset on the shelf. */
export interface MedicalAsset {
  readonly id: string;
  readonly name: string;
  readonly category: AssetCategory;
  readonly batchNumber: string;
  readonly manufacturer: string;
  readonly quantity: number;
  readonly unit: string;
  readonly reorderLevel: number;
  readonly location: string;
  readonly storage: StorageCondition;
  readonly manufactureDate: ISODate | null;
  /** Expiry date, or the calibration/service due date for equipment. */
  readonly expiryDate: ISODate;
  readonly notes: string;
  /** Epoch milliseconds. */
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Key of the label photo in the AssetImageStore, if one was attached. */
  readonly imageRef: string | null;
}

export function assetsEqual(a: MedicalAsset, b: MedicalAsset): boolean {
  return (Object.keys(a) as (keyof MedicalAsset)[]).every((key) => a[key] === b[key]);
}

export type ActivityType =
  | 'added'
  | 'updated'
  | 'deleted'
  | 'disposed'
  | 'restocked'
  | 'consumed'
  | 'reverted'
  | 'system';

/** One row of the audit trail. */
export interface ActivityEntry {
  readonly id?: number;
  readonly assetId: string | null;
  readonly assetName: string;
  readonly type: ActivityType;
  readonly message: string;
  /** Epoch milliseconds. */
  readonly timestamp: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export type AlertSensitivity = 'relaxed' | 'standard' | 'conservative';

export interface AppSettings {
  readonly themePreference: ThemePreference;
  readonly sensitivity: AlertSensitivity;
  readonly facilityName: string;
  readonly hasSeededDemoData: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themePreference: 'dark',
  sensitivity: 'standard',
  facilityName: 'City Care Pharmacy',
  hasSeededDemoData: false,
};
