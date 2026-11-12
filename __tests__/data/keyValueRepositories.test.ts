import AsyncStorage from '@react-native-async-storage/async-storage';

import { CachedImageStore, DataUriImageStore, InMemoryImageStore } from '../../src/data/imageStores';
import { KeyValueActivityRepository, KeyValueAssetRepository } from '../../src/data/storageRepositories';
import { asset, NOW } from '../support/fixtures';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/** The web backend must behave exactly like SQLite behind the same interface. */
describe('key-value (browser) repositories', () => {
  beforeEach(() => AsyncStorage.clear());

  it('persists assets across instances (page reloads)', async () => {
    const first = new KeyValueAssetRepository();
    const changes: string[] = [];
    first.subscribe((c) => changes.push(c.kind));

    await first.upsertAll([asset('a', { expiresInDays: 30 }), asset('b', { expiresInDays: 5 })]);
    await first.upsert(asset('a', { expiresInDays: 30, quantity: 7 }));
    await first.delete('missing');

    const reloaded = new KeyValueAssetRepository();
    expect((await reloaded.fetchAll()).map((a) => a.id)).toEqual(['b', 'a']);
    expect(await reloaded.findById('a')).toEqual(asset('a', { expiresInDays: 30, quantity: 7 }));
    expect(changes).toEqual(['upserted', 'upserted', 'deleted']);

    await reloaded.clear();
    expect(await new KeyValueAssetRepository().fetchAll()).toEqual([]);
  });

  it('keeps the newest 300 activity entries, filterable by asset', async () => {
    const log = new KeyValueActivityRepository();
    for (let i = 0; i < 305; i++) {
      await log.log({
        assetId: i % 2 === 0 ? 'even' : 'odd',
        assetName: `Item ${i}`,
        type: 'updated',
        message: `change ${i}`,
        timestamp: NOW.getTime() + i * 60_000,
      });
    }
    const reloaded = new KeyValueActivityRepository();
    const recent = await reloaded.recent({ limit: 400 });
    expect(recent).toHaveLength(300);
    expect(recent[0].message).toBe('change 304');
    expect((await reloaded.recent({ limit: 3, assetId: 'odd' })).map((e) => e.message)).toEqual([
      'change 303',
      'change 301',
      'change 299',
    ]);
  });

  it('stores photos as data URIs and lists them for clean-up', async () => {
    const store = new DataUriImageStore();
    const ref = await store.save({ uri: 'blob:x', base64: 'QUJD' });
    expect(await store.resolve(ref)).toBe('data:image/jpeg;base64,QUJD');
    expect(await store.references()).toEqual(new Set([ref]));
    await store.delete(ref);
    expect(await store.resolve(ref)).toBeNull();
  });

  it('caches resolved photos (Decorator)', async () => {
    const inner = new InMemoryImageStore();
    const resolveSpy = jest.spyOn(inner, 'resolve');
    const cached = new CachedImageStore(inner);
    const ref = await cached.save({ uri: 'file:///photo.jpg' });
    expect(await cached.resolve(ref)).toBe('file:///photo.jpg');
    expect(await cached.resolve(ref)).toBe('file:///photo.jpg');
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });
});
