import type { ActivityEntry, ActivityType, MedicalAsset } from './entities';
import type { AssetRepository } from './repositories';

/**
 * Command pattern: every mutation is an object that knows how to undo
 * itself. This powers undo/redo and gives the audit trail a uniform
 * description.
 */
export abstract class AssetCommand {
  abstract get subject(): MedicalAsset;
  abstract get activityType(): ActivityType;
  abstract get description(): string;
  abstract execute(repository: AssetRepository): Promise<void>;
  abstract undo(repository: AssetRepository): Promise<void>;

  toActivity(at: number, prefix = ''): ActivityEntry {
    return {
      assetId: this.subject.id,
      assetName: this.subject.name,
      type: this.activityType,
      message: `${prefix}${this.description}`,
      timestamp: at,
    };
  }
}

export class AddAssetCommand extends AssetCommand {
  constructor(readonly asset: MedicalAsset) {
    super();
  }

  get subject() {
    return this.asset;
  }
  get activityType(): ActivityType {
    return 'added';
  }
  get description() {
    return `Added ${this.asset.quantity} ${this.asset.unit} · batch ${this.asset.batchNumber}`;
  }
  execute(repository: AssetRepository) {
    return repository.upsert(this.asset);
  }
  undo(repository: AssetRepository) {
    return repository.delete(this.asset.id);
  }
}

export class UpdateAssetCommand extends AssetCommand {
  constructor(
    readonly before: MedicalAsset,
    readonly after: MedicalAsset,
  ) {
    super();
  }

  get subject() {
    return this.after;
  }
  get activityType(): ActivityType {
    return 'updated';
  }
  get description() {
    return 'Edited details';
  }
  execute(repository: AssetRepository) {
    return repository.upsert(this.after);
  }
  undo(repository: AssetRepository) {
    return repository.upsert(this.before);
  }
}

export class AdjustStockCommand extends UpdateAssetCommand {
  get delta() {
    return this.after.quantity - this.before.quantity;
  }
  override get activityType(): ActivityType {
    return this.delta >= 0 ? 'restocked' : 'consumed';
  }
  override get description() {
    const { unit, quantity } = this.after;
    return this.delta >= 0
      ? `Restocked +${this.delta} ${unit} (now ${quantity})`
      : `Used ${-this.delta} ${unit} (now ${quantity})`;
  }
}

export class DeleteAssetCommand extends AssetCommand {
  constructor(
    readonly asset: MedicalAsset,
    /** True when expired stock is being disposed of, not a record deleted. */
    readonly disposal = false,
  ) {
    super();
  }

  get subject() {
    return this.asset;
  }
  get activityType(): ActivityType {
    return this.disposal ? 'disposed' : 'deleted';
  }
  get description() {
    return this.disposal
      ? `Disposed ${this.asset.quantity} ${this.asset.unit} · batch ${this.asset.batchNumber}`
      : 'Removed from inventory';
  }
  execute(repository: AssetRepository) {
    return repository.delete(this.asset.id);
  }
  undo(repository: AssetRepository) {
    return repository.upsert(this.asset);
  }
}

/** Bounded undo/redo stacks of executed commands. */
export class CommandHistory {
  private readonly undoStack: AssetCommand[] = [];
  private readonly redoStack: AssetCommand[] = [];

  constructor(readonly limit = 30) {}

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get nextUndo(): AssetCommand | null {
    return this.undoStack.at(-1) ?? null;
  }
  get nextRedo(): AssetCommand | null {
    return this.redoStack.at(-1) ?? null;
  }

  async execute(command: AssetCommand, repository: AssetRepository) {
    await command.execute(repository);
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  async undo(repository: AssetRepository): Promise<AssetCommand | null> {
    const command = this.undoStack.pop();
    if (!command) return null;
    await command.undo(repository);
    this.redoStack.push(command);
    return command;
  }

  async redo(repository: AssetRepository): Promise<AssetCommand | null> {
    const command = this.redoStack.pop();
    if (!command) return null;
    await command.execute(repository);
    this.undoStack.push(command);
    return command;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
