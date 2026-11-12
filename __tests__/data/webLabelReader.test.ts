import { LabelParser, scanFromText } from '../../src/domain/labelParser';
import {
  adaptiveThreshold,
  confidentLines,
  stretchContrast,
  toGray,
} from '../../src/data/ocr/webLabelReader';

/** One OCR line; each word is `[text, confidence]`, 40 px tall unless given. */
const line = (...words: [string, number, number?][]) => ({
  words: words.map(([text, confidence, height = 40]) => ({ text, confidence, bbox: { y0: 10, y1: 10 + height } })),
});

describe('confidentLines', () => {
  it('drops the junk Tesseract reads from graphics, however large', () => {
    const lines = confidentLines([
      line(['Babs', 22, 200], ['hoa', 18, 200], ['r', 5, 200]),
      line(['Paracetamol', 91, 50], ['Tablets', 93, 50]),
    ]);
    expect(lines).toEqual([{ text: 'Paracetamol Tablets', height: 50 }]);
  });

  it('keeps real text sitting next to junk on the same line', () => {
    const [kept] = confidentLines([
      line(['B.No.', 90], ['MF2209', 88], ['Exp.', 92], ['10/2026', 85], ['5;', 12], ['h', 9], ['Gy', 20]),
    ]);
    expect(kept.text).toBe('B.No. MF2209 Exp. 10/2026');
  });

  it('measures a line by its trusted words, not the junk beside them', () => {
    const [kept] = confidentLines([line(['Hepatitis', 90, 40], ['Vaccine', 90, 42], ['@', 10, 300])]);
    expect(kept.height).toBe(42);
  });

  it('leaves the parser nothing to invent a name from when all words are noise', () => {
    const lines = confidentLines([line(['an', 30], ['METE', 31], ['0', 20], [')', 10])]);
    expect(lines).toEqual([]);
    expect(new LabelParser().parse({ text: '', lines }).name).toBeUndefined();
    // What this guards against: the unfiltered text would have become the name.
    expect(new LabelParser().parse(scanFromText('an METE 0 )')).name).toBe('an METE 0 )');
  });

  it('skips blank words', () => {
    const lines = confidentLines([line(['   ', 95]), line(['Hepatitis', 95], ['  ', 95], ['Vaccine', 95])]);
    expect(lines.map((kept) => kept.text)).toEqual(['Hepatitis Vaccine']);
  });

  it('treats a few stray characters as no text at all', () => {
    expect(confidentLines([line(['wei', 61]), line(['4', 82], ['4', 82]), line(['A', 65])])).toEqual([]);
  });
});

describe('image filters', () => {
  it('converts RGBA to luminance', () => {
    const gray = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
    expect(Array.from(gray)).toEqual([255, 0]);
  });

  it('stretches a washed-out image to the full range', () => {
    const gray = new Uint8ClampedArray(1000).map((_, i) => (i % 2 ? 180 : 120));
    const stretched = stretchContrast(gray);
    expect(Math.min(...stretched)).toBe(0);
    expect(Math.max(...stretched)).toBe(255);
  });

  it('survives a flat image', () => {
    expect(Array.from(stretchContrast(new Uint8ClampedArray(100).fill(90))).every((v) => v === 0)).toBe(true);
  });

  it('finds dark print on both the bright and the shaded side of a photo', () => {
    const size = 200;
    const gray = new Uint8ClampedArray(size * size);
    const at = (x: number, y: number) => y * size + x;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) gray[at(x, y)] = 90 + (x / size) * 150; // glare towards the right
    }
    gray[at(20, 100)] -= 50; // print in the shade
    gray[at(180, 100)] -= 50; // print in the glare, brighter than the shaded background
    const out = adaptiveThreshold(gray, size, size);
    expect(out[at(20, 100)]).toBe(0);
    expect(out[at(180, 100)]).toBe(0);
    expect(out[at(20, 50)]).toBe(255);
    expect(out[at(180, 50)]).toBe(255);
  });
});
