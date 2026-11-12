import {
  DEFAULT_SETTINGS,
  type AlertSensitivity,
  type AppSettings,
  type ThemePreference,
} from '../../domain/entities';
import type { SettingsStore } from '../../domain/repositories';
import type { SensitivitySource } from './InventoryViewModel';
import { Store } from './store';

export class SettingsViewModel extends Store<AppSettings> {
  constructor(private readonly store: SettingsStore) {
    super(DEFAULT_SETTINGS);
  }

  /** Narrow observable for the inventory, so it needn't depend on settings. */
  readonly sensitivitySource: SensitivitySource = {
    get: () => this.state.sensitivity,
    subscribe: (listener) => {
      let last = this.state.sensitivity;
      return this.subscribe(() => {
        if (this.state.sensitivity !== last) {
          last = this.state.sensitivity;
          listener();
        }
      });
    },
  };

  async load() {
    this.setState(await this.store.load());
  }

  setThemePreference(themePreference: ThemePreference) {
    return this.update({ themePreference });
  }

  setSensitivity(sensitivity: AlertSensitivity) {
    return this.update({ sensitivity });
  }

  setFacilityName(name: string) {
    const facilityName = name.trim();
    return facilityName ? this.update({ facilityName }) : Promise.resolve();
  }

  markDemoDataSeeded() {
    return this.update({ hasSeededDemoData: true });
  }

  private async update(patch: Partial<AppSettings>) {
    this.setState(patch);
    await this.store.save(this.state);
  }
}
