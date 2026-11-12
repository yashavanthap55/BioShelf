import type { ExpiryStatus, StockStatus } from '@/domain/entities';

export type Scheme = 'dark' | 'light';

/**
 * Design tokens for the glass design system. Deliberately restrained: one
 * metallic accent, muted jewel-tone status colours, hairline borders and no
 * coloured glows.
 */
export interface GlassTokens {
  readonly scheme: Scheme;
  readonly backgroundTop: string;
  readonly backgroundBottom: string;
  /** Soft light blooms drifting behind the glass. */
  readonly orbs: readonly { color: string; opacity: number }[];
  readonly grainOpacity: number;
  readonly glassFill: string;
  readonly glassFillStrong: string;
  readonly borderHighlight: string;
  readonly borderFaint: string;
  readonly blurTint: 'dark' | 'light';
  readonly blurIntensity: number;
  readonly shadow: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  /** Metallic highlight: selection, focus, links and key figures. */
  readonly accent: string;
  /** Fill of primary buttons (champagne on dark, ink on light). */
  readonly buttonColors: readonly [string, string];
  readonly onButton: string;
  readonly expired: string;
  readonly critical: string;
  readonly warning: string;
  readonly safe: string;
  readonly lowStock: string;
  readonly scrim: string;
  readonly surface: string;
}

/** "Midnight Champagne": ink-black glass with a champagne-gold accent. */
export const DARK: GlassTokens = {
  scheme: 'dark',
  backgroundTop: '#0B0D11',
  backgroundBottom: '#111419',
  orbs: [
    { color: '#C8A97E', opacity: 0.15 },
    { color: '#3A4A66', opacity: 0.3 },
    { color: '#304A4C', opacity: 0.25 },
    { color: '#5A3E44', opacity: 0.18 },
  ],
  grainOpacity: 0.28,
  glassFill: 'rgba(255,255,255,0.045)',
  glassFillStrong: 'rgba(255,255,255,0.08)',
  borderHighlight: 'rgba(255,255,255,0.18)',
  borderFaint: 'rgba(255,255,255,0.05)',
  blurTint: 'dark',
  blurIntensity: 40,
  shadow: 'rgba(0,0,0,0.45)',
  textPrimary: '#F3EFE7',
  textSecondary: '#A9A397',
  textMuted: '#706B62',
  accent: '#D4B98A',
  buttonColors: ['#E6D3AE', '#C0A070'],
  onButton: '#16120C',
  expired: '#CF6B70',
  critical: '#D8875A',
  warning: '#D9AC5E',
  safe: '#88B59E',
  lowStock: '#A99DC8',
  scrim: 'rgba(5,6,8,0.72)',
  surface: '#15171C',
};

/** "Porcelain": warm ivory glass, ink type and a bronze accent. */
export const LIGHT: GlassTokens = {
  scheme: 'light',
  backgroundTop: '#F7F4EF',
  backgroundBottom: '#ECE7DF',
  orbs: [
    { color: '#E8D5B2', opacity: 0.55 },
    { color: '#CFDCE6', opacity: 0.4 },
    { color: '#D9E3DA', opacity: 0.35 },
    { color: '#EBD1CB', opacity: 0.3 },
  ],
  grainOpacity: 0.32,
  glassFill: 'rgba(255,255,255,0.55)',
  glassFillStrong: 'rgba(255,255,255,0.78)',
  borderHighlight: 'rgba(255,255,255,0.95)',
  borderFaint: 'rgba(28,26,23,0.08)',
  blurTint: 'light',
  blurIntensity: 35,
  shadow: 'rgba(58,47,31,0.14)',
  textPrimary: '#1B1915',
  textSecondary: '#5C564D',
  textMuted: '#958D81',
  accent: '#8F6E40',
  buttonColors: ['#2E2B26', '#151311'],
  onButton: '#F7F4EF',
  expired: '#B4464F',
  critical: '#B5622F',
  warning: '#9E7421',
  safe: '#3D7A5F',
  lowStock: '#6A5C98',
  scrim: 'rgba(27,25,21,0.32)',
  surface: '#FBF9F5',
};

export const statusColor = (t: GlassTokens, status: ExpiryStatus) => t[status === 'warning' ? 'warning' : status];

export const stockColor = (t: GlassTokens, status: StockStatus) =>
  status === 'outOfStock' ? t.expired : status === 'low' ? t.lowStock : t.safe;

/** Colour with an alpha channel, from a #RRGGBB hex. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
