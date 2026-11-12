import type { AssetImageStore, LabelTextReader } from '../../domain/media';
import type { ActivityRepository, AssetRepository } from '../../domain/repositories';

/** The storage + OCR implementations that differ between mobile and web. */
export interface PlatformServices {
  readonly assets: AssetRepository;
  readonly activity: ActivityRepository;
  readonly images: AssetImageStore;
  readonly labelReader: LabelTextReader;
}
