import type { LabelDetails } from '../../src/domain/labelParser';
import { formReducer, initialFormState, type FormState } from '../../src/presentation/screens/form/formState';

const label = (details: Partial<LabelDetails>): LabelDetails => ({ isSerialNumber: false, ...details });

const paracetamol = label({
  name: 'Paracetamol 500 mg',
  batchNumber: 'PCM2301',
  expiryDate: '2027-12-31',
  category: 'medicine',
  storage: 'cool',
});
const vaccine = label({ name: 'Hepatitis B Vaccine', category: 'vaccine', storage: 'refrigerated' });

const scan = (state: FormState, details: LabelDetails) => formReducer(state, { type: 'applyScan', details });
const newPhoto = (state: FormState) => formReducer(state, { type: 'photo', photo: { uri: 'file:///new.jpg' } });

describe('scanning a second label photo', () => {
  it('replaces what the first photo filled in', () => {
    const state = scan(newPhoto(scan(initialFormState(), paracetamol)), vaccine);
    expect(state.fields.name).toBe('Hepatitis B Vaccine');
    expect(state.category).toBe('vaccine');
    expect(state.storage).toBe('refrigerated');
  });

  it('does not leave the first label’s details behind', () => {
    const state = scan(newPhoto(scan(initialFormState(), paracetamol)), vaccine);
    expect(state.fields.batch).toBe('');
    expect(state.expiry).toBeNull();
  });

  it('clears the old details even when the new photo cannot be read', () => {
    const state = newPhoto(scan(initialFormState(), paracetamol));
    expect(state.fields.name).toBe('');
    expect(state.autoFilled).toEqual([]);
  });

  it('keeps what the user typed', () => {
    let state = scan(initialFormState(), paracetamol);
    state = formReducer(state, { type: 'field', key: 'name', value: 'My own name' });
    state = formReducer(state, { type: 'field', key: 'location', value: 'Fridge 2' });
    state = scan(newPhoto(state), vaccine);
    expect(state.fields.name).toBe('My own name');
    expect(state.fields.location).toBe('Fridge 2');
    expect(state.fields.batch).toBe('');
  });

  it('never overwrites values already on the form before scanning', () => {
    const typed = formReducer(initialFormState(), { type: 'field', key: 'name', value: 'Saved name' });
    expect(scan(typed, vaccine).fields.name).toBe('Saved name');
  });

  it('undoes back to the form as it was before any scan', () => {
    const state = formReducer(scan(newPhoto(scan(initialFormState(), paracetamol)), vaccine), { type: 'undoAutoFill' });
    expect(state.fields.name).toBe('');
    expect(state.category).toBe(initialFormState().category);
  });
});

describe('reading the same photo again', () => {
  it('gives the same result and keeps the auto-fill marks', () => {
    const once = scan(initialFormState(), paracetamol);
    const twice = scan(once, paracetamol);
    expect(twice.fields).toEqual(once.fields);
    expect(twice.autoFilled).toEqual(once.autoFilled);
    expect(twice.beforeAutoFill).not.toBeNull();
  });
});
