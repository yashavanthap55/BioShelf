/** Typed key for a service registered in the locator. */
export interface Token<T> {
  readonly name: string;
  /** Phantom field that carries the service type; never set at runtime. */
  readonly __type?: T;
}

export const token = <T>(name: string): Token<T> => ({ name });

/**
 * Singleton service locator used as the app's composition root.
 * Implementations are registered once at start-up (or swapped for fakes in
 * tests) and resolved by token everywhere else.
 */
export class ServiceLocator {
  static readonly instance = new ServiceLocator();

  private readonly services = new Map<string, unknown>();

  private constructor() {}

  register<T>(key: Token<T>, service: T): this {
    this.services.set(key.name, service);
    return this;
  }

  get<T>(key: Token<T>): T {
    if (!this.services.has(key.name)) {
      throw new Error(`ServiceLocator: nothing registered for ${key.name}`);
    }
    return this.services.get(key.name) as T;
  }

  isRegistered<T>(key: Token<T>): boolean {
    return this.services.has(key.name);
  }

  reset() {
    this.services.clear();
  }
}

export const locator = ServiceLocator.instance;
