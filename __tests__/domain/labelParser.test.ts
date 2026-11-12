import { detectedFields, LabelParser, scanFromText, smartTitleCase } from '../../src/domain/labelParser';

const parse = (text: string) => new LabelParser().parse(scanFromText(text));

describe('LabelParser', () => {
  it('reads an Indian tablet strip', () => {
    const d = parse(`
Rx
PARACETAMOL TABLETS IP 500 mg
Each uncoated tablet contains: Paracetamol IP 500 mg
10 x 10 Tablets
B.No. PCM2301
Mfg. Date: 01/2025
Exp. Date: 12/2027
Store below 30°C. Protect from light and moisture.
Keep out of reach of children.
Mfd. by: Medivance Labs Pvt. Ltd., Plot 12, Bengaluru 560100
M.R.P. Rs. 25.00 (Incl. of all taxes)
`);
    expect(d).toMatchObject({
      name: 'Paracetamol Tablets IP 500 mg',
      batchNumber: 'PCM2301',
      manufactureDate: '2025-01-01',
      expiryDate: '2027-12-31',
      manufacturer: 'Medivance Labs Pvt. Ltd.',
      quantity: 100,
      unit: 'tablets',
      category: 'medicine',
      storage: 'roomTemperature',
      notes: 'Store below 30°C. Protect from light and moisture.',
    });
  });

  it('reads one name from a foil strip that repeats it', () => {
    const d = parse(`
METFORMIN HCI 500 mg METFORMIN HCI 500 mg METFORMIN
B.No. MF2209 Mfg. 11/2024 Exp. 10/2026
`);
    expect(d).toMatchObject({
      name: 'Metformin HCI 500 mg',
      batchNumber: 'MF2209',
      manufactureDate: '2024-11-01',
      expiryDate: '2026-10-31',
    });
  });

  it('keeps names that only look repetitive', () => {
    expect(parse('Vitamin B Vitamin C Tablets').name).toBe('Vitamin B Vitamin C Tablets');
  });

  it('reads a cold-chain vaccine vial with named months', () => {
    const d = parse(`
Hepatitis B Vaccine (rDNA) I.P.
10 doses / 5 ml multi-dose vial
Lot No: HBV-7741
MFD: MAR 2025   EXP: FEB 2027
Store at +2°C to +8°C. Do not freeze.
Manufactured by ImmunoGen Biotech Ltd, Pune
`);
    expect(d).toMatchObject({
      name: 'Hepatitis B Vaccine (rDNA) I.P.',
      batchNumber: 'HBV-7741',
      manufactureDate: '2025-03-01',
      expiryDate: '2027-02-28',
      manufacturer: 'ImmunoGen Biotech Ltd',
      quantity: 10,
      unit: 'doses',
      category: 'vaccine',
      storage: 'refrigerated',
    });
  });

  it('reads a reagent kit with an ISO date and unlabelled maker', () => {
    const d = parse(`
HbA1c Reagent Kit
For in vitro diagnostic use
LOT 2290A   2026-05-31
Helix Diagnostics Pvt Ltd
Store at 2-8 °C
50 tests
`);
    expect(d).toMatchObject({
      name: 'HbA1c Reagent Kit',
      batchNumber: '2290A',
      expiryDate: '2026-05-31',
      manufacturer: 'Helix Diagnostics Pvt Ltd',
      quantity: 50,
      unit: 'tests',
      category: 'reagent',
      storage: 'refrigerated',
    });
  });

  it('tolerates OCR noise in dates on a PPE carton', () => {
    const d = parse(`
NITRILE EXAMINATION GLOVES
Powder free · Size M
100 Gloves
LOT: GLV66 20
MFG 1O/2O25
EXP 1O/2O3O
ShieldWear Healthcare
`);
    expect(d).toMatchObject({
      name: 'Nitrile Examination Gloves',
      batchNumber: 'GLV66',
      manufactureDate: '2025-10-01',
      expiryDate: '2030-10-31',
      quantity: 100,
      unit: 'pcs',
      category: 'ppe',
      manufacturer: 'ShieldWear Healthcare',
    });
  });

  it('reads GS1 element strings under a DataMatrix code', () => {
    const d = parse(`
Ceftriaxone for Injection USP 1 g
(01)08901234567890(17)270600(10)CFX23388(11)250115
`);
    expect(d).toMatchObject({
      batchNumber: 'CFX23388',
      expiryDate: '2027-06-30',
      manufactureDate: '2025-01-15',
      name: 'Ceftriaxone for Injection USP 1 g',
      category: 'medicine',
    });
  });

  it('pairs a header row with the values beneath it', () => {
    const d = parse(`
Amoxicillin Capsules IP 500 mg
Batch No.   Mfg. Date   Exp. Date
AMX24117   08/2025   07/2027
`);
    expect(d.manufactureDate).toBe('2025-08-01');
    expect(d.expiryDate).toBe('2027-07-31');
  });

  it('treats serial numbers as equipment', () => {
    const d = parse(`
VitalSense Pulse Oximeter
Model PX-200
S/N: POX70014
Rated voltage 3V DC (2 x AAA battery)
`);
    expect(d.batchNumber).toBe('POX70014');
    expect(d.isSerialNumber).toBe(true);
    expect(d.category).toBe('equipment');
    expect(detectedFields(d)).toContain('Serial no.');
  });

  it('prefers larger OCR text for the product name', () => {
    const d = new LabelParser().parse({
      text: '',
      lines: [
        { text: 'Medivance Labs', height: 14 },
        { text: 'CROCIN', height: 60 },
        { text: 'Paracetamol 500 mg', height: 22 },
        { text: '15 Tablets', height: 12 },
      ],
    });
    expect(d.name).toBe('Crocin Paracetamol 500 mg');
  });

  it('detects controlled substances and day-first dates', () => {
    const d = parse('Morphine Sulfate Injection IP 10 mg/ml\nSchedule X drug - Narcotic\nEXP 31/03/2028');
    expect(d.storage).toBe('controlled');
    expect(d.expiryDate).toBe('2028-03-31');
  });

  it('does not mistake temperature ranges for dates', () => {
    const d = parse('Glucose Oxidase Reagent\nStore at 8-15°C in a cool place');
    expect(d.expiryDate).toBeUndefined();
    expect(d.storage).toBe('cool');
  });

  it('returns nothing for blank or unreadable text', () => {
    expect(detectedFields(parse(''))).toEqual([]);
    expect(detectedFields(parse('|||  ...  ~~'))).toEqual([]);
  });

  it('title-cases shouting while keeping codes', () => {
    expect(smartTitleCase('PARACETAMOL TABLETS IP 500 MG')).toBe('Paracetamol Tablets IP 500 MG');
    expect(smartTitleCase('N95 RESPIRATORS')).toBe('N95 Respirators');
    expect(smartTitleCase('Already Mixed Case')).toBe('Already Mixed Case');
  });
});
