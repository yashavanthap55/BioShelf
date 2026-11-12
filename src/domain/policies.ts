import type { AlertSensitivity, AssetCategory, ExpiryStatus } from './entities';

/**
 * Strategy pattern: each policy decides how early an asset is flagged.
 * A unit of platelets needs attention days before expiry, a box of gloves
 * months before.
 */
export abstract class ExpiryPolicy {
  abstract get name(): string;
  /** Days before expiry at which the asset becomes critical. */
  abstract get criticalWindowDays(): number;
  /** Days before expiry at which the asset becomes "expiring soon". */
  abstract get warningWindowDays(): number;

  evaluate(daysRemaining: number): ExpiryStatus {
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= this.criticalWindowDays) return 'critical';
    if (daysRemaining <= this.warningWindowDays) return 'warning';
    return 'safe';
  }
}

class WindowPolicy extends ExpiryPolicy {
  constructor(
    private readonly policyName: string,
    private readonly critical: number,
    private readonly warning: number,
  ) {
    super();
  }

  get name() {
    return this.policyName;
  }
  get criticalWindowDays() {
    return this.critical;
  }
  get warningWindowDays() {
    return this.warning;
  }
}

export class PharmaceuticalPolicy extends WindowPolicy {
  constructor() {
    super('Pharmaceutical (FEFO)', 30, 90);
  }
}

export class ColdChainPolicy extends WindowPolicy {
  constructor() {
    super('Cold chain', 14, 60);
  }
}

export class BloodBankPolicy extends WindowPolicy {
  constructor() {
    super('Blood bank', 3, 10);
  }
}

export class DiagnosticReagentPolicy extends WindowPolicy {
  constructor() {
    super('Diagnostic reagent', 7, 30);
  }
}

export class ConsumablePolicy extends WindowPolicy {
  constructor() {
    super('Consumable stock', 30, 90);
  }
}

export class EquipmentServicePolicy extends WindowPolicy {
  constructor() {
    super('Calibration & service', 7, 30);
  }
}

/** Decorator pattern: wraps any policy and scales its alert windows. */
export class ScaledExpiryPolicy extends ExpiryPolicy {
  constructor(
    readonly inner: ExpiryPolicy,
    readonly factor: number,
  ) {
    super();
  }

  get name() {
    return this.inner.name;
  }
  get criticalWindowDays() {
    return Math.round(this.inner.criticalWindowDays * this.factor);
  }
  get warningWindowDays() {
    return Math.round(this.inner.warningWindowDays * this.factor);
  }
}

export const SENSITIVITY_INFO: Record<
  AlertSensitivity,
  { label: string; factor: number; description: string }
> = {
  relaxed: { label: 'Relaxed', factor: 0.5, description: 'Alerts arrive at half the usual lead time' },
  standard: { label: 'Standard', factor: 1, description: 'Recommended lead times per category' },
  conservative: { label: 'Conservative', factor: 1.5, description: 'Alerts arrive 50% earlier' },
};

export const ALERT_SENSITIVITIES: readonly AlertSensitivity[] = ['relaxed', 'standard', 'conservative'];

const BASE_POLICIES: Record<AssetCategory, ExpiryPolicy> = {
  medicine: new PharmaceuticalPolicy(),
  vaccine: new ColdChainPolicy(),
  bloodProduct: new BloodBankPolicy(),
  reagent: new DiagnosticReagentPolicy(),
  consumable: new ConsumablePolicy(),
  ppe: new ConsumablePolicy(),
  equipment: new EquipmentServicePolicy(),
};

/**
 * Factory pattern: resolves the strategy for a category, decorated with the
 * user's chosen sensitivity.
 */
export class ExpiryPolicyFactory {
  constructor(readonly sensitivity: AlertSensitivity = 'standard') {}

  forCategory(category: AssetCategory): ExpiryPolicy {
    const base = BASE_POLICIES[category];
    if (this.sensitivity === 'standard') return base;
    return new ScaledExpiryPolicy(base, SENSITIVITY_INFO[this.sensitivity].factor);
  }
}
