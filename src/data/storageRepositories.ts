import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, type ActivityEntry, type AppSettings, type MedicalAsset } from '../domain/entities';
import {
  ChangeNotifyingRepository,
  type ActivityRepository,
  type AssetRepository,
  type SettingsStore,
} from '../domain/repositories';
import { ActivityMapper, AssetMapper, type ActivityRow, type AssetRow } from './mappers';

/**
 * Key-value backed asset storage (localStorage in the browser). Stores the
 * same rows the SQLite repository writes, as one JSON array.
 */
export class KeyValueAssetRepository extends ChangeNotifyingRepository implements AssetRepository {
  private static readonly key = 'bioshelf.assets.v1';
  private cache: Map<string, MedicalAsset> | null = null;

  private async items(): Promise<Map<string, MedicalAsset>> {
    if (!this.cache) {
      const raw = await AsyncStorage.getItem(KeyValueAssetRepository.key);
      const rows: AssetRow[] = raw ? JSON.parse(raw) : [];
      this.cache = new Map(rows.map((row) => [row.id, AssetMapper.fromRow(row)]));
    }
    return this.cache;
  }

  private async persist() {
    const items = await this.items();
    await AsyncStorage.setItem(
      KeyValueAssetRepository.key,
      JSON.stringify([...items.values()].map(AssetMapper.toRow)),
    );
  }

  async fetchAll() {
    return [...(await this.items()).values()].sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  }

  async findById(id: string) {
    return (await this.items()).get(id) ?? null;
  }

  async upsert(asset: MedicalAsset) {
    (await this.items()).set(asset.id, asset);
    await this.persist();
    this.emitChange({ kind: 'upserted', assetId: asset.id });
  }

  async upsertAll(assets: readonly MedicalAsset[]) {
    const items = await this.items();
    assets.forEach((asset) => items.set(asset.id, asset));
    await this.persist();
    this.emitChange({ kind: 'upserted' });
  }

  async delete(id: string) {
    (await this.items()).delete(id);
    await this.persist();
    this.emitChange({ kind: 'deleted', assetId: id });
  }

  async clear() {
    (await this.items()).clear();
    await this.persist();
    this.emitChange({ kind: 'cleared' });
  }
}

/** Audit trail in key-value storage, capped to keep it small. */
export class KeyValueActivityRepository implements ActivityRepository {
  private static readonly key = 'bioshelf.activity.v1';
  private static readonly maxEntries = 300;
  private cache: ActivityEntry[] | null = null;

  private async entries(): Promise<ActivityEntry[]> {
    if (!this.cache) {
      const raw = await AsyncStorage.getItem(KeyValueActivityRepository.key);
      const rows: ActivityRow[] = raw ? JSON.parse(raw) : [];
      this.cache = rows.map(ActivityMapper.fromRow);
    }
    return this.cache;
  }

  async log(entry: ActivityEntry) {
    const entries = await this.entries();
    const nextId = entries.reduce((max, e) => Math.max(max, e.id ?? 0), 0) + 1;
    entries.push({ ...entry, id: nextId });
    if (entries.length > KeyValueActivityRepository.maxEntries) {
      entries.splice(0, entries.length - KeyValueActivityRepository.maxEntries);
    }
    await AsyncStorage.setItem(KeyValueActivityRepository.key, JSON.stringify(entries.map(ActivityMapper.toRow)));
  }

  async recent({ limit = 30, assetId }: { limit?: number; assetId?: string } = {}) {
    return (await this.entries())
      .filter((e) => assetId === undefined || e.assetId === assetId)
      .sort((a, b) => b.timestamp - a.timestamp || (b.id ?? 0) - (a.id ?? 0))
      .slice(0, limit);
  }

  async clear() {
    this.cache = [];
    await AsyncStorage.removeItem(KeyValueActivityRepository.key);
  }
}

export class KeyValueSettingsStore implements SettingsStore {
  private static readonly key = 'bioshelf.settings.v1';

  async load(): Promise<AppSettings> {
    const raw = await AsyncStorage.getItem(KeyValueSettingsStore.key);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  }

  async save(settings: AppSettings) {
    await AsyncStorage.setItem(KeyValueSettingsStore.key, JSON.stringify(settings));
  }
}
