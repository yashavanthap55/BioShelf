import type { LabelScan } from './labelParser';

/** An image chosen by the user, before it is stored. */
export interface PickedImage {
  /** file:// URI on mobile, data: or blob: URI on the web. */
  readonly uri: string;
  /** Base64 JPEG, when the platform needs bytes rather than a file (web). */
  readonly base64?: string;
  /** Full-resolution original for OCR, on the web where `uri` is shrunk to fit localStorage. */
  readonly ocrUri?: string;
}

export type CaptureSource = 'camera' | 'gallery';

/** Takes or chooses a photo (camera / gallery / file upload). */
export interface ImageCapture {
  readonly supportsCamera: boolean;
  /** Resolves to null when the user cancels. */
  pick(source: CaptureSource): Promise<PickedImage | null>;
}

/** Repository for asset photos. Assets keep only the returned reference. */
export interface AssetImageStore {
  /** Persists the photo and returns the reference to keep on the asset. */
  save(image: PickedImage): Promise<string>;
  /** A URI an <Image> can display, or null if the photo is gone. */
  resolve(reference: string): Promise<string | null>;
  delete(reference: string): Promise<void>;
  /** Every stored reference, used to clean up photos no asset points to. */
  references(): Promise<Set<string>>;
}

/** Adapter target for OCR engines (ML Kit / Vision on mobile, Tesseract.js on web). */
export interface LabelTextReader {
  /** False where no OCR engine is available; photos still attach. */
  readonly isSupported: boolean;
  read(image: PickedImage): Promise<LabelScan>;
}
