import { endOfMonth, safeISODate, startOfMonth, compareISO, type ISODate } from './dates';
import type { AssetCategory, StorageCondition } from './entities';

/** One line of OCR output. [height] is the text height in pixels when known. */
export interface OcrLine {
  readonly text: string;
  readonly height: number;
}

/** Raw OCR result for one photo of a label. */
export interface LabelScan {
  readonly text: string;
  readonly lines: readonly OcrLine[];
}

export function scanFromText(text: string): LabelScan {
  return {
    text,
    lines: text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ text: line, height: 0 })),
  };
}

/** Everything the parser managed to read from a label. */
export interface LabelDetails {
  name?: string;
  manufacturer?: string;
  batchNumber?: string;
  manufactureDate?: ISODate;
  expiryDate?: ISODate;
  quantity?: number;
  unit?: string;
  category?: AssetCategory;
  storage?: StorageCondition;
  notes?: string;
  /** The batch value came from a serial-number field (equipment). */
  isSerialNumber: boolean;
}

export function detectedFields(d: LabelDetails): string[] {
  return [
    d.name && 'Name',
    d.manufacturer && 'Manufacturer',
    d.batchNumber && (d.isSerialNumber ? 'Serial no.' : 'Batch'),
    d.manufactureDate && 'Manufactured',
    d.expiryDate && 'Expiry',
    d.quantity !== undefined && 'Quantity',
    d.category && 'Category',
    d.storage && 'Storage',
    d.notes && 'Handling notes',
  ].filter((x): x is string => typeof x === 'string');
}

/** State handed along the extractor chain. */
export class LabelContext {
  readonly lowerText: string;
  readonly details: LabelDetails = { isSerialNumber: false };
  /** Lines already claimed by a field, so the name finder skips them. */
  readonly usedLines = new Set<number>();

  constructor(readonly lines: readonly OcrLine[]) {
    this.lowerText = lines.map((l) => l.text).join('\n').toLowerCase();
  }
}

/**
 * Chain of Responsibility: each extractor resolves the fields it knows about
 * and skips any field an earlier link in the chain already filled.
 */
export abstract class LabelFieldExtractor {
  abstract extract(context: LabelContext): void;
}

// ---------------------------------------------------------------- helpers --

const normalize = (text: string) =>
  text
    .replace(/[®™©]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/：/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

function clean(value: string | undefined, maxLength = 64): string | undefined {
  if (value === undefined) return undefined;
  let v = value.trim().replace(/^[\s:;,.\-#]+|[\s:;,\-#]+$/g, '').trim();
  if (v.length > maxLength) v = v.slice(0, maxLength).trim();
  return /[A-Za-z]{2,}/.test(v) || /\d/.test(v) ? v : undefined;
}

/** Converts SHOUTED text to Title Case while keeping short codes (IP, MG). */
export function smartTitleCase(value: string): string {
  const letters = value.replace(/[^A-Za-z]/g, '');
  if (!letters) return value;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (upper / letters.length < 0.7) return value;
  return value
    .split(' ')
    .map((word) =>
      word.length >= 4 && /^[A-Z][A-Z-]+[.,]?$/.test(word)
        ? word[0] + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ');
}

interface FoundDate {
  readonly year: number;
  readonly month: number;
  /** null when only month and year were printed ("EXP 12/2027"). */
  readonly day: number | null;
  readonly start: number;
  readonly end: number;
  /** Unambiguous format (4-digit year or month name), safe without a label. */
  readonly strong: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9';

/** OCR often reads 0 as O and 1 as I/l inside numbers. */
function fixDigits(s: string): string {
  return Array.from(s, (ch, i) => {
    if (!isDigit(s[i - 1]) && !isDigit(s[i + 1])) return ch;
    if (ch === 'o' || ch === 'O') return '0';
    if (ch === 'I' || ch === 'l' || ch === '|') return '1';
    return ch;
  }).join('');
}

function year(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  const y = raw.length === 2 ? 2000 + n : n;
  return y >= 2010 && y <= 2060 ? y : null;
}

const DATE_PATTERNS = {
  isoFull: /\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/g,
  dmy: /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g,
  named:
    /\b(?:(\d{1,2})(?:st|nd|rd|th)?[\s./-]*)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?[\s./\-,']*(\d{4}|\d{2})\b/gi,
  isoMonth: /\b(20\d{2})[./-](\d{1,2})\b/g,
  monthYear: /\b(\d{1,2})\s?([./-])\s?(\d{4}|\d{2})\b(?!\s*(?:°|º|˚|%|mg|ml|c\b))/gi,
};

export function findDates(line: string): FoundDate[] {
  const s = fixDigits(line);
  const found: FoundDate[] = [];
  const add = (
    y: number | null,
    month: number,
    day: number | null,
    m: RegExpMatchArray,
    strong: boolean,
  ) => {
    if (y === null || month < 1 || month > 12) return;
    if (day !== null && safeISODate(y, month, day) === null) return;
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (found.some((f) => start < f.end && end > f.start)) return;
    found.push({ year: y, month, day, start, end, strong });
  };

  for (const m of s.matchAll(DATE_PATTERNS.isoFull)) {
    add(year(m[1]), Number(m[2]), Number(m[3]), m, true);
  }
  for (const m of s.matchAll(DATE_PATTERNS.dmy)) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    // Default to day-first (India/Europe); swap only if that is impossible.
    if (month > 12 && day <= 12) [day, month] = [month, day];
    add(year(m[3]), month, day, m, m[3].length === 4);
  }
  for (const m of s.matchAll(DATE_PATTERNS.named)) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    add(year(m[3]), month, m[1] ? Number(m[1]) : null, m, true);
  }
  for (const m of s.matchAll(DATE_PATTERNS.isoMonth)) {
    add(year(m[1]), Number(m[2]), null, m, true);
  }
  for (const m of s.matchAll(DATE_PATTERNS.monthYear)) {
    const fourDigit = m[3].length === 4;
    // "8-15" is far more likely a range than August 2015.
    if (!fourDigit && m[2] === '-') continue;
    add(year(m[3]), Number(m[1]), null, m, fourDigit);
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Month-only expiry dates mean the end of that month. */
const asExpiry = (d: FoundDate): ISODate =>
  d.day === null ? endOfMonth(d.year, d.month) : (safeISODate(d.year, d.month, d.day) as ISODate);

const asManufacture = (d: FoundDate): ISODate =>
  d.day === null ? startOfMonth(d.year, d.month) : (safeISODate(d.year, d.month, d.day) as ISODate);

// ------------------------------------------------------------- extractors --

/** GS1 element strings: (17) expiry YYMMDD, (11) production date, (10) batch. */
export class Gs1Extractor extends LabelFieldExtractor {
  private static readonly element = /\((\d{2})\)\s*([^\s(]+)/g;

  private static yymmdd(value: string, expiry: boolean): ISODate | undefined {
    const m = /^(\d{2})(\d{2})(\d{2})/.exec(value);
    if (!m) return undefined;
    const y = 2000 + Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) return undefined;
    if (day === 0) return expiry ? endOfMonth(y, month) : startOfMonth(y, month);
    return safeISODate(y, month, day) ?? undefined;
  }

  extract(context: LabelContext) {
    const d = context.details;
    context.lines.forEach((line, i) => {
      const matches = [...line.text.matchAll(Gs1Extractor.element)];
      if (matches.length < 2) return; // a lone "(10)" is not a GS1 string
      for (const m of matches) {
        if (m[1] === '17') d.expiryDate ??= Gs1Extractor.yymmdd(m[2], true);
        if (m[1] === '11') d.manufactureDate ??= Gs1Extractor.yymmdd(m[2], false);
        if (m[1] === '10') d.batchNumber ??= m[2].toUpperCase();
      }
      context.usedLines.add(i);
    });
  }
}

export class BatchExtractor extends LabelFieldExtractor {
  private static readonly batch =
    /\b(?:b\.?\s*no|batch(?:\s*(?:no|number|code))?|lot(?:\s*(?:no|number))?|b\/n|bn)\b\s*\.?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{2,24})?/i;
  private static readonly serial =
    /\b(?:s\/n|sn|serial(?:\s*(?:no|number))?|sr\.?\s*no)\b\s*\.?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,24})?/i;

  private static valid(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const v = raw.replace(/[./-]+$/, '').toUpperCase();
    if (v.length < 3 || !/\d/.test(v)) return undefined;
    if (findDates(v).length > 0 && !/[A-Z]/.test(v)) return undefined;
    return v;
  }

  extract(context: LabelContext) {
    const d = context.details;
    if (d.batchNumber) return;
    const passes: [RegExp, boolean][] = [
      [BatchExtractor.batch, false],
      [BatchExtractor.serial, true],
    ];
    for (const [pattern, serial] of passes) {
      for (let i = 0; i < context.lines.length; i++) {
        const m = pattern.exec(context.lines[i].text);
        if (!m) continue;
        let value = BatchExtractor.valid(m[1]);
        // Label and value printed on separate lines.
        if (!value && i + 1 < context.lines.length) {
          value = BatchExtractor.valid(context.lines[i + 1].text.split(' ')[0]);
          if (value) context.usedLines.add(i + 1);
        }
        if (!value) continue;
        d.batchNumber = value;
        d.isSerialNumber = serial;
        context.usedLines.add(i);
        return;
      }
    }
  }
}

export class DateExtractor extends LabelFieldExtractor {
  private static readonly expiryKey =
    /\b(?:exp(?:iry|iration|ires?|y)?(?:\s*\.?\s*(?:date|dt))?|use\s+(?:by|before)|best\s+before|valid\s+(?:till|until|upto))\b/gi;
  private static readonly mfgKey =
    /\b(?:mfg|mfd|mft|manufactured|manufacturing|manuf|dom|prod(?:uction)?|packed|pkd)(?:\s*\.?\s*(?:date|dt|on))?\b/gi;

  extract(context: LabelContext) {
    const d = context.details;
    const loose: FoundDate[] = [];
    let expiry: FoundDate | undefined;
    let made: FoundDate | undefined;

    for (let i = 0; i < context.lines.length; i++) {
      const text = context.lines[i].text;
      const keys = [
        ...[...text.matchAll(DateExtractor.expiryKey)].map((m) => ({ at: m.index ?? 0, isExpiry: true })),
        ...[...text.matchAll(DateExtractor.mfgKey)].map((m) => ({ at: m.index ?? 0, isExpiry: false })),
      ].sort((a, b) => a.at - b.at);
      const dates = findDates(text);

      if (keys.length === 0) {
        loose.push(...dates.filter((x) => x.strong));
        continue;
      }

      if (dates.length === 0) {
        // Header row ("Mfg. Date  Exp. Date") with the values underneath.
        if (i + 1 < context.lines.length) {
          const below = findDates(context.lines[i + 1].text);
          if (below.length >= keys.length) {
            keys.forEach((key, k) => {
              if (key.isExpiry) expiry ??= below[k];
              else made ??= below[k];
            });
            context.usedLines.add(i).add(i + 1);
          }
        }
        continue;
      }

      for (const date of dates) {
        const owner = [...keys].reverse().find((key) => key.at < date.start);
        if (!owner) {
          if (date.strong) loose.push(date);
        } else if (owner.isExpiry) {
          expiry ??= date;
        } else {
          made ??= date;
        }
      }
      context.usedLines.add(i);
    }

    // Unlabelled dates: the latest is the expiry, the earliest manufacture.
    if (!expiry && loose.length > 0) {
      const sorted = [...loose].sort((a, b) => compareISO(asExpiry(a), asExpiry(b)));
      expiry = sorted.at(-1);
      if (!made && sorted.length > 1 && compareISO(asManufacture(sorted[0]), asManufacture(sorted.at(-1)!)) < 0) {
        made = sorted[0];
      }
    }

    let exp = expiry ? asExpiry(expiry) : undefined;
    let mfg = made ? asManufacture(made) : undefined;
    if (exp && mfg && compareISO(mfg, exp) > 0 && expiry && made) {
      [exp, mfg] = [asExpiry(made), asManufacture(expiry)];
    }
    d.expiryDate ??= exp;
    d.manufactureDate ??= mfg;
  }
}

export class ManufacturerExtractor extends LabelFieldExtractor {
  private static readonly by =
    /\b(mfd|mfg|manufactured|mkd|marketed|distributed|made|produced|imported)\.?\s*(?:&\s*\w+\.?\s*)?(?:by|for)\b\s*[:-]?\s*(.*)/i;
  private static readonly company =
    /\b(?:ltd|limited|pvt|private|inc|llc|gmbh|plc|pharma|pharmaceuticals?|laborator(?:y|ies)|labs|healthcare|biotech|biologics|lifesciences|life\s+sciences|medical|corporation|corp|diagnostics|institute)\b\.?/i;
  private static readonly addressBreak = /,|\s+at\s+|\s+-\s+|\bplot\b|\bp\.?\s?o\.?\b|\bno\.\s*\d/i;

  private static tidy(raw: string): string | undefined {
    const head = raw.split(ManufacturerExtractor.addressBreak)[0];
    const value = clean(head, 48);
    if (!value || value.replace(/[^A-Za-z]/g, '').length < 3) return undefined;
    return smartTitleCase(value);
  }

  private static rank(verb: string) {
    const v = verb.toLowerCase();
    if (v === 'mfd' || v === 'mfg' || v === 'manufactured') return 0;
    if (v === 'mkd' || v === 'marketed' || v === 'distributed') return 1;
    return 2;
  }

  extract(context: LabelContext) {
    const d = context.details;
    if (d.manufacturer) return;

    let best: { rank: number; value: string; used: number[] } | undefined;
    context.lines.forEach((line, i) => {
      const m = ManufacturerExtractor.by.exec(line.text);
      if (!m) return;
      let value = ManufacturerExtractor.tidy(m[2]);
      const used = [i];
      if (!value && i + 1 < context.lines.length) {
        value = ManufacturerExtractor.tidy(context.lines[i + 1].text);
        used.push(i + 1);
      }
      if (!value) return;
      const rank = ManufacturerExtractor.rank(m[1]);
      if (!best || rank < best.rank) best = { rank, value, used };
    });

    if (!best) {
      for (let i = 0; i < context.lines.length; i++) {
        if (context.usedLines.has(i)) continue;
        const text = context.lines[i].text;
        if (!ManufacturerExtractor.company.test(text) || text.split(' ').length > 8) continue;
        const value = ManufacturerExtractor.tidy(text);
        if (value) {
          best = { rank: 3, value, used: [i] };
          break;
        }
      }
    }

    if (best) {
      d.manufacturer = best.value;
      best.used.forEach((i) => context.usedLines.add(i));
    }
  }
}

export class QuantityExtractor extends LabelFieldExtractor {
  static readonly units: Record<string, string> = {
    tablets: 'tablets', tablet: 'tablets', tabs: 'tablets', tab: 'tablets',
    capsules: 'capsules', capsule: 'capsules', caps: 'capsules', cap: 'capsules',
    vials: 'vials', vial: 'vials',
    ampoules: 'ampoules', ampoule: 'ampoules', ampules: 'ampoules', ampule: 'ampoules', amps: 'ampoules',
    bottles: 'bottles', bottle: 'bottles', sachets: 'sachets', sachet: 'sachets',
    strips: 'strips', strip: 'strips', pieces: 'pcs', piece: 'pcs', pcs: 'pcs',
    units: 'units', unit: 'units', kits: 'kits', kit: 'kits', tests: 'tests', test: 'tests',
    pairs: 'pairs', pair: 'pairs', gloves: 'pcs', glove: 'pcs', masks: 'pcs', mask: 'pcs',
    respirators: 'pcs', respirator: 'pcs', syringes: 'pcs', syringe: 'pcs',
    needles: 'pcs', needle: 'pcs', cannulae: 'pcs', cannulas: 'pcs', cannula: 'pcs',
    boxes: 'boxes', box: 'boxes', packs: 'packs', pack: 'packs', doses: 'doses', dose: 'doses',
    sets: 'sets', set: 'sets',
  };

  private static readonly alt = Object.keys(QuantityExtractor.units)
    .sort((a, b) => b.length - a.length)
    .join('|');

  // Priority order: "10 x 10 tablets", "Qty: 100", "pack of 30", "30 tablets", "10's".
  private static readonly multiplied = new RegExp(`\\b(\\d{1,4})\\s*[x×*]\\s*(\\d{1,4})\\s*(${QuantityExtractor.alt})\\b`, 'i');
  private static readonly labelled = new RegExp(
    `\\b(?:net\\s*(?:qty|quantity|content)|qty|quantity)\\s*[:.\\-]?\\s*(\\d{1,5})\\s*(${QuantityExtractor.alt})?\\b`,
    'i',
  );
  private static readonly packOf = new RegExp(
    `\\b(?:pack|strip|box|carton)\\s+of\\s+(\\d{1,5})\\s*(?:'?s)?\\s*(${QuantityExtractor.alt})?\\b`,
    'i',
  );
  // Not "100 units/ml" (a strength), but "10 doses / 5 ml" is a pack size.
  private static readonly counted = new RegExp(
    `\\b(\\d{1,5})\\s*(${QuantityExtractor.alt})\\b(?!\\s*/\\s*[a-zA-Z])`,
    'gi',
  );
  private static readonly apostrophe = /\b(\d{1,4})\s*['’`]s\b/i;

  /** First "<n> <unit>" in [text] that is not a per-dose strength ("each 5 ml"). */
  private static countedMatch(text: string): RegExpMatchArray | undefined {
    for (const m of text.matchAll(QuantityExtractor.counted)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 5), m.index);
      if (!/(?:each|per)\s$/i.test(before)) return m;
    }
    return undefined;
  }

  /** Whether [text] states a pack size ("10 doses", "15 Tablets"). */
  static mentionsPackSize(text: string) {
    return QuantityExtractor.countedMatch(text) !== undefined;
  }

  extract(context: LabelContext) {
    const d = context.details;
    if (d.quantity !== undefined) return;
    const unitOf = (raw: string | undefined) => (raw ? QuantityExtractor.units[raw.toLowerCase()] : undefined);

    const attempts: ((text: string) => { qty: number; unit?: string } | undefined)[] = [
      (text) => {
        const m = QuantityExtractor.multiplied.exec(text);
        return m ? { qty: Number(m[1]) * Number(m[2]), unit: unitOf(m[3]) } : undefined;
      },
      (text) => {
        const m = QuantityExtractor.labelled.exec(text);
        return m ? { qty: Number(m[1]), unit: unitOf(m[2]) } : undefined;
      },
      (text) => {
        const m = QuantityExtractor.packOf.exec(text);
        return m ? { qty: Number(m[1]), unit: unitOf(m[2]) } : undefined;
      },
      (text) => {
        const m = QuantityExtractor.countedMatch(text);
        return m ? { qty: Number(m[1]), unit: unitOf(m[2]) } : undefined;
      },
      (text) => {
        const m = QuantityExtractor.apostrophe.exec(text);
        return m ? { qty: Number(m[1]) } : undefined;
      },
    ];

    for (const attempt of attempts) {
      for (const line of context.lines) {
        const hit = attempt(line.text);
        if (!hit || hit.qty <= 0 || hit.qty > 100_000) continue;
        d.quantity = hit.qty;
        d.unit = hit.unit;
        return;
      }
    }
  }
}

export class StorageExtractor extends LabelFieldExtractor {
  private static readonly range =
    /([+-]?\d{1,2})\s*(?:°|º|˚)?\s*c?\s*(?:to|-|and|&)\s*([+-]?\d{1,2})\s*(?:°|º|˚)?\s*c\b/i;
  private static readonly below =
    /\b(?:below|under|not\s+(?:exceeding|above|more\s+than)|at\s+or\s+below|up\s+to)\s*([+-]?\d{1,2})\s*(?:°|º|˚)?\s*c\b/i;
  private static readonly controlled =
    /\b(?:schedule\s*x|narcotic|psychotropic|ndps|controlled\s+(?:drug|substance))\b/;
  private static readonly noFreeze = /\b(?:do\s+not|don't|never)\s+freeze|from\s+freezing/;

  private static forMax(high: number, low?: number): StorageCondition {
    if (high <= -10) return 'frozen';
    if (high <= 8 && (low ?? 0) >= 0) return 'refrigerated';
    if (high <= 15) return 'cool';
    return 'roomTemperature';
  }

  extract(context: LabelContext) {
    const d = context.details;
    if (d.storage) return;
    const text = context.lowerText;

    if (StorageExtractor.controlled.test(text)) {
      d.storage = 'controlled';
      return;
    }
    const range = StorageExtractor.range.exec(text);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      d.storage = StorageExtractor.forMax(Math.max(a, b), Math.min(a, b));
      return;
    }
    const below = StorageExtractor.below.exec(text);
    if (below) {
      d.storage = StorageExtractor.forMax(Number(below[1]));
      return;
    }
    if (/refrigerat|\bfridge\b|cold\s+chain/.test(text)) {
      d.storage = 'refrigerated';
    } else if (/\bfrozen\b|\bfreezer\b|deep\s+freeze/.test(text) && !StorageExtractor.noFreeze.test(text)) {
      d.storage = 'frozen';
    } else if (/\bcool\s+(?:and\s+dry\s+|dry\s+)?place\b/.test(text)) {
      d.storage = 'cool';
    } else if (text.includes('room temperature')) {
      d.storage = 'roomTemperature';
    }
  }
}

/** Copies storage / handling instructions into the notes field. */
export class HandlingNotesExtractor extends LabelFieldExtractor {
  private static readonly instruction =
    /\b(?:store|storage|protect|refrigerat\w*|do\s+not\s+(?:freeze|shake|refrigerate|use)|keep\s+(?:in|away|dry|cool|refrigerated))\b/i;

  extract(context: LabelContext) {
    const d = context.details;
    if (d.notes) return;
    const picked: string[] = [];
    for (let i = 0; i < context.lines.length && picked.length < 2; i++) {
      const text = context.lines[i].text;
      if (!HandlingNotesExtractor.instruction.test(text) || /children|reach/i.test(text)) continue;
      picked.push(text.endsWith('.') ? text : `${text}.`);
      context.usedLines.add(i);
    }
    if (picked.length > 0) d.notes = clean(picked.join(' '), 200);
  }
}

export class CategoryExtractor extends LabelFieldExtractor {
  private static readonly signals: [AssetCategory, [RegExp, number][]][] = [
    ['vaccine', [[/\bvaccin/, 4], [/\btoxoid\b/, 4], [/\bimmuni[sz]ation\b/, 2]]],
    [
      'bloodProduct',
      [
        [/\bplasma\b/, 3], [/\bplatelets?\b/, 3], [/\bwhole\s+blood\b/, 4],
        [/\b(?:p?rbc|red\s+(?:blood\s+)?cells)\b/, 4], [/\bcryoprecipitate\b/, 4],
        [/\bblood\s+(?:bag|unit|component)/, 3],
      ],
    ],
    [
      'reagent',
      [
        [/\breagents?\b/, 4], [/\btest\s+kit\b/, 3], [/\bkit\b/, 1.5], [/\bassay\b/, 2],
        [/\b(?:ivd|in\s+vitro)\b/, 3], [/\bantisera|antiserum\b/, 4], [/\bcalibrator\b/, 2],
        [/\blaboratory\s+use\b/, 2], [/\brapid\s+test\b/, 2],
      ],
    ],
    [
      'ppe',
      [
        [/\bgloves?\b/, 4], [/\b(?:masks?|respirators?)\b/, 4], [/\b(?:k?n95|ffp[23])\b/, 4],
        [/\b(?:gown|coverall|apron|face\s+shield|shoe\s+covers?)\b/, 3], [/\bnitrile\b/, 2],
      ],
    ],
    [
      'consumable',
      [
        [/\bsyringes?\b/, 4], [/\bneedles?\b/, 2], [/\bcannula/, 4], [/\bcatheter/, 4],
        [/\b(?:gauze|bandage|suture)s?\b/, 4], [/\bdressing/, 2], [/\b(?:iv|infusion)\s+set\b/, 4],
        [/\bswabs?\b/, 2], [/\bdisposable\b/, 0.5],
      ],
    ],
    [
      'equipment',
      [
        [/\b(?:monitor|oximeter|thermometer|glucometer|nebuli[sz]er|sphygmomanometer)\b/, 4],
        [/\b(?:defibrillator|aed|infusion\s+pump|ventilator)\b/, 4], [/\bmodel\b/, 1],
        [/\b(?:rated\s+voltage|battery|v\s?~|hz)\b/, 1.5],
      ],
    ],
    [
      'medicine',
      [
        [/\b(?:tablets?|capsules?|syrup|ointment|inhaler)\b/, 4], [/\binjection\b/, 2],
        [/\b(?:suspension|cream|drops|lotion)\b/, 2.5], [/\d\s*(?:mg|mcg)\b/, 1.5],
        [/\b(?:i\.?p|b\.?p|u\.?s\.?p)\b\.?/, 1.5], [/\b(?:each|every)\s+\w+\s+contains\b/, 2],
        [/\bschedule\s+h\b/, 2], [/\binsulin\b/, 4], [/\brx\b/, 1],
      ],
    ],
  ];

  extract(context: LabelContext) {
    const d = context.details;
    if (d.category) return;
    let best: AssetCategory | undefined;
    let bestScore = 0;
    for (const [category, signals] of CategoryExtractor.signals) {
      let score = signals.reduce((sum, [pattern, weight]) => sum + (pattern.test(context.lowerText) ? weight : 0), 0);
      if (category === 'equipment' && d.isSerialNumber) score += 3;
      if (score > bestScore) {
        best = category;
        bestScore = score;
      }
    }
    if (bestScore >= 2) d.category = best;
  }
}

/**
 * Picks the product name: the most prominent line that looks like a name,
 * joined with the strength/form line beneath it when the name lacks one.
 */
export class ProductNameExtractor extends LabelFieldExtractor {
  private static readonly notAName =
    /\b(?:each|contains?|composition|dosage|directions?|warnings?|caution|keep|store|storage|protect|schedule|mrp|price|rs\.?|incl|taxes|manufactured|marketed|mfd|mfg|exp|expiry|batch|lot|b\.?\s*no|lic|licen[cs]e|address|plot|road|dist|tel|phone|e-?mail|www|http|made\s+in|net\s+(?:qty|content)|qty|prescription|leaflet|insert|gtin|for\s+(?:oral|external|intramuscular|intravenous|subcutaneous)\s+use)\b/i;
  private static readonly strength = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ml|iu|units?|g)\b|\d+(?:\.\d+)?\s*%/i;
  private static readonly form =
    /\b(?:tablets?|capsules?|injection|infusion|syrup|suspension|solution|vaccine|cream|ointment|gel|drops|inhaler|kit|reagents?|antisera|gloves?|masks?|respirators?|syringes?|cannula|catheter|gauze|bandage|monitor|oximeter|thermometer|plasma|platelets?|toxoid)\b/i;

  private candidate(context: LabelContext, i: number) {
    if (context.usedLines.has(i)) return false;
    const text = context.lines[i].text;
    const letters = text.replace(/[^A-Za-z]/g, '').length;
    return letters >= 3 && letters >= text.length * 0.45 && !ProductNameExtractor.notAName.test(text);
  }

  extract(context: LabelContext) {
    const d = context.details;
    if (d.name) return;
    const { lines } = context;
    const maxHeight = Math.max(0, ...lines.map((l) => l.height));

    let bestIndex: number | undefined;
    let bestScore = -Infinity;
    lines.forEach((line, i) => {
      if (!this.candidate(context, i)) return;
      const text = line.text;
      let score = 0;
      if (maxHeight > 0) score += (10 * line.height) / maxHeight;
      if (ProductNameExtractor.strength.test(text)) score += 3;
      if (ProductNameExtractor.form.test(text)) score += 3;
      if (i < 3) score += 1.5 - i * 0.5;
      if (text.length > 48) score -= 4;
      if (text === text.toLowerCase()) score -= 1;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });
    if (bestIndex === undefined) return;

    // Foil strips print the name over and over, and OCR can join the repeats into one line.
    let name = smartTitleCase(lines[bestIndex].text.replace(/^(.{4,}?)(?:\s+\1)+.*$/i, '$1'));
    const next = bestIndex + 1;
    if (
      !ProductNameExtractor.strength.test(name) &&
      next < lines.length &&
      this.candidate(context, next) &&
      lines[next].text.length <= 32 &&
      !QuantityExtractor.mentionsPackSize(lines[next].text) &&
      (ProductNameExtractor.strength.test(lines[next].text) || ProductNameExtractor.form.test(lines[next].text))
    ) {
      name = `${name} ${smartTitleCase(lines[next].text)}`;
      context.usedLines.add(next);
    }
    context.usedLines.add(bestIndex);
    d.name = clean(name);
  }
}

export const DEFAULT_CHAIN: readonly LabelFieldExtractor[] = [
  new Gs1Extractor(),
  new BatchExtractor(),
  new DateExtractor(),
  new ManufacturerExtractor(),
  new QuantityExtractor(),
  new StorageExtractor(),
  new HandlingNotesExtractor(),
  new CategoryExtractor(),
  new ProductNameExtractor(),
];

/** Turns OCR text from a wrapper, carton or vial label into asset details. */
export class LabelParser {
  constructor(private readonly extractors: readonly LabelFieldExtractor[] = DEFAULT_CHAIN) {}

  parse(scan: LabelScan): LabelDetails {
    const source = scan.lines.length > 0 ? scan.lines : scanFromText(scan.text).lines;
    const lines = source
      .map((line) => ({ text: normalize(line.text), height: line.height }))
      .filter((line) => line.text.length > 0);
    const context = new LabelContext(lines);
    for (const extractor of this.extractors) extractor.extract(context);
    return context.details;
  }
}
