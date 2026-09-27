/**
 * Serializes async work per key so read-modify-write sequences on the same
 * key never interleave inside one process.
 */
export class KeyedMutex {
  private readonly chains = new Map<string, Promise<void>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => gate);
    this.chains.set(key, chain);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.chains.get(key) === chain) this.chains.delete(key);
    }
  }
}
