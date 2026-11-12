import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

import type { AppServices } from '@/core/bootstrap';
import type { Store } from '../viewmodels/store';

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}

/** Subscribes a component to a view-model's state (MVVM binding). */
export function useStoreState<S>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useInventory() {
  const { inventory } = useServices();
  return { vm: inventory, state: useStoreState(inventory) };
}

export function useSettings() {
  const { settings } = useServices();
  return { vm: settings, state: useStoreState(settings) };
}
