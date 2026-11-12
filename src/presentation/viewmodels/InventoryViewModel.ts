import {
  AddAssetCommand,
  AdjustStockCommand,
  CommandHistory,
  DeleteAssetCommand,
  UpdateAssetCommand,
  type AssetCommand,
} from '../../domain/commands';
import { exportCsv } from '../../domain/csv';
import { toISODate, type ISODate } from '../../domain/dates';
import {
  assetsEqual,
  type ActivityEntry,
  type AlertSensitivity,
  type AssetCategory,
  type ExpiryStatus,
  type MedicalAsset,
} from '../../domain/entities';
import { AssetEvaluator, type AssetInsight } from '../../domain/evaluator';
import { ExpiryPolicyFactory } from '../../domain/policies';
import type { ActivityRepository, AssetRepository } from '../../domain/repositories';
import { LowestStockFirst, SORT_OPTIONS, SoonestExpiryFirst, type SortOption } from '../../domain/sorting';
import { AssetFilter, type StatusFilter } from '../../domain/specifications';
import { computeStats, EMPTY_STATS, type InventoryStats } from '../../domain/stats';
import { Store } from './store';

export interface InventoryState {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly today: ISODate;
  readonly insights: readonly AssetInsight[];
  /** Filtered + sorted list for the inventory screen. */
  readonly visible: readonly AssetInsight[];
  readonly stats: InventoryStats;
  readonly recentActivity: readonly ActivityEntry[];
  readonly filter: AssetFilter;
  readonly sort: SortOption;
  readonly sensitivity: AlertSensitivity;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
}

/** Narrow observable of the alert sensitivity (provided by settings). */
export interface SensitivitySource {
  get(): AlertSensitivity;
  subscribe(listener: () => void): () => void;
}

export interface InventoryDeps {
  readonly assets: AssetRepository;
  readonly activity: ActivityRepository;
  readonly sensitivity?: SensitivitySource;
  readonly clock?: () => Date;
  readonly history?: CommandHistory;
}

const soonest = new SoonestExpiryFirst();
const lowestStock = new LowestStockFirst();

/**
 * MVVM view-model shared by the dashboard, inventory, alerts and detail
 * screens. Components render its state and call its intents; they never
 * touch repositories directly.
 */
export class InventoryViewModel extends Store<InventoryState> {
  private readonly history: CommandHistory;
  private readonly disposers: (() => void)[] = [];
  private raw: MedicalAsset[] = [];
  private policyFactory: ExpiryPolicyFactory;
  private mutating = false;

  constructor(private readonly deps: InventoryDeps) {
    const sensitivity = deps.sensitivity?.get() ?? 'standard';
    super({
      isLoading: true,
      error: null,
      today: toISODate(deps.clock?.() ?? new Date()),
      insights: [],
      visible: [],
      stats: EMPTY_STATS,
      recentActivity: [],
      filter: new AssetFilter(),
      sort: 'soonestExpiry',
      sensitivity,
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
    });
    this.history = deps.history ?? new CommandHistory();
    this.policyFactory = new ExpiryPolicyFactory(sensitivity);

    // Observer: reload when something other than this view-model writes.
    this.disposers.push(
      deps.assets.subscribe(() => {
        if (!this.mutating) void this.refresh();
      }),
    );
    if (deps.sensitivity) {
      const source = deps.sensitivity;
      this.disposers.push(source.subscribe(() => this.applySensitivity(source.get())));
    }
  }

  private now() {
    return this.deps.clock?.() ?? new Date();
  }

  // ---------------------------------------------------------------- queries

  insightFor(id: string): AssetInsight | undefined {
    return this.state.insights.find((i) => i.asset.id === id);
  }

  withStatus(status: ExpiryStatus): AssetInsight[] {
    return soonest.apply(this.state.insights.filter((i) => i.status === status));
  }

  lowStock(): AssetInsight[] {
    return lowestStock.apply(this.state.insights.filter((i) => i.isLowStock));
  }

  /** Upcoming (not yet expired) items, soonest first. */
  expiringNext(limit = 8): AssetInsight[] {
    return this.state.insights
      .filter((i) => i.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, limit);
  }

  /** Items matching [status] combined with the current search and category. */
  countFor(status: StatusFilter): number {
    const spec = this.state.filter.withStatus(status).toSpecification();
    return this.state.insights.filter((i) => spec.isSatisfiedBy(i)).length;
  }

  policyFor(category: AssetCategory) {
    return this.policyFactory.forCategory(category);
  }

  activityFor(assetId: string) {
    return this.deps.activity.recent({ limit: 20, assetId });
  }

  exportCsv(): string {
    return exportCsv(soonest.apply(this.state.insights));
  }

  // ---------------------------------------------------------------- loading

  load() {
    return this.refresh();
  }

  async refresh() {
    try {
      const [assets, activity] = await Promise.all([
        this.deps.assets.fetchAll(),
        this.deps.activity.recent({ limit: 12 }),
      ]);
      this.raw = assets;
      this.recompute({ recentActivity: activity, error: null, isLoading: false });
    } catch (error) {
      this.setState({ error: String(error), isLoading: false });
    }
  }

  private recompute(extra: Partial<InventoryState> = {}) {
    const today = toISODate(this.now());
    const evaluator = new AssetEvaluator(this.policyFactory, today);
    const insights = this.raw.map((asset) => evaluator.evaluate(asset));
    this.setState({
      ...extra,
      today,
      insights,
      stats: computeStats(insights, today),
      visible: this.visibleFrom(insights, this.state.filter, this.state.sort),
      ...this.historyState(),
    });
  }

  private visibleFrom(insights: readonly AssetInsight[], filter: AssetFilter, sort: SortOption) {
    const spec = filter.toSpecification();
    return SORT_OPTIONS[sort].strategy.apply(insights.filter((i) => spec.isSatisfiedBy(i)));
  }

  private historyState() {
    return {
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.nextUndo?.description ?? null,
      redoLabel: this.history.nextRedo?.description ?? null,
    };
  }

  private applySensitivity(sensitivity: AlertSensitivity) {
    if (sensitivity === this.policyFactory.sensitivity) return;
    this.policyFactory = new ExpiryPolicyFactory(sensitivity);
    this.recompute({ sensitivity });
  }

  // ---------------------------------------------------------------- filters

  private setFilter(filter: AssetFilter) {
    this.setState({ filter, visible: this.visibleFrom(this.state.insights, filter, this.state.sort) });
  }

  setQuery(query: string) {
    if (query !== this.state.filter.query) this.setFilter(this.state.filter.withQuery(query));
  }

  setCategory(category: AssetCategory | null) {
    this.setFilter(this.state.filter.withCategory(category));
  }

  setStatusFilter(status: StatusFilter) {
    this.setFilter(this.state.filter.withStatus(status));
  }

  /** Jump straight to one status (e.g. from a dashboard tile). */
  showOnly(status: StatusFilter) {
    this.setFilter(new AssetFilter('', null, status));
  }

  clearFilters() {
    this.setFilter(new AssetFilter());
  }

  setSort(sort: SortOption) {
    if (sort === this.state.sort) return;
    this.setState({ sort, visible: this.visibleFrom(this.state.insights, this.state.filter, sort) });
  }

  // --------------------------------------------------------------- commands

  addAsset(asset: MedicalAsset) {
    return this.run(new AddAssetCommand(asset));
  }

  async updateAsset(updated: MedicalAsset) {
    const before = await this.deps.assets.findById(updated.id);
    if (!before) return this.addAsset(updated);
    if (assetsEqual(before, updated)) return;
    await this.run(new UpdateAssetCommand(before, { ...updated, updatedAt: this.now().getTime() }));
  }

  async adjustStock(asset: MedicalAsset, delta: number) {
    const quantity = Math.max(0, asset.quantity + delta);
    if (quantity === asset.quantity) return;
    await this.run(new AdjustStockCommand(asset, { ...asset, quantity, updatedAt: this.now().getTime() }));
  }

  deleteAsset(asset: MedicalAsset) {
    return this.run(new DeleteAssetCommand(asset));
  }

  disposeAsset(asset: MedicalAsset) {
    return this.run(new DeleteAssetCommand(asset, true));
  }

  /** Resolves to a description of what was undone, or null. */
  undo() {
    return this.travel((repo) => this.history.undo(repo), 'Undid: ');
  }

  redo() {
    return this.travel((repo) => this.history.redo(repo), 'Redid: ');
  }

  replaceAll(assets: readonly MedicalAsset[], reason: string) {
    return this.bulk(async () => {
      await this.deps.assets.clear();
      await this.deps.assets.upsertAll(assets);
      await this.deps.activity.clear();
      await this.deps.activity.log(this.systemEntry(reason));
    });
  }

  clearAll() {
    return this.bulk(async () => {
      await this.deps.assets.clear();
      await this.deps.activity.clear();
      await this.deps.activity.log(this.systemEntry('All inventory data cleared'));
    });
  }

  private run(command: AssetCommand) {
    return this.mutate(async () => {
      await this.history.execute(command, this.deps.assets);
      await this.deps.activity.log(command.toActivity(this.now().getTime()));
    });
  }

  private async travel(
    step: (repo: AssetRepository) => Promise<AssetCommand | null>,
    prefix: string,
  ): Promise<string | null> {
    let command: AssetCommand | null = null;
    await this.mutate(async () => {
      command = await step(this.deps.assets);
      if (command) {
        await this.deps.activity.log({
          assetId: command.subject.id,
          assetName: command.subject.name,
          type: 'reverted',
          message: `${prefix}${command.description}`,
          timestamp: this.now().getTime(),
        });
      }
    });
    return (command as AssetCommand | null)?.description ?? null;
  }

  private bulk(action: () => Promise<void>) {
    return this.mutate(async () => {
      await action();
      this.history.clear();
    });
  }

  private async mutate(action: () => Promise<void>) {
    this.mutating = true;
    try {
      await action();
    } finally {
      this.mutating = false;
    }
    await this.refresh();
  }

  private systemEntry(message: string): ActivityEntry {
    return { assetId: null, assetName: 'Inventory', type: 'system', message, timestamp: this.now().getTime() };
  }

  dispose() {
    this.disposers.forEach((dispose) => dispose());
    this.disposers.length = 0;
  }
}
