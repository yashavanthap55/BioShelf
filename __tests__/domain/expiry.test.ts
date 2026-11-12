import { exportCsv } from '../../src/domain/csv';
import { addDays, daysBetween, endOfMonth } from '../../src/domain/dates';
import { AssetEvaluator } from '../../src/domain/evaluator';
import {
  BloodBankPolicy,
  ColdChainPolicy,
  ConsumablePolicy,
  EquipmentServicePolicy,
  ExpiryPolicyFactory,
  PharmaceuticalPolicy,
  ScaledExpiryPolicy,
} from '../../src/domain/policies';
import { computeStats } from '../../src/domain/stats';
import { AssetMapper } from '../../src/data/mappers';
import { ASSET_CATEGORIES } from '../../src/domain/entities';
import { asset, TODAY } from '../support/fixtures';

describe('date math', () => {
  it('counts calendar days and handles month ends', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2026-03-10', '2026-03-01')).toBe(-9);
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(endOfMonth(2027, 2)).toBe('2027-02-28');
  });
});

describe('ExpiryPolicy (Strategy)', () => {
  it('applies the pharmaceutical boundaries', () => {
    const policy = new PharmaceuticalPolicy();
    expect([-1, 0, 30, 31, 90, 91].map((d) => policy.evaluate(d))).toEqual([
      'expired',
      'critical',
      'critical',
      'warning',
      'warning',
      'safe',
    ]);
  });

  it('is far stricter for blood than for consumables', () => {
    expect(new BloodBankPolicy().evaluate(11)).toBe('safe');
    expect(new ConsumablePolicy().evaluate(11)).toBe('critical');
  });
});

describe('ExpiryPolicyFactory (Factory + Decorator)', () => {
  it('maps every category to a policy', () => {
    const factory = new ExpiryPolicyFactory();
    expect(factory.forCategory('vaccine')).toBeInstanceOf(ColdChainPolicy);
    expect(factory.forCategory('bloodProduct')).toBeInstanceOf(BloodBankPolicy);
    expect(factory.forCategory('equipment')).toBeInstanceOf(EquipmentServicePolicy);
    expect(factory.forCategory('ppe')).toBeInstanceOf(ConsumablePolicy);
    for (const category of ASSET_CATEGORIES) {
      const p = factory.forCategory(category);
      expect(p.warningWindowDays).toBeGreaterThan(p.criticalWindowDays);
    }
  });

  it('decorates the base policy with the sensitivity', () => {
    const conservative = new ExpiryPolicyFactory('conservative').forCategory('medicine');
    expect(conservative).toBeInstanceOf(ScaledExpiryPolicy);
    expect(conservative.name).toBe(new PharmaceuticalPolicy().name);
    expect(conservative.warningWindowDays).toBe(135);
    expect(conservative.criticalWindowDays).toBe(45);
    expect(conservative.evaluate(100)).toBe('warning');
    expect(new PharmaceuticalPolicy().evaluate(100)).toBe('safe');
  });
});

describe('AssetEvaluator', () => {
  const evaluator = new AssetEvaluator(new ExpiryPolicyFactory(), TODAY);

  it('computes remaining days, status and shelf life used', () => {
    const insight = evaluator.evaluate(asset('a', { expiresInDays: 25, madeDaysAgo: 75 }));
    expect(insight.daysRemaining).toBe(25);
    expect(insight.status).toBe('critical');
    expect(insight.shelfLifeUsed).toBeCloseTo(0.75, 3);
  });

  it('clamps shelf life and flags stock levels', () => {
    const expired = evaluator.evaluate(asset('b', { expiresInDays: -5, quantity: 0 }));
    expect(expired.status).toBe('expired');
    expect(expired.shelfLifeUsed).toBe(1);
    expect(expired.stockStatus).toBe('outOfStock');
    expect(expired.needsAttention).toBe(true);
    expect(evaluator.evaluate(asset('c', { quantity: 10, reorderLevel: 10 })).stockStatus).toBe('low');
  });
});

describe('computeStats', () => {
  it('aggregates statuses, attention and the monthly outlook', () => {
    const evaluator = new AssetEvaluator(new ExpiryPolicyFactory(), TODAY);
    const insights = [
      asset('1', { expiresInDays: -3 }),
      asset('2', { expiresInDays: 10 }),
      asset('3', { expiresInDays: 60, quantity: 2 }),
      asset('4', { expiresInDays: 400 }),
    ].map((a) => evaluator.evaluate(a));
    const stats = computeStats(insights, TODAY);
    expect(stats).toMatchObject({ total: 4, expired: 1, critical: 1, warning: 1, safe: 1, lowStock: 1, attention: 3 });
    expect(stats.healthScore).toBeCloseTo((1 + 0.6 + 0.25) / 4, 4);
    expect(stats.outlook).toHaveLength(6);
    expect(stats.outlook[0]).toMatchObject({ year: 2026, month: 10 });
    // 30 Oct + 10 days = 9 Nov; + 60 days = 29 Dec.
    expect(stats.outlook[1].count).toBe(1);
    expect(stats.outlook[2].count).toBe(1);
  });
});

describe('data mapping and export', () => {
  it('round-trips an asset through a storage row', () => {
    const original = { ...asset('x', { name: 'Insulin "Glargine"' }), imageRef: 'abc-123.jpg' };
    expect(AssetMapper.fromRow(AssetMapper.toRow(original))).toEqual(original);
    const noDate = asset('y', { madeDaysAgo: null });
    expect(AssetMapper.fromRow(AssetMapper.toRow(noDate)).manufactureDate).toBeNull();
  });

  it('escapes commas and quotes in CSV', () => {
    const evaluator = new AssetEvaluator(new ExpiryPolicyFactory(), TODAY);
    const lines = exportCsv([evaluator.evaluate(asset('z', { name: 'Saline, 0.9% "NS"' }))]).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Name,Category,Batch/);
    expect(lines[1]).toMatch(/^"Saline, 0\.9% ""NS""",Medicines,/);
  });
});
