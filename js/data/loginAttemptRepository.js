import { LOCKOUT, STORAGE_KEYS } from '../config.js';
import { parseList, parseLoginAttempt } from './schemas.js';

const NO_ATTEMPTS = Object.freeze({ failures: 0, lockLevel: 0, lockedUntil: 0 });

/**
 * Failed logins per username, in localStorage. Unknown usernames are counted
 * too, so the counter does not reveal which accounts exist. Stored as a list of records,
 * so a username like "__proto__" is only ever a value, never an object key.
 */
export class LoginAttemptRepository {
  #storage;

  /** @param {import('./storageAdapter.js').WebStorageAdapter} storage */
  constructor(storage) {
    this.#storage = storage;
  }

  #readAll() {
    return parseList(
      this.#storage.read(STORAGE_KEYS.loginAttempts),
      parseLoginAttempt,
      'login attempt',
    );
  }

  /** @returns {Promise<{ failures: number, lockLevel: number, lockedUntil: number }>} */
  async get(usernameKey) {
    const record = this.#readAll().find((entry) => entry.usernameKey === usernameKey);
    return record ?? { usernameKey, ...NO_ATTEMPTS };
  }

  /**
   * Counts a failed login. From the 5th failure on, every failure locks the name for a while:
   * 30 s, then 60 s, 120 s … up to 15 minutes.
   * @param {number} now Milliseconds since 1970, from the caller's clock.
   */
  async recordFailure(usernameKey, now) {
    const records = this.#readAll();
    const previous = records.find((entry) => entry.usernameKey === usernameKey) ?? NO_ATTEMPTS;
    const record = { usernameKey, ...previous, failures: previous.failures + 1 };

    if (record.failures >= LOCKOUT.freeAttempts) {
      record.lockLevel += 1;
      const wait = Math.min(LOCKOUT.baseWaitMs * 2 ** (record.lockLevel - 1), LOCKOUT.maxWaitMs);
      record.lockedUntil = now + wait;
    }

    const others = records.filter((entry) => entry.usernameKey !== usernameKey);
    const kept = [...others, record].slice(-LOCKOUT.maxTrackedNames);
    this.#storage.write(STORAGE_KEYS.loginAttempts, kept);
    return record;
  }

  /** Called after a successful login. */
  async reset(usernameKey) {
    const records = this.#readAll();
    const others = records.filter((entry) => entry.usernameKey !== usernameKey);
    if (others.length !== records.length) {
      this.#storage.write(STORAGE_KEYS.loginAttempts, others);
    }
  }
}
