import {
  AddAssetCommand,
  AdjustStockCommand,
  CommandHistory,
  DeleteAssetCommand,
} from '../../src/domain/commands';
import { AssetEvaluator } from '../../src/domain/evaluator';
import { ExpiryPolicyFactory } from '../../src/domain/policies';
import { SORT_OPTIONS, type SortOption } from '../../src/domain/sorting';
import { AnySpecification, AssetFilter, Specification } from '../../src/domain/specifications';
import { InMemoryAssetRepository } from '../../src/data/memoryRepositories';
import { asset, TODAY } from '../support/fixtures';

class IsEven extends Specification<number> {
  isSatisfiedBy(n: number) {
    return n % 2 === 0;
  }
}

class Over extends Specification<number> {
  constructor(private readonly limit: number) {
    super();
  }
  isSatisfiedBy(n: number) {
    return n > this.limit;
  }
}

describe('Specification', () => {
  it('composes with and / or / not', () => {
    const numbers = Array.from({ length: 10 }, (_, i) => i);
    const pick = (spec: Specification<number>) => numbers.filter((n) => spec.isSatisfiedBy(n));
    expect(pick(new IsEven().and(new Over(4)))).toEqual([6, 8]);
    expect(pick(new IsEven().not().and(new Over(6)))).toEqual([7, 9]);
    expect(pick(new Over(7).or(new IsEven().not()))).toEqual([1, 3, 5, 7, 8, 9]);
    expect(pick(new AnySpecification<number>())).toEqual(numbers);
  });
});

describe('AssetFilter', () => {
  const evaluator = new AssetEvaluator(new ExpiryPolicyFactory(), TODAY);
  const insights = [
    asset('1', { name: 'Insulin Glargine', expiresInDays: 20, storage: 'refrigerated' }),
    asset('2', { name: 'Paracetamol', expiresInDays: 400, location: 'Rack A1' }),
    asset('3', { name: 'Hep B Vaccine', category: 'vaccine', expiresInDays: -2 }),
    asset('4', { name: 'Gloves', category: 'ppe', quantity: 3, batch: 'GLV-77' }),
  ].map((a) => evaluator.evaluate(a));
  const ids = (filter: AssetFilter) =>
    insights.filter((i) => filter.toSpecification().isSatisfiedBy(i)).map((i) => i.asset.id);

  it('matches everything when empty', () => {
    expect(new AssetFilter().isActive).toBe(false);
    expect(ids(new AssetFilter())).toEqual(['1', '2', '3', '4']);
  });

  it('searches name, batch and location case-insensitively', () => {
    expect(ids(new AssetFilter('INSULIN'))).toEqual(['1']);
    expect(ids(new AssetFilter('glv-7'))).toEqual(['4']);
    expect(ids(new AssetFilter('rack a1'))).toEqual(['2']);
  });

  it('combines category, status and search', () => {
    expect(ids(new AssetFilter('', null, 'expired'))).toEqual(['3']);
    expect(ids(new AssetFilter('', null, 'lowStock'))).toEqual(['4']);
    expect(ids(new AssetFilter('', null, 'coldChain'))).toEqual(['1']);
    expect(ids(new AssetFilter('', 'vaccine', 'safe'))).toEqual([]);
    expect(ids(new AssetFilter().withCategory('medicine').withQuery('para'))).toEqual(['2']);
  });
});

describe('sort strategies', () => {
  const evaluator = new AssetEvaluator(new ExpiryPolicyFactory(), TODAY);
  const insights = [
    asset('a', { name: 'Bravo', expiresInDays: 50, quantity: 100, reorderLevel: 10 }),
    asset('b', { name: 'alpha', expiresInDays: -1, quantity: 5, reorderLevel: 10 }),
    asset('c', { name: 'Charlie', expiresInDays: 5, quantity: 20, reorderLevel: 18 }),
  ].map((a) => evaluator.evaluate(a));
  const order = (option: SortOption) => SORT_OPTIONS[option].strategy.apply(insights).map((i) => i.asset.id);

  it('orders as each option describes', () => {
    expect(order('soonestExpiry')).toEqual(['b', 'c', 'a']);
    expect(order('alphabetical')).toEqual(['b', 'a', 'c']);
    expect(order('lowestStock')).toEqual(['b', 'c', 'a']);
    expect(order('mostUrgent')).toEqual(['b', 'c', 'a']);
  });
});

describe('CommandHistory (Command)', () => {
  let repo: InMemoryAssetRepository;
  let history: CommandHistory;

  beforeEach(() => {
    repo = new InMemoryAssetRepository();
    history = new CommandHistory(3);
  });

  it('executes, undoes and redoes an add', async () => {
    const a = asset('1');
    await history.execute(new AddAssetCommand(a), repo);
    expect(await repo.findById('1')).toEqual(a);
    expect(await history.undo(repo)).toBeInstanceOf(AddAssetCommand);
    expect(await repo.findById('1')).toBeNull();
    expect(history.canRedo).toBe(true);
    await history.redo(repo);
    expect(await repo.findById('1')).toEqual(a);
  });

  it('restores the previous version after a stock adjustment', async () => {
    const before = asset('1', { quantity: 10 });
    await repo.upsert(before);
    const command = new AdjustStockCommand(before, { ...before, quantity: 4 });
    expect(command.delta).toBe(-6);
    expect(command.description).toContain('Used 6');
    await history.execute(command, repo);
    expect((await repo.findById('1'))?.quantity).toBe(4);
    await history.undo(repo);
    expect((await repo.findById('1'))?.quantity).toBe(10);
  });

  it('clears redo on a new command and stays bounded', async () => {
    for (let i = 0; i < 5; i++) await history.execute(new AddAssetCommand(asset(String(i))), repo);
    await history.undo(repo);
    expect(history.canRedo).toBe(true);
    await history.execute(new DeleteAssetCommand(asset('0')), repo);
    expect(history.canRedo).toBe(false);
    let undos = 0;
    while (await history.undo(repo)) undos++;
    expect(undos).toBe(3);
  });

  it('describes disposal differently from deletion', () => {
    const a = asset('1', { quantity: 12 });
    expect(new DeleteAssetCommand(a, true).description).toMatch(/^Disposed 12/);
    expect(new DeleteAssetCommand(a).description).toBe('Removed from inventory');
  });
});
