import AsyncStorage from '@react-native-async-storage/async-storage';

import { generateId } from '../core/id';
import type { AssetImageStore, PickedImage } from '../domain/media';

/** Volatile photo store for tests and previews. */
export class InMemoryImageStore implements AssetImageStore {
  private readonly images = new Map<string, string>();

  async save(image: PickedImage) {
    const ref = `${generateId()}.jpg`;
    this.images.set(ref, image.uri);
    return ref;
  }

  async resolve(reference: string) {
    return this.images.get(reference) ?? null;
  }

  async delete(reference: string) {
    this.images.delete(reference);
  }

  async references() {
    return new Set(this.images.keys());
  }
}

/**
 * Browser photo store: JPEG data URIs in localStorage. localStorage is small
 * (about 5 MB per site), so the picker downsizes photos first; a full store
 * surfaces as an error the form reports.
 */
export class DataUriImageStore implements AssetImageStore {
  private static readonly prefix = 'bioshelf.image.';

  async save(image: PickedImage) {
    const dataUri = image.base64 ? `data:image/jpeg;base64,${image.base64}` : image.uri;
    if (!dataUri.startsWith('data:')) throw new Error('Photo data is unavailable');
    const ref = `${generateId()}.jpg`;
    await AsyncStorage.setItem(DataUriImageStore.prefix + ref, dataUri);
    return ref;
  }

  resolve(reference: string) {
    return AsyncStorage.getItem(DataUriImageStore.prefix + reference);
  }

  delete(reference: string) {
    return AsyncStorage.removeItem(DataUriImageStore.prefix + reference);
  }

  async references() {
    const keys = await AsyncStorage.getAllKeys();
    return new Set(
      keys
        .filter((key) => key.startsWith(DataUriImageStore.prefix))
        .map((key) => key.slice(DataUriImageStore.prefix.length)),
    );
  }
}

/**
 * Decorator: remembers resolved photo URIs so scrolling a list of thumbnails
 * doesn't re-read storage for every row.
 */
export class CachedImageStore implements AssetImageStore {
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly inner: AssetImageStore,
    private readonly capacity = 60,
  ) {}

  private remember(ref: string, uri: string) {
    this.cache.delete(ref);
    this.cache.set(ref, uri);
    while (this.cache.size > this.capacity) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
  }

  async save(image: PickedImage) {
    return this.inner.save(image);
  }

  async resolve(reference: string) {
    const hit = this.cache.get(reference);
    if (hit) {
      this.remember(reference, hit);
      return hit;
    }
    const uri = await this.inner.resolve(reference);
    if (uri) this.remember(reference, uri);
    return uri;
  }

  async delete(reference: string) {
    this.cache.delete(reference);
    await this.inner.delete(reference);
  }

  references() {
    return this.inner.references();
  }
}
