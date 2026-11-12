/**
 * Calendar dates are kept as `YYYY-MM-DD` strings. They have no time zone, so
 * an expiry date never shifts by a day when the device's zone changes.
 */
export type ISODate = string;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function isoFromParts(year: number, month: number, day: number): ISODate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The local calendar date of [date]. */
export function toISODate(date: Date): ISODate {
  return isoFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

/** Builds a valid date or returns null (e.g. 31 February). */
export function safeISODate(year: number, month: number, day: number): ISODate | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 ? isoFromParts(year, month, day) : null;
}

const utc = (value: ISODate) => {
  const { year, month, day } = parseISODate(value);
  return Date.UTC(year, month - 1, day);
};

/** Whole calendar days from [from] to [to] (negative when [to] is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = new Date(utc(value) + days * 86_400_000);
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function endOfMonth(year: number, month: number): ISODate {
  const date = new Date(Date.UTC(year, month, 0));
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function startOfMonth(year: number, month: number): ISODate {
  return isoFromParts(year, month, 1);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
