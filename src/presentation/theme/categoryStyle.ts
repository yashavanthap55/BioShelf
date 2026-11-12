import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

import type { ActivityType, AssetCategory, ExpiryStatus, StorageCondition } from '@/domain/entities';
import type { Scheme } from './tokens';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Presentation-only styling for domain values, kept out of the domain layer. */
export const CATEGORY_ICON: Record<AssetCategory, IconName> = {
  medicine: 'medication',
  vaccine: 'vaccines',
  bloodProduct: 'bloodtype',
  reagent: 'science',
  consumable: 'healing',
  ppe: 'masks',
  equipment: 'monitor-heart',
};

/** Muted, desaturated hues so categories read as a calm family. */
const CATEGORY_COLORS: Record<AssetCategory, [dark: string, light: string]> = {
  medicine: ['#9CC3B6', '#3F6E61'],
  vaccine: ['#9DB4CF', '#41607F'],
  bloodProduct: ['#D39A97', '#8E3F42'],
  reagent: ['#B4A9CF', '#5E517F'],
  consumable: ['#A9B1C2', '#515B6E'],
  ppe: ['#B7BF98', '#5B6338'],
  equipment: ['#D4BC94', '#7C6237'],
};

export const categoryColor = (category: AssetCategory, scheme: Scheme) =>
  CATEGORY_COLORS[category][scheme === 'dark' ? 0 : 1];

export const STATUS_ICON: Record<ExpiryStatus, IconName> = {
  expired: 'block',
  critical: 'priority-high',
  warning: 'schedule',
  safe: 'verified',
};

export const STORAGE_ICON: Record<StorageCondition, IconName> = {
  roomTemperature: 'thermostat',
  cool: 'air',
  refrigerated: 'kitchen',
  frozen: 'ac-unit',
  controlled: 'lock',
};

export const ACTIVITY_ICON: Record<ActivityType, IconName> = {
  added: 'add-circle-outline',
  updated: 'edit-note',
  deleted: 'delete-outline',
  disposed: 'recycling',
  restocked: 'trending-up',
  consumed: 'trending-down',
  reverted: 'undo',
  system: 'auto-awesome',
};
