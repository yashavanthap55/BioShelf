import type { ActivityEntry, AppSettings, MedicalAsset } from './entities';

export type ChangeKind = 'upserted' | 'deleted' | 'cleared';

export interface RepositoryChange {
  readonly kind: ChangeKind;
  readonly assetId?: string;
}

export type ChangeListener = (change: RepositoryChange) => void;

/**
 * Repository pattern: the domain's view of asset storage. View-models depend
 * on this interface only, so SQLite can be swapped for browser storage on the
 * web or an in-memory store in tests.
 */
export interface AssetRepository {
  /** Observer pattern: called whenever stored assets change. */
  subscribe(listener: ChangeListener): () => void;
  fetchAll(): Promise<MedicalAsset[]>;
  findById(id: string): Promise<MedicalAsset | null>;
  upsert(asset: MedicalAsset): Promise<void>;
  upsertAll(assets: readonly MedicalAsset[]): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface ActivityRepository {
  log(entry: ActivityEntry): Promise<void>;
  recent(options?: { limit?: number; assetId?: string }): Promise<ActivityEntry[]>;
  clear(): Promise<void>;
}

export interface SettingsStore {
  load(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

/** Shared change-notification plumbing for repository implementations. */
export abstract class ChangeNotifyingRepository {
  private readonly listeners = new Set<ChangeListener>();

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Delivered synchronously, so a listener can tell its own writes apart
   * from writes made elsewhere (it is notified before the write resolves).
   */
  protected emitChange(change: RepositoryChange) {
    for (const listener of this.listeners) listener(change);
  }
}
