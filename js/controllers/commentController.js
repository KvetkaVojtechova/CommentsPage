import { AppError } from '../core/errors.js';
import { MESSAGES } from '../messages.js';

/** The Store key for an error under a comment box: the top one, or the reply box of a comment. */
export function commentErrorKey(parentId) {
  return `comment.${parentId ?? 'new'}`;
}

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

  /**
   * @param {string | null} parentId Null for a top-level comment, otherwise the comment replied to.
   * @returns {Promise<boolean>} Whether the comment was saved; on failure the draft is kept.
   */
  async submit(parentId, text) {
    this.clearError(parentId);
    try {
      const comment = await this.#comments.add({ parentId, text });
      if (parentId) {
        this.#store.closeReply();
      }
      this.#store.addComment(comment);
      return true;
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.error(error);
      }
      const message = MESSAGES.errors[error?.messageKey] ?? MESSAGES.errors.unexpected;
      this.#store.setError(commentErrorKey(parentId), message);
      return false;
    }
  }

  openReply(commentId) {
    this.#clearReplyError();
    this.#store.openReply(commentId);
  }

  cancelReply() {
    this.#clearReplyError();
    this.#store.closeReply();
  }

  clearError(parentId) {
    this.#store.clearError(commentErrorKey(parentId));
  }

  #clearReplyError() {
    const openId = this.#store.state.ui.replyTargetId;
    if (openId) {
      this.clearError(openId);
    }
  }
}
