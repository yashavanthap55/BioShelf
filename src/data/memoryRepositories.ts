import { DEFAULT_SETTINGS, type ActivityEntry, type AppSettings, type MedicalAsset } from '../domain/entities';
import {
  ChangeNotifyingRepository,
  type ActivityRepository,
  type AssetRepository,
  type SettingsStore,
} from '../domain/repositories';

/**
 * Volatile implementations of the repository interfaces, used by tests and
 * handy for previews. They prove the UI only depends on abstractions.
 */
export class InMemoryAssetRepository extends ChangeNotifyingRepository implements AssetRepository {
  private readonly items = new Map<string, MedicalAsset>();

  constructor(seed: readonly MedicalAsset[] = []) {
    super();
    seed.forEach((asset) => this.items.set(asset.id, asset));
  }

  async fetchAll() {
    return [...this.items.values()].sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  }

  async findById(id: string) {
    return this.items.get(id) ?? null;
  }

  async upsert(asset: MedicalAsset) {
    this.items.set(asset.id, asset);
    this.emitChange({ kind: 'upserted', assetId: asset.id });
  }

  async upsertAll(assets: readonly MedicalAsset[]) {
    assets.forEach((asset) => this.items.set(asset.id, asset));
    this.emitChange({ kind: 'upserted' });
  }

  async delete(id: string) {
    this.items.delete(id);
    this.emitChange({ kind: 'deleted', assetId: id });
  }

  async clear() {
    this.items.clear();
    this.emitChange({ kind: 'cleared' });
  }
}

export class InMemoryActivityRepository implements ActivityRepository {
  private entries: ActivityEntry[] = [];
  private nextId = 1;

  async log(entry: ActivityEntry) {
    this.entries.push({ ...entry, id: this.nextId++ });
  }

  async recent({ limit = 30, assetId }: { limit?: number; assetId?: string } = {}) {
    return this.entries
      .filter((e) => assetId === undefined || e.assetId === assetId)
      .sort((a, b) => b.timestamp - a.timestamp || (b.id ?? 0) - (a.id ?? 0))
      .slice(0, limit);
  }

  async clear() {
    this.entries = [];
  }
}

export class InMemorySettingsStore implements SettingsStore {
  constructor(private settings: AppSettings = DEFAULT_SETTINGS) {}

  async load() {
    return this.settings;
  }

  async save(settings: AppSettings) {
    this.settings = settings;
  }
}
