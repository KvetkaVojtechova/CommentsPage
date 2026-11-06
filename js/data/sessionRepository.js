import { STORAGE_KEYS } from '../config.js';
import { parseList, parseSessionRecord, parseTabSession } from './schemas.js';

/**
 * Sessions (SEC-29, D-1, D-2). The tab keeps { userId, token } in sessionStorage, so the session
 * ends when the tab closes. localStorage keeps only the SHA-256 of the token with the user id and
 * the times, so editing sessionStorage is not enough to act as someone else, and the times
 * cannot be changed from the tab.
 */
export class SessionRepository {
  #tabStorage;
  #sharedStorage;

  /**
   * @param {import('./storageAdapter.js').WebStorageAdapter} tabStorage sessionStorage
   * @param {import('./storageAdapter.js').WebStorageAdapter} sharedStorage localStorage
   */
  constructor(tabStorage, sharedStorage) {
    this.#tabStorage = tabStorage;
    this.#sharedStorage = sharedStorage;
  }

  async getTabSession() {
    return parseTabSession(this.#tabStorage.read(STORAGE_KEYS.session));
  }

  /** @param {{ userId: string, token: string }} session */
  async setTabSession(session) {
    this.#tabStorage.write(STORAGE_KEYS.session, session);
  }

  async clearTabSession() {
    this.#tabStorage.remove(STORAGE_KEYS.session);
  }

  #readRecords() {
    return parseList(
      this.#sharedStorage.read(STORAGE_KEYS.sessions),
      parseSessionRecord,
      'session',
    );
  }

  async findRecord(tokenHash) {
    return this.#readRecords().find((record) => record.tokenHash === tokenHash) ?? null;
  }

  /** Adds a record or replaces the one with the same token hash. */
  async saveRecord(record) {
    const others = this.#readRecords().filter((stored) => stored.tokenHash !== record.tokenHash);
    this.#sharedStorage.write(STORAGE_KEYS.sessions, [...others, record]);
  }

  async removeRecord(tokenHash) {
    const records = this.#readRecords();
    const others = records.filter((record) => record.tokenHash !== tokenHash);
    if (others.length !== records.length) {
      this.#sharedStorage.write(STORAGE_KEYS.sessions, others);
    }
  }

  /** Removes records whose time is up, e.g. from tabs that were closed. */
  async purgeExpired(now) {
    const records = this.#readRecords();
    const active = records.filter((record) => record.expiresAt > now);
    if (active.length !== records.length) {
      this.#sharedStorage.write(STORAGE_KEYS.sessions, active);
    }
  }
}
