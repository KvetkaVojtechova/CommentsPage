import { AppError } from '../core/errors.js';
import { MESSAGES } from '../messages.js';

/** The Store key for an error shown under a comment box. Step 4 adds one per reply box. */
export const COMPOSER_ERROR_KEY = 'comment.new';

export class CommentController {
  #comments;
  #store;

  /**
   * @param {{
   *   commentService: import('../services/commentService.js').CommentService,
   *   store: import('../core/store.js').Store,
   * }} dependencies
   */
  constructor({ commentService, store }) {
    this.#comments = commentService;
    this.#store = store;
  }

  async load() {
    try {
      this.#store.setComments(await this.#comments.getAll());
    } catch (error) {
      console.error('Could not load the comments:', error);
      this.#store.setComments([]);
    }
  }

  /** @returns {Promise<boolean>} Whether the comment was saved; on failure the draft is kept. */
  async submit(text) {
    this.clearError();
    try {
      this.#store.addComment(await this.#comments.add({ text }));
      return true;
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error(error);
      }
      const message = MESSAGES.errors[error?.messageKey] ?? MESSAGES.errors.unexpected;
      this.#store.setError(COMPOSER_ERROR_KEY, message);
      return false;
    }
  }

  clearError() {
    this.#store.clearError(COMPOSER_ERROR_KEY);
  }
}
