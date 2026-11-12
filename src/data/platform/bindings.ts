// Native (Android / iOS) bindings. Metro picks `bindings.web.ts` for the web
// build instead, so SQLite and file-system code never reach the browser.

import { FileImageStore } from '../fileImageStore';
import { CachedImageStore } from '../imageStores';
import { NativeLabelReader } from '../ocr/nativeLabelReader';
import { openBioShelfDatabase, SqliteActivityRepository, SqliteAssetRepository } from '../sqliteRepositories';
import type { PlatformServices } from './types';

/** Mobile: SQLite database, photos as files, on-device OCR. */
export async function createPlatformServices(): Promise<PlatformServices> {
  const db = await openBioShelfDatabase();
  return {
    assets: new SqliteAssetRepository(db),
    activity: new SqliteActivityRepository(db),
    images: new CachedImageStore(new FileImageStore()),
    labelReader: new NativeLabelReader(),
  };
}
