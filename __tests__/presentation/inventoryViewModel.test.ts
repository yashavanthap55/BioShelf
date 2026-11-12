import type { AlertSensitivity } from '../../src/domain/entities';
import { InMemoryActivityRepository, InMemoryAssetRepository } from '../../src/data/memoryRepositories';
import { InventoryViewModel, type SensitivitySource } from '../../src/presentation/viewmodels/InventoryViewModel';
import { asset, NOW } from '../support/fixtures';

function sensitivitySource(initial: AlertSensitivity) {
  let value = initial;
  const listeners = new Set<() => void>();
  const source: SensitivitySource = {
    get: () => value,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return {
    source,
    set(next: AlertSensitivity) {
      value = next;
      listeners.forEach((l) => l());
    },
  };
}

describe('InventoryViewModel', () => {
  let assets: InMemoryAssetRepository;
  let activity: InMemoryActivityRepository;
  let sensitivity: ReturnType<typeof sensitivitySource>;
  let vm: InventoryViewModel;

  beforeEach(async () => {
    assets = new InMemoryAssetRepository([
      asset('expired', { name: 'Ceftriaxone', expiresInDays: -4 }),
      asset('critical', { name: 'Hep B Vaccine', category: 'vaccine', expiresInDays: 9 }),
      asset('soon', { name: 'Amoxicillin', expiresInDays: 75 }),
      asset('safe', { name: 'Paracetamol', expiresInDays: 100, quantity: 5, reorderLevel: 20 }),
    ]);
    activity = new InMemoryActivityRepository();
    sensitivity = sensitivitySource('standard');
    vm = new InventoryViewModel({ assets, activity, sensitivity: sensitivity.source, clock: () => NOW });
    await vm.load();
  });

  afterEach(() => vm.dispose());

  it('loads and evaluates the inventory', () => {
    const s = vm.getState();
    expect(s.isLoading).toBe(false);
    expect(s.stats).toMatchObject({ total: 4, expired: 1, critical: 1, warning: 1, safe: 1, lowStock: 1 });
    expect(vm.insightFor('critical')?.status).toBe('critical');
    expect(vm.expiringNext().map((i) => i.asset.id)).toEqual(['critical', 'soon', 'safe']);
  });

  it('drives the visible list with filters and sorting', () => {
    let notifications = 0;
    const unsubscribe = vm.subscribe(() => notifications++);

    vm.setQuery('amox');
    expect(vm.getState().visible.map((i) => i.asset.id)).toEqual(['soon']);
    vm.setQuery('');
    vm.setStatusFilter('lowStock');
    expect(vm.getState().visible.map((i) => i.asset.id)).toEqual(['safe']);
    expect(vm.countFor('expired')).toBe(1);
    vm.showOnly('all');
    vm.setSort('alphabetical');
    expect(vm.getState().visible[0].asset.name).toBe('Amoxicillin');
    expect(vm.getState().filter.isActive).toBe(false);
    expect(notifications).toBeGreaterThanOrEqual(4);
    unsubscribe();
  });

  it('round-trips add, undo and redo through the repository', async () => {
    await vm.addAsset(asset('new', { name: 'Oxytocin' }));
    expect(vm.getState().stats.total).toBe(5);
    expect(vm.getState().canUndo).toBe(true);
    expect(vm.getState().recentActivity[0].type).toBe('added');

    expect(await vm.undo()).toContain('Added');
    expect(vm.insightFor('new')).toBeUndefined();
    expect(vm.getState().recentActivity[0].type).toBe('reverted');

    await vm.redo();
    expect(vm.insightFor('new')).toBeDefined();
  });

  it('clamps stock adjustments at zero and can undo them', async () => {
    await vm.adjustStock(vm.insightFor('safe')!.asset, -999);
    expect(vm.insightFor('safe')?.asset.quantity).toBe(0);
    expect(vm.insightFor('safe')?.stockStatus).toBe('outOfStock');
    expect(vm.getState().recentActivity[0].type).toBe('consumed');
    await vm.undo();
    expect(vm.insightFor('safe')?.asset.quantity).toBe(5);
  });

  it('treats an unchanged update as a no-op', async () => {
    await vm.updateAsset(vm.insightFor('soon')!.asset);
    expect(vm.getState().canUndo).toBe(false);
  });

  it('logs disposal and deletion distinctly', async () => {
    await vm.disposeAsset(vm.insightFor('expired')!.asset);
    await vm.deleteAsset(vm.insightFor('soon')!.asset);
    expect(vm.getState().stats.total).toBe(2);
    const log = await activity.recent();
    expect(log.map((e) => e.type).slice(0, 2)).toEqual(['deleted', 'disposed']);
    expect(await vm.activityFor('expired')).toHaveLength(1);
  });

  it('re-evaluates every asset when sensitivity changes', () => {
    expect(vm.insightFor('safe')?.status).toBe('safe');
    sensitivity.set('conservative');
    expect(vm.getState().sensitivity).toBe('conservative');
    expect(vm.insightFor('safe')?.status).toBe('warning');
    sensitivity.set('relaxed');
    expect(vm.insightFor('soon')?.status).toBe('safe');
  });

  it('observes writes made outside the view-model', async () => {
    await assets.upsert(asset('external', { name: 'Rabies Vaccine' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vm.insightFor('external')).toBeDefined();
  });

  it('resets data and history with replaceAll and clearAll', async () => {
    await vm.addAsset(asset('temp'));
    await vm.replaceAll([asset('only')], 'Reset');
    expect(vm.getState().stats.total).toBe(1);
    expect(vm.getState().canUndo).toBe(false);
    expect(vm.getState().recentActivity.map((e) => e.message)).toEqual(['Reset']);
    await vm.clearAll();
    expect(vm.getState().stats.total).toBe(0);
    expect(vm.getState().stats.healthScore).toBe(1);
  });

  it('exports every asset as CSV, soonest expiry first', () => {
    const lines = vm.exportCsv().trim().split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toMatch(/^Ceftriaxone/);
  });
});
