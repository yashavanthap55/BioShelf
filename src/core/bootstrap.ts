import { createPlatformServices } from '../data/platform/bindings';
import { buildDemoInventory } from '../data/demoInventory';
import { ExpoImageCapture } from '../data/imageCapture';
import { KeyValueSettingsStore } from '../data/storageRepositories';
import type { AssetImageStore, ImageCapture, LabelTextReader } from '../domain/media';
import type { ActivityRepository, AssetRepository, SettingsStore } from '../domain/repositories';
import { InventoryViewModel } from '../presentation/viewmodels/InventoryViewModel';
import { SettingsViewModel } from '../presentation/viewmodels/SettingsViewModel';
import { locator, token } from './serviceLocator';

export const Services = {
  assets: token<AssetRepository>('assets'),
  activity: token<ActivityRepository>('activity'),
  settingsStore: token<SettingsStore>('settingsStore'),
  images: token<AssetImageStore>('images'),
  capture: token<ImageCapture>('capture'),
  labelReader: token<LabelTextReader>('labelReader'),
};

export interface AppServices {
  readonly inventory: InventoryViewModel;
  readonly settings: SettingsViewModel;
  readonly images: AssetImageStore;
  readonly capture: ImageCapture;
  readonly labelReader: LabelTextReader;
}

/** Composition root: binds every abstraction to its production implementation. */
export async function configureDependencies() {
  const platform = await createPlatformServices();
  locator
    .register(Services.assets, platform.assets)
    .register(Services.activity, platform.activity)
    .register(Services.images, platform.images)
    .register(Services.labelReader, platform.labelReader)
    .register(Services.settingsStore, new KeyValueSettingsStore())
    .register(Services.capture, new ExpoImageCapture());
}

/** Builds the view-models from whatever is registered (real or test fakes). */
export async function createAppServices(options: { clock?: () => Date } = {}): Promise<AppServices> {
  const settings = new SettingsViewModel(locator.get(Services.settingsStore));
  await settings.load();
  await seedDemoDataIfNeeded(settings, options.clock?.() ?? new Date());
  void pruneOrphanPhotos();

  const inventory = new InventoryViewModel({
    assets: locator.get(Services.assets),
    activity: locator.get(Services.activity),
    sensitivity: settings.sensitivitySource,
    clock: options.clock,
  });
  void inventory.load();

  return {
    inventory,
    settings,
    images: locator.get(Services.images),
    capture: locator.get(Services.capture),
    labelReader: locator.get(Services.labelReader),
  };
}

/**
 * Fills an empty inventory with sample data on the very first launch only,
 * so a user who deliberately clears their data is never surprised later.
 */
export async function seedDemoDataIfNeeded(settings: SettingsViewModel, now: Date) {
  if (settings.getState().hasSeededDemoData) return;
  const assets = locator.get(Services.assets);
  if ((await assets.fetchAll()).length === 0) {
    await assets.upsertAll(buildDemoInventory(now));
    await locator.get(Services.activity).log({
      assetId: null,
      assetName: 'Inventory',
      type: 'system',
      message: 'Sample inventory loaded',
      timestamp: now.getTime(),
    });
  }
  await settings.markDemoDataSeeded();
}

/**
 * Photos are kept when an asset is deleted so that Undo can restore them; at
 * start-up (undo history is empty) any photo no asset points to is removed.
 */
export async function pruneOrphanPhotos(): Promise<number> {
  try {
    const assets = await locator.get(Services.assets).fetchAll();
    const store = locator.get(Services.images);
    const used = new Set(assets.map((a) => a.imageRef).filter((ref): ref is string => ref !== null));
    const orphans = [...(await store.references())].filter((ref) => !used.has(ref));
    for (const ref of orphans) await store.delete(ref);
    return orphans.length;
  } catch (error) {
    console.warn('Photo clean-up skipped', error);
    return 0;
  }
}
