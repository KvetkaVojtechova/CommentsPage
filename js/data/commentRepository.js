import { STORAGE_KEYS } from '../config.js';
import { parseComment, parseList } from './schemas.js';

/** Comments in localStorage, as one flat list; the tree is built only when it is drawn. */
export class CommentRepository {
  #storage;

  /** @param {import('./storageAdapter.js').WebStorageAdapter} storage */
  constructor(storage) {
    this.#storage = storage;
  }

  #readAll() {
    return parseList(this.#storage.read(STORAGE_KEYS.comments), parseComment, 'comment');
  }

  async getAll() {
    return this.#readAll();
  }

  async findById(id) {
    return this.#readAll().find((comment) => comment.id === id) ?? null;
  }

  /** Reads the latest list before writing, so a comment saved by another tab is not lost. */
  async add(comment) {
    this.#storage.write(STORAGE_KEYS.comments, [...this.#readAll(), comment]);
  }
}
