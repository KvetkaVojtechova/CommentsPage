import { STORAGE_KEYS } from '../config.js';
import { parseList, parseUser } from './schemas.js';

/** Users in localStorage. Async so a future API can replace it without changing callers. */
export class UserRepository {
  #storage;

  /** @param {import('./storageAdapter.js').WebStorageAdapter} storage */
  constructor(storage) {
    this.#storage = storage;
  }

  #readAll() {
    return parseList(this.#storage.read(STORAGE_KEYS.users), parseUser, 'user');
  }

  async findByUsernameKey(usernameKey) {
    return this.#readAll().find((user) => user.usernameKey === usernameKey) ?? null;
  }

  async findById(id) {
    return this.#readAll().find((user) => user.id === id) ?? null;
  }

  /** Reads the latest list before writing, so a user added in another tab is kept. */
  async add(user) {
    this.#storage.write(STORAGE_KEYS.users, [...this.#readAll(), user]);
  }
}
