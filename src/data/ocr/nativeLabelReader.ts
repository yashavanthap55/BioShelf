import { requireOptionalNativeModule } from 'expo';

import type { LabelTextReader, PickedImage } from '../../domain/media';
import type { LabelScan } from '../../domain/labelParser';

interface TextExtractorModule {
  readonly isSupported: boolean;
  extractTextFromImage(uri: string): Promise<string[]>;
}

// Optional so the app still runs in Expo Go, which doesn't bundle this
// native module; label reading switches on in a development/production build.
const extractor = requireOptionalNativeModule<TextExtractorModule>('ExpoTextExtractor');

/**
 * Adapter: on-device text recognition (Google ML Kit on Android, Apple
 * Vision on iOS) via expo-text-extractor. Works offline; the photo never
 * leaves the phone.
 */
export class NativeLabelReader implements LabelTextReader {
  readonly isSupported = extractor?.isSupported ?? false;

  async read(image: PickedImage): Promise<LabelScan> {
    if (!extractor) throw new Error('Text recognition needs the installed BioShelf app build');
    const blocks = await extractor.extractTextFromImage(image.uri.replace('file://', ''));
    const lines = blocks
      .flatMap((block) => block.split('\n'))
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, height: 0 }));
    return { text: blocks.join('\n'), lines };
  }
}
