import { ModerationError, PermissionError, ValidationError } from '../core/errors.js';
import { isUuid, normaliseCommentText, validateCommentText } from '../utils/validators.js';

export function createComment({ parentId, author, text }) {
  return {
    id: crypto.randomUUID(),
    parentId,
    authorId: author.id,
    authorName: author.username,
    text,
    createdAt: new Date().toISOString(),
  };
}

export class CommentService {
  #comments;
  #auth;
  #moderation;

  /**
   * @param {{
   *   commentRepository: import('../data/commentRepository.js').CommentRepository,
   *   authService: { getCurrentUser: () => Promise<{ id: string, username: string } | null> },
   *   moderationService: { check: (text: string) => Promise<{ blocked: boolean, words: string[] }> },
   * }} dependencies
   */
  constructor({ commentRepository, authService, moderationService }) {
    this.#comments = commentRepository;
    this.#auth = authService;
    this.#moderation = moderationService;
  }

  async getAll() {
    return this.#comments.getAll();
  }

  /**
   * Saves a comment by the logged-in user: top-level when `parentId` is null, otherwise a reply.
   * Permission is checked here too, not only by hiding the buttons. The banned-word
   * check runs here as well, so nothing can be saved without it.
   * @param {{ parentId?: string | null, text: string }} input
   */
  async add({ parentId = null, text }) {
    const author = await this.#auth.getCurrentUser();
    if (!author) {
      throw new PermissionError();
    }

    const cleanText = normaliseCommentText(text);
    const check = validateCommentText(cleanText);
    if (!check.ok) {
      throw new ValidationError('text', check.code);
    }

    if (parentId !== null && !(isUuid(parentId) && (await this.#comments.findById(parentId)))) {
      throw new ValidationError('parentId', 'parentMissing');
    }

    // The same text is checked and saved.
    const { blocked, words } = await this.#moderation.check(cleanText);
    if (blocked) {
      throw new ModerationError('blocked', words);
    }
    // The check takes a moment; the user may have logged out in another tab meanwhile.
    const stillLoggedIn = await this.#auth.getCurrentUser();
    if (stillLoggedIn?.id !== author.id) {
      throw new PermissionError();
    }

    const comment = createComment({ parentId, author, text: cleanText });
    await this.#comments.add(comment);
    return comment;
  }
}
