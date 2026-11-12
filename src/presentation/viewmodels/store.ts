export type Listener = () => void;

/**
 * Observable state container behind every view-model (Observer pattern).
 * State is replaced, never mutated, so React's useSyncExternalStore can
 * compare snapshots by reference.
 */
export abstract class Store<S> {
  private readonly listeners = new Set<Listener>();

  protected constructor(protected state: S) {}

  readonly getState = (): S => this.state;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected setState(patch: Partial<S>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
