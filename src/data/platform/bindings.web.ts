import { CachedImageStore, DataUriImageStore } from '../imageStores';
import { WebLabelReader } from '../ocr/webLabelReader';
import { KeyValueActivityRepository, KeyValueAssetRepository } from '../storageRepositories';
import type { PlatformServices } from './types';

/** Web: the browser's localStorage and Tesseract.js. */
export async function createPlatformServices(): Promise<PlatformServices> {
  return {
    assets: new KeyValueAssetRepository(),
    activity: new KeyValueActivityRepository(),
    images: new CachedImageStore(new DataUriImageStore()),
    labelReader: new WebLabelReader(),
  };
}
