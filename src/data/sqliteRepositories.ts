import * as SQLite from 'expo-sqlite';

import type { ActivityEntry, MedicalAsset } from '../domain/entities';
import {
  ChangeNotifyingRepository,
  type ActivityRepository,
  type AssetRepository,
} from '../domain/repositories';
import { ActivityMapper, ASSET_COLUMNS, AssetMapper, type ActivityRow, type AssetRow } from './mappers';

const DATABASE_VERSION = 1;

/** Opens the on-device database and applies schema migrations. */
export async function openBioShelfDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('bioshelf.db');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit TEXT NOT NULL,
        reorder_level INTEGER NOT NULL,
        location TEXT NOT NULL,
        storage TEXT NOT NULL,
        manufacture_date TEXT,
        expiry_date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        image_ref TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_assets_expiry ON assets(expiry_date);
      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT,
        asset_name TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_asset ON activity(asset_id);
    `);
  }
  if (current < DATABASE_VERSION) await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  return db;
}

const INSERT_ASSET = `INSERT OR REPLACE INTO assets (${ASSET_COLUMNS.join(', ')}) VALUES (${ASSET_COLUMNS.map(() => '?').join(', ')})`;

const assetValues = (asset: MedicalAsset) => {
  const row = AssetMapper.toRow(asset);
  return ASSET_COLUMNS.map((column) => row[column]);
};

export class SqliteAssetRepository extends ChangeNotifyingRepository implements AssetRepository {
  constructor(private readonly db: SQLite.SQLiteDatabase) {
    super();
  }

  async fetchAll() {
    const rows = await this.db.getAllAsync<AssetRow>('SELECT * FROM assets ORDER BY expiry_date');
    return rows.map(AssetMapper.fromRow);
  }

  async findById(id: string) {
    const row = await this.db.getFirstAsync<AssetRow>('SELECT * FROM assets WHERE id = ?', id);
    return row ? AssetMapper.fromRow(row) : null;
  }

  async upsert(asset: MedicalAsset) {
    await this.db.runAsync(INSERT_ASSET, assetValues(asset));
    this.emitChange({ kind: 'upserted', assetId: asset.id });
  }

  async upsertAll(assets: readonly MedicalAsset[]) {
    await this.db.withTransactionAsync(async () => {
      for (const asset of assets) await this.db.runAsync(INSERT_ASSET, assetValues(asset));
    });
    this.emitChange({ kind: 'upserted' });
  }

  async delete(id: string) {
    await this.db.runAsync('DELETE FROM assets WHERE id = ?', id);
    this.emitChange({ kind: 'deleted', assetId: id });
  }

  async clear() {
    await this.db.runAsync('DELETE FROM assets');
    this.emitChange({ kind: 'cleared' });
  }
}

export class SqliteActivityRepository implements ActivityRepository {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  async log(entry: ActivityEntry) {
    const row = ActivityMapper.toRow(entry);
    await this.db.runAsync(
      'INSERT INTO activity (asset_id, asset_name, type, message, timestamp) VALUES (?, ?, ?, ?, ?)',
      row.asset_id,
      row.asset_name,
      row.type,
      row.message,
      row.timestamp,
    );
  }

  async recent({ limit = 30, assetId }: { limit?: number; assetId?: string } = {}) {
    const rows =
      assetId === undefined
        ? await this.db.getAllAsync<ActivityRow>(
            'SELECT * FROM activity ORDER BY timestamp DESC, id DESC LIMIT ?',
            limit,
          )
        : await this.db.getAllAsync<ActivityRow>(
            'SELECT * FROM activity WHERE asset_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?',
            assetId,
            limit,
          );
    return rows.map(ActivityMapper.fromRow);
  }

  async clear() {
    await this.db.runAsync('DELETE FROM activity');
  }
}
