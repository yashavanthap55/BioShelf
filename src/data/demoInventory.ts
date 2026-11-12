import { addDays, toISODate, type ISODate } from '../domain/dates';
import type { AssetCategory, MedicalAsset, StorageCondition } from '../domain/entities';

interface Spec {
  name: string;
  category: AssetCategory;
  batch: string;
  maker: string;
  qty: number;
  unit: string;
  reorder: number;
  location: string;
  storage: StorageCondition;
  /** Days relative to today. */
  made: number;
  expires: number;
  notes?: string;
}

const SPECS: readonly Spec[] = [
  { name: 'Amoxicillin 500 mg Capsules', category: 'medicine', batch: 'AMX-24117', maker: 'Nova Pharma', qty: 340, unit: 'capsules', reorder: 120, location: 'Pharmacy · Rack A2', storage: 'roomTemperature', made: -650, expires: 75 },
  { name: 'Paracetamol 650 mg Tablets', category: 'medicine', batch: 'PCM-25031', maker: 'Medivance Labs', qty: 1200, unit: 'tablets', reorder: 400, location: 'Pharmacy · Rack A1', storage: 'roomTemperature', made: -320, expires: 410 },
  { name: 'Insulin Glargine 100 IU/mL', category: 'medicine', batch: 'INS-G0912', maker: 'Helix Biologics', qty: 18, unit: 'vials', reorder: 20, location: 'Cold Room · Fridge 1', storage: 'refrigerated', made: -340, expires: 21, notes: 'Once opened, use within 28 days. Do not freeze.' },
  { name: 'Ceftriaxone 1 g Injection', category: 'medicine', batch: 'CFX-23388', maker: 'Nova Pharma', qty: 40, unit: 'vials', reorder: 25, location: 'Ward 3 · Store', storage: 'roomTemperature', made: -736, expires: -6, notes: 'Quarantined pending disposal.' },
  { name: 'Oxytocin 10 IU/mL Injection', category: 'medicine', batch: 'OXY-25210', maker: 'SureCare Pharma', qty: 60, unit: 'ampoules', reorder: 30, location: 'Labour Ward · Fridge', storage: 'refrigerated', made: -200, expires: 160 },
  { name: 'Morphine Sulfate 10 mg/mL', category: 'medicine', batch: 'MOR-24877', maker: 'Medivance Labs', qty: 12, unit: 'ampoules', reorder: 10, location: 'Pharmacy · Narcotics safe', storage: 'controlled', made: -480, expires: 250, notes: 'Schedule H. Two-person sign-off for every withdrawal.' },
  { name: 'Sodium Chloride 0.9% IV 500 mL', category: 'medicine', batch: 'NS-25502', maker: 'AquaMed Fluids', qty: 300, unit: 'bottles', reorder: 120, location: 'Central Store · Bay 4', storage: 'roomTemperature', made: -365, expires: 365 },
  { name: 'Hepatitis B Vaccine (Recombinant)', category: 'vaccine', batch: 'HBV-7741', maker: 'ImmunoGen Biotech', qty: 45, unit: 'vials', reorder: 20, location: 'Cold Room · Fridge 2', storage: 'refrigerated', made: -720, expires: 9, notes: 'VVM stage 1. Use before newer batch HBV-7802.' },
  { name: 'Rabies Vaccine (Vero Cell)', category: 'vaccine', batch: 'RAB-3320', maker: 'ImmunoGen Biotech', qty: 8, unit: 'vials', reorder: 15, location: 'Cold Room · Fridge 2', storage: 'refrigerated', made: -680, expires: 48 },
  { name: 'Tetanus Toxoid (TT)', category: 'vaccine', batch: 'TT-9015', maker: 'Serovac Institute', qty: 120, unit: 'vials', reorder: 40, location: 'Cold Room · Fridge 1', storage: 'refrigerated', made: -500, expires: 220 },
  { name: 'Packed Red Blood Cells · O+', category: 'bloodProduct', batch: 'PRBC-O-1182', maker: 'Regional Blood Centre', qty: 6, unit: 'units', reorder: 8, location: 'Blood Bank · Fridge A', storage: 'refrigerated', made: -33, expires: 2 },
  { name: 'Fresh Frozen Plasma · AB', category: 'bloodProduct', batch: 'FFP-AB-0457', maker: 'Regional Blood Centre', qty: 14, unit: 'units', reorder: 6, location: 'Blood Bank · Freezer 1', storage: 'frozen', made: -85, expires: 280 },
  { name: 'HbA1c Reagent Kit', category: 'reagent', batch: 'A1C-2290', maker: 'Helix Diagnostics', qty: 4, unit: 'kits', reorder: 3, location: 'Lab · Reagent Cabinet', storage: 'refrigerated', made: -340, expires: 25 },
  { name: 'Blood Grouping Antisera Set', category: 'reagent', batch: 'ABO-1174', maker: 'Helix Diagnostics', qty: 3, unit: 'sets', reorder: 2, location: 'Lab · Fridge', storage: 'refrigerated', made: -377, expires: -12 },
  { name: 'Glucose Oxidase Reagent', category: 'reagent', batch: 'GOD-5531', maker: 'Clarity Bio', qty: 10, unit: 'bottles', reorder: 4, location: 'Lab · Reagent Cabinet', storage: 'cool', made: -220, expires: 140 },
  { name: 'Sterile Syringes 5 mL', category: 'consumable', batch: 'SYR5-88120', maker: 'SureCare Medical', qty: 2400, unit: 'pcs', reorder: 1000, location: 'Central Store · Bay 2', storage: 'roomTemperature', made: -400, expires: 700 },
  { name: 'IV Cannula 20G', category: 'consumable', batch: 'IVC20-4471', maker: 'SureCare Medical', qty: 0, unit: 'pcs', reorder: 150, location: 'Emergency · Trolley 1', storage: 'roomTemperature', made: -1040, expires: 58, notes: 'Supplier back-order raised on PO #4471.' },
  { name: 'Nitrile Examination Gloves (M)', category: 'ppe', batch: 'GLV-M-6620', maker: 'ShieldWear', qty: 60, unit: 'boxes', reorder: 40, location: 'Central Store · Bay 1', storage: 'roomTemperature', made: -190, expires: 540 },
  { name: 'N95 Respirators', category: 'ppe', batch: 'N95-3307', maker: 'ShieldWear', qty: 140, unit: 'pcs', reorder: 200, location: 'ICU · Supply Room', storage: 'roomTemperature', made: -1060, expires: 33 },
  { name: 'AED Defibrillator · ICU Bay 2', category: 'equipment', batch: 'SN AED-55102', maker: 'CardioTech', qty: 1, unit: 'unit', reorder: 0, location: 'ICU · Crash Cart', storage: 'roomTemperature', made: -360, expires: 5, notes: 'Annual service + pad replacement.' },
  { name: 'Digital BP Monitor', category: 'equipment', batch: 'SN BPM-20931', maker: 'VitalSense', qty: 6, unit: 'units', reorder: 2, location: 'OPD · Triage', storage: 'roomTemperature', made: -60, expires: 120 },
  { name: 'Pulse Oximeter', category: 'equipment', batch: 'SN POX-70014', maker: 'VitalSense', qty: 10, unit: 'units', reorder: 4, location: 'Ward 3 · Nurses station', storage: 'roomTemperature', made: -183, expires: -3, notes: 'Calibration overdue. Tag out of service until checked.' },
  { name: 'Infusion Pump', category: 'equipment', batch: 'SN INF-31188', maker: 'Fluidix', qty: 4, unit: 'units', reorder: 2, location: 'ICU · Equipment bay', storage: 'roomTemperature', made: -160, expires: 22 },
];

/**
 * Factory that builds a realistic sample inventory relative to [now], so the
 * demo always shows a mix of expired, critical, expiring and safe stock.
 */
export function buildDemoInventory(now: Date): MedicalAsset[] {
  const today: ISODate = toISODate(now);
  return SPECS.map((spec, index) => {
    const touched = now.getTime() - (3 + index * 7) * 3_600_000;
    return {
      id: `demo-${String(index).padStart(2, '0')}`,
      name: spec.name,
      category: spec.category,
      batchNumber: spec.batch,
      manufacturer: spec.maker,
      quantity: spec.qty,
      unit: spec.unit,
      reorderLevel: spec.reorder,
      location: spec.location,
      storage: spec.storage,
      manufactureDate: addDays(today, spec.made),
      expiryDate: addDays(today, spec.expires),
      notes: spec.notes ?? '',
      createdAt: touched,
      updatedAt: touched,
      imageRef: null,
    };
  });
}
