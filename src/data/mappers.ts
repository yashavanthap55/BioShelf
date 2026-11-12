import type { ActivityEntry, ActivityType, AssetCategory, MedicalAsset, StorageCondition } from '../domain/entities';

/** Column layout shared by every backend (SQLite rows, JSON in localStorage). */
export interface AssetRow {
  id: string;
  name: string;
  category: string;
  batch_number: string;
  manufacturer: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  location: string;
  storage: string;
  manufacture_date: string | null;
  expiry_date: string;
  notes: string;
  created_at: number;
  updated_at: number;
  image_ref: string | null;
}

export const ASSET_COLUMNS: readonly (keyof AssetRow)[] = [
  'id',
  'name',
  'category',
  'batch_number',
  'manufacturer',
  'quantity',
  'unit',
  'reorder_level',
  'location',
  'storage',
  'manufacture_date',
  'expiry_date',
  'notes',
  'created_at',
  'updated_at',
  'image_ref',
];

export interface ActivityRow {
  id?: number;
  asset_id: string | null;
  asset_name: string;
  type: string;
  message: string;
  timestamp: number;
}

/**
 * Data Mapper: translates between domain entities and storage rows so the
 * entities never know about column names or storage formats.
 */
export const AssetMapper = {
  toRow(a: MedicalAsset): AssetRow {
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      batch_number: a.batchNumber,
      manufacturer: a.manufacturer,
      quantity: a.quantity,
      unit: a.unit,
      reorder_level: a.reorderLevel,
      location: a.location,
      storage: a.storage,
      manufacture_date: a.manufactureDate,
      expiry_date: a.expiryDate,
      notes: a.notes,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
      image_ref: a.imageRef,
    };
  },

  fromRow(row: AssetRow): MedicalAsset {
    return {
      id: row.id,
      name: row.name,
      category: row.category as AssetCategory,
      batchNumber: row.batch_number,
      manufacturer: row.manufacturer,
      quantity: Number(row.quantity),
      unit: row.unit,
      reorderLevel: Number(row.reorder_level),
      location: row.location,
      storage: row.storage as StorageCondition,
      manufactureDate: row.manufacture_date ?? null,
      expiryDate: row.expiry_date,
      notes: row.notes ?? '',
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      imageRef: row.image_ref ?? null,
    };
  },
};

export const ActivityMapper = {
  toRow(e: ActivityEntry): ActivityRow {
    return {
      ...(e.id !== undefined ? { id: e.id } : {}),
      asset_id: e.assetId,
      asset_name: e.assetName,
      type: e.type,
      message: e.message,
      timestamp: e.timestamp,
    };
  },

  fromRow(row: ActivityRow): ActivityEntry {
    return {
      id: row.id,
      assetId: row.asset_id ?? null,
      assetName: row.asset_name,
      type: row.type as ActivityType,
      message: row.message,
      timestamp: Number(row.timestamp),
    };
  },
};
