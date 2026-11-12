import type { LabelTextReader, PickedImage } from '../../domain/media';
import type { LabelScan, OcrLine } from '../../domain/labelParser';

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { y0: number; y1: number };
}

export interface TesseractLine {
  words: TesseractWord[];
}

interface TesseractWorker {
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  recognize(image: string, options: { rotateAuto: boolean }): Promise<{ data: { lines?: TesseractLine[] } }>;
}

interface TesseractGlobal {
  createWorker(language: string): Promise<TesseractWorker>;
}

const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const tesseract = () => (globalThis as { Tesseract?: TesseractGlobal }).Tesseract;

/** Tesseract reads tall glyphs best, so small images are enlarged too. */
const OCR_MAX_SIDE = 2400;
const MAX_UPSCALE = 3;
/** Below this Tesseract is guessing: graphics and glare read as junk words. */
const MIN_WORD_CONFIDENCE = 60;
/** Fewer trusted letters than this is a stray guess, not a label. */
const MIN_LETTERS = 8;
/** A pass with this many trusted letters has read the label; skip the fallback. */
const ENOUGH_LETTERS = 60;

/** Pixel luminance of RGBA image data. */
export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return gray;
}

/** Spreads brightness over the full range, ignoring the extreme 1% at each end. */
export function stretchContrast(gray: Uint8ClampedArray): Uint8ClampedArray {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[value]++;
  const clip = gray.length * 0.01;
  let low = 0;
  let high = 255;
  for (let seen = histogram[low]; seen < clip; seen += histogram[low]) low++;
  for (let seen = histogram[high]; seen < clip; seen += histogram[high]) high--;
  const range = Math.max(1, high - low);
  return gray.map((value) => ((value - low) * 255) / range);
}

/**
 * Black text on white by comparing each pixel with its neighbourhood, so print
 * survives on foil and under glare. Too harsh on busy photos, hence a fallback.
 */
export function adaptiveThreshold(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const stride = width + 1;
  const sums = new Float64Array(stride * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += gray[(y - 1) * width + x - 1];
      sums[y * stride + x] = sums[(y - 1) * stride + x] + row;
    }
  }
  const radius = Math.max(12, Math.round(Math.max(width, height) / 48));
  const output = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const total = sums[y1 * stride + x1] - sums[y0 * stride + x1] - sums[y1 * stride + x0] + sums[y0 * stride + x0];
      output[y * width + x] = gray[y * width + x] < (total / area) * 0.88 ? 0 : 255;
    }
  }
  return output;
}

const letterCount = (lines: readonly OcrLine[]) =>
  lines.reduce((sum, line) => sum + line.text.replace(/[^A-Za-z]/g, '').length, 0);

/**
 * Keeps only the words Tesseract is sure of, so noise can't become a product
 * name. Judged per word because junk beside real text ("Exp. 10/2026 5; h Gy")
 * would drag a whole line's score down and lose the date with it.
 */
export function confidentLines(lines: readonly TesseractLine[]): OcrLine[] {
  const kept = lines
    .map((line) => line.words.filter((word) => word.confidence >= MIN_WORD_CONFIDENCE && word.text.trim()))
    .filter((words) => words.length > 0)
    .map((words) => ({
      text: words.map((word) => word.text.trim()).join(' '),
      height: Math.max(...words.map((word) => Math.abs(word.bbox.y1 - word.bbox.y0))),
    }));
  return letterCount(kept) >= MIN_LETTERS ? kept : [];
}

type PixelFilter = (gray: Uint8ClampedArray, width: number, height: number) => Uint8ClampedArray;

/** Measured on cartons, foil strips and curved vials: the first suits most labels. */
const PASSES: readonly { filter: PixelFilter; pageSegmentation: string }[] = [
  { filter: stretchContrast, pageSegmentation: '11' }, // sparse text
  { filter: adaptiveThreshold, pageSegmentation: '3' }, // automatic layout
];

async function loadPixels(uri: string) {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const scale = Math.min(MAX_UPSCALE, OCR_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process the photo');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
}

/**
 * Adapter: Tesseract.js in the browser. The engine (~2 MB plus English data)
 * is downloaded only the first time a label is scanned. It is built for clean
 * documents, so photos are cleaned up first and unsure words thrown away.
 */
export class WebLabelReader implements LabelTextReader {
  readonly isSupported = true;
  private loading: Promise<void> | null = null;
  private worker: Promise<TesseractWorker> | null = null;

  private ensureLoaded(): Promise<void> {
    if (tesseract()) return Promise.resolve();
    this.loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => {
        this.loading = null; // allow a retry once the connection is back
        reject(new Error('Could not load the text-recognition engine. Check your internet connection.'));
      });
      document.head.appendChild(script);
    });
    return this.loading;
  }

  private getWorker(): Promise<TesseractWorker> {
    this.worker ??= this.ensureLoaded()
      .then(() => {
        const engine = tesseract();
        if (!engine) throw new Error('Text-recognition engine is unavailable');
        return engine.createWorker('eng');
      })
      .catch((error: unknown) => {
        this.worker = null; // allow a retry
        throw error;
      });
    return this.worker;
  }

  async read(image: PickedImage): Promise<LabelScan> {
    const worker = await this.getWorker();
    const uri = image.ocrUri ?? (image.base64 ? `data:image/jpeg;base64,${image.base64}` : image.uri);
    const { canvas, context, pixels } = await loadPixels(uri);
    const gray = toGray(pixels.data);

    let best: OcrLine[] = [];
    for (const { filter, pageSegmentation } of PASSES) {
      const filtered = filter(gray, canvas.width, canvas.height);
      for (let i = 0; i < filtered.length; i++) {
        pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = filtered[i];
      }
      context.putImageData(pixels, 0, 0);
      await worker.setParameters({ tessedit_pageseg_mode: pageSegmentation });
      // Photos are rarely straight, and a slight tilt cuts lines in half.
      const { data } = await worker.recognize(canvas.toDataURL('image/jpeg', 0.92), { rotateAuto: true });
      const lines = confidentLines(data.lines ?? []);
      if (letterCount(lines) > letterCount(best)) best = lines;
      if (letterCount(best) >= ENOUGH_LETTERS) break;
    }
    // Text comes from the trusted words too: the parser falls back to it when no lines survive.
    return { text: best.map((line) => line.text).join('\n'), lines: best };
  }
}
