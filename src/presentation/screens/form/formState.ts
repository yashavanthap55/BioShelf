import { generateId } from '@/core/id';
import { compareISO, type ISODate } from '@/domain/dates';
import {
  dateLabelFor,
  isColdChain,
  tracksServiceDate,
  type AssetCategory,
  type MedicalAsset,
  type StorageCondition,
} from '@/domain/entities';
import { detectedFields, type LabelDetails } from '@/domain/labelParser';
import type { PickedImage } from '@/domain/media';

export type FieldKey = 'name' | 'maker' | 'batch' | 'quantity' | 'unit' | 'reorder' | 'location' | 'notes';
export type AutoFillKey = FieldKey | 'category' | 'storage' | 'manufactured' | 'expiry';
export type ScanStatus = 'idle' | 'reading' | 'done' | 'failed' | 'unsupported';

interface Snapshot {
  readonly fields: Readonly<Record<FieldKey, string>>;
  readonly category: AssetCategory;
  readonly storage: StorageCondition;
  readonly manufactured: ISODate | null;
  readonly expiry: ISODate | null;
}

export interface FormState extends Snapshot {
  readonly touched: { readonly category: boolean; readonly storage: boolean };
  /** Fields whose value came from the label photo (shown with a marker). */
  readonly autoFilled: readonly AutoFillKey[];
  /** State before the last auto-fill, so it can be undone. */
  readonly beforeAutoFill: Snapshot | null;
  readonly scan: { readonly status: ScanStatus; readonly message?: string };
  readonly errors: Partial<Record<FieldKey | 'expiry', string>>;
  /** Photo picked in this session (not stored yet). */
  readonly photo: PickedImage | null;
  /** Previously stored photo, when editing. */
  readonly photoRef: string | null;
  readonly dirty: boolean;
  readonly saved: boolean;
}

export type FormAction =
  | { type: 'field'; key: FieldKey; value: string }
  | { type: 'category'; value: AssetCategory }
  | { type: 'storage'; value: StorageCondition }
  | { type: 'date'; which: 'manufactured' | 'expiry'; value: ISODate | null }
  | { type: 'photo'; photo: PickedImage }
  | { type: 'removePhoto' }
  | { type: 'scan'; status: ScanStatus; message?: string }
  | { type: 'applyScan'; details: LabelDetails }
  | { type: 'undoAutoFill' }
  | { type: 'errors'; errors: FormState['errors'] }
  | { type: 'saved' };

export function initialFormState(existing?: MedicalAsset): FormState {
  return {
    fields: {
      name: existing?.name ?? '',
      maker: existing?.manufacturer ?? '',
      batch: existing?.batchNumber ?? '',
      quantity: existing ? String(existing.quantity) : '',
      unit: existing?.unit ?? '',
      reorder: existing ? String(existing.reorderLevel) : '',
      location: existing?.location ?? '',
      notes: existing?.notes ?? '',
    },
    category: existing?.category ?? 'medicine',
    storage: existing?.storage ?? 'roomTemperature',
    manufactured: existing?.manufactureDate ?? null,
    expiry: existing?.expiryDate ?? null,
    touched: { category: !!existing, storage: !!existing },
    autoFilled: [],
    beforeAutoFill: null,
    scan: { status: 'idle' },
    errors: {},
    photo: null,
    photoRef: existing?.imageRef ?? null,
    dirty: false,
    saved: false,
  };
}

const without = (list: readonly AutoFillKey[], key: AutoFillKey) => list.filter((k) => k !== key);

const snapshotOf = (s: FormState): Snapshot => ({
  fields: s.fields,
  category: s.category,
  storage: s.storage,
  manufactured: s.manufactured,
  expiry: s.expiry,
});

/**
 * Takes back what the last scan filled in, because those values describe a
 * photo that is being replaced. Anything the user has edited since stays.
 */
function withoutAutoFill(state: FormState): FormState {
  const before = state.beforeAutoFill;
  if (!before) return state;
  const scanned = (key: AutoFillKey) => state.autoFilled.includes(key);
  const fields = { ...state.fields };
  for (const key of Object.keys(fields) as FieldKey[]) {
    if (scanned(key)) fields[key] = before.fields[key];
  }
  return {
    ...state,
    fields,
    category: scanned('category') ? before.category : state.category,
    storage: scanned('storage') ? before.storage : state.storage,
    manufactured: scanned('manufactured') ? before.manufactured : state.manufactured,
    expiry: scanned('expiry') ? before.expiry : state.expiry,
    autoFilled: [],
    beforeAutoFill: null,
  };
}

/** Applies label details to fields the user hasn't filled or chosen. */
function applyScan(previous: FormState, d: LabelDetails): FormState {
  const state = withoutAutoFill(previous);
  const fields = { ...state.fields };
  const filled: AutoFillKey[] = [];
  const fill = (key: FieldKey, value: string | undefined) => {
    if (value && !fields[key].trim()) {
      fields[key] = value;
      filled.push(key);
    }
  };
  fill('name', d.name);
  fill('maker', d.manufacturer);
  fill('batch', d.batchNumber);
  fill('quantity', d.quantity === undefined ? undefined : String(d.quantity));
  fill('unit', d.unit);
  fill('notes', d.notes);

  let { category, storage, manufactured, expiry } = state;
  if (d.category && !state.touched.category && d.category !== category) {
    category = d.category;
    filled.push('category');
  }
  if (d.storage && !state.touched.storage && d.storage !== storage) {
    storage = d.storage;
    filled.push('storage');
  }
  if (d.expiryDate && !expiry) {
    expiry = d.expiryDate;
    filled.push('expiry');
  }
  if (d.manufactureDate && !manufactured) {
    manufactured = d.manufactureDate;
    filled.push('manufactured');
  }

  const found = detectedFields(d).length;
  const message =
    found === 0
      ? 'No label text recognised. Try a closer, well-lit photo.'
      : filled.length === 0
        ? 'Label read. Your entries were kept.'
        : `Filled ${filled.length} detail${filled.length === 1 ? '' : 's'} from the label. Check the marked fields before saving.`;

  return {
    ...state,
    fields,
    category,
    storage,
    manufactured,
    expiry,
    autoFilled: filled,
    beforeAutoFill: filled.length > 0 ? snapshotOf(state) : null,
    scan: { status: found === 0 ? 'failed' : 'done', message },
    errors: {},
    dirty: true,
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'field':
      return {
        ...state,
        fields: { ...state.fields, [action.key]: action.value },
        autoFilled: without(state.autoFilled, action.key),
        errors: { ...state.errors, [action.key]: undefined },
        dirty: true,
      };
    case 'category': {
      // Cold-chain categories default to refrigerated storage.
      const coldDefault =
        (action.value === 'vaccine' || action.value === 'bloodProduct') && !isColdChain(state.storage) && !state.touched.storage;
      return {
        ...state,
        category: action.value,
        storage: coldDefault ? 'refrigerated' : state.storage,
        touched: { ...state.touched, category: true },
        autoFilled: without(state.autoFilled, 'category'),
        dirty: true,
      };
    }
    case 'storage':
      return {
        ...state,
        storage: action.value,
        touched: { ...state.touched, storage: true },
        autoFilled: without(state.autoFilled, 'storage'),
        dirty: true,
      };
    case 'date':
      return {
        ...state,
        [action.which]: action.value,
        autoFilled: without(state.autoFilled, action.which),
        errors: { ...state.errors, expiry: undefined },
        dirty: true,
      };
    case 'photo':
      return { ...withoutAutoFill(state), photo: action.photo, scan: { status: 'idle' }, dirty: true };
    case 'removePhoto':
      return { ...state, photo: null, photoRef: null, scan: { status: 'idle' }, dirty: true };
    case 'scan':
      return { ...state, scan: { status: action.status, message: action.message } };
    case 'applyScan':
      return applyScan(state, action.details);
    case 'undoAutoFill':
      return state.beforeAutoFill
        ? {
            ...state,
            ...state.beforeAutoFill,
            autoFilled: [],
            beforeAutoFill: null,
            scan: { status: 'done', message: 'Auto-fill undone.' },
          }
        : state;
    case 'errors':
      return { ...state, errors: action.errors };
    case 'saved':
      return { ...state, dirty: false, saved: true };
  }
}

const wholeNumber = (value: string) => {
  const v = value.trim();
  if (!v) return 'Required';
  return /^\d+$/.test(v) ? undefined : 'Enter 0 or more';
};

export function validateForm(s: FormState): FormState['errors'] {
  const required = (value: string) => (value.trim() ? undefined : 'Required');
  const errors: FormState['errors'] = {
    name: required(s.fields.name),
    maker: required(s.fields.maker),
    batch: required(s.fields.batch),
    quantity: wholeNumber(s.fields.quantity),
    unit: required(s.fields.unit),
    reorder: wholeNumber(s.fields.reorder),
    location: required(s.fields.location),
  };
  if (!s.expiry) {
    errors.expiry = `Choose the ${dateLabelFor(s.category).toLowerCase()}`;
  } else if (s.manufactured && compareISO(s.manufactured, s.expiry) >= 0) {
    errors.expiry = `Must be later than the ${tracksServiceDate(s.category) ? 'last service' : 'manufacture'} date`;
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as FormState['errors'];
}

export function buildAsset(s: FormState, existing: MedicalAsset | undefined, now: number, imageRef: string | null): MedicalAsset {
  return {
    id: existing?.id ?? generateId(),
    name: s.fields.name.trim(),
    category: s.category,
    batchNumber: s.fields.batch.trim(),
    manufacturer: s.fields.maker.trim(),
    quantity: Number(s.fields.quantity.trim()),
    unit: s.fields.unit.trim(),
    reorderLevel: Number(s.fields.reorder.trim()),
    location: s.fields.location.trim(),
    storage: s.storage,
    manufactureDate: s.manufactured,
    expiryDate: s.expiry as ISODate,
    notes: s.fields.notes.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: existing?.updatedAt ?? now,
    imageRef,
  };
}
