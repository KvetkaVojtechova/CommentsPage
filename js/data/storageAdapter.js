import { StorageError } from '../core/errors.js';

function parseJson(key, raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.warn(`Ignoring invalid JSON in storage key "${key}".`);
    return null;
  }
}

/**
 * Wraps localStorage or sessionStorage. The only module that touches Web Storage.
 * Values are stored as JSON; failures (full or blocked storage) become a StorageError.
 */
export class WebStorageAdapter {
  #storage;

  /** @param {Storage} storage */
  constructor(storage) {
    this.#storage = storage;
  }

  read(key) {
    try {
      return parseJson(key, this.#storage.getItem(key));
    } catch (error) {
      throw new StorageError({ cause: error });
    }
  }

  write(key, value) {
    try {
      this.#storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new StorageError({ cause: error });
    }
  }

  remove(key) {
    try {
      this.#storage.removeItem(key);
    } catch (error) {
      throw new StorageError({ cause: error });
    }
  }

  /**
   * Calls `handler(key)` when another tab changes this storage.
   * @returns {() => void} Stops listening.
   */
  onExternalChange(handler) {
    const listener = (event) => {
      if (event.storageArea === this.#storage) {
        handler(event.key);
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }
}

/** In-memory adapter with the same behaviour, used in tests. */
export class MemoryStorageAdapter {
  #items = new Map();

  read(key) {
    return parseJson(key, this.#items.get(key));
  }

  write(key, value) {
    this.#items.set(key, JSON.stringify(value));
  }

  remove(key) {
    this.#items.delete(key);
  }

  /** Lets tests store raw, possibly corrupted text. */
  writeRaw(key, raw) {
    this.#items.set(key, raw);
  }

  onExternalChange() {
    return () => {};
  }
}
