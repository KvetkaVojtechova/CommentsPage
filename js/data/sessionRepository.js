import { STORAGE_KEYS } from '../config.js';
import { parseTabSession } from './schemas.js';

/** The session of this browser tab, kept in sessionStorage so it ends when the tab closes. */
export class SessionRepository {
  #tabStorage;

  /** @param {import('./storageAdapter.js').WebStorageAdapter} tabStorage */
  constructor(tabStorage) {
    this.#tabStorage = tabStorage;
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
}
