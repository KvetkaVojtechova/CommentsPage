import { PermissionError, ValidationError } from '../core/errors.js';
import { normaliseCommentText, validateCommentText } from '../utils/validators.js';

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

  /**
   * @param {{
   *   commentRepository: import('../data/commentRepository.js').CommentRepository,
   *   authService: { getCurrentUser: () => Promise<{ id: string, username: string } | null> },
   * }} dependencies
   */
  constructor({ commentRepository, authService }) {
    this.#comments = commentRepository;
    this.#auth = authService;
  }

  async getAll() {
    return this.#comments.getAll();
  }

  /**
   * Saves a top-level comment by the logged-in user.
   * Permission is checked here too, not only by hiding the comment box (FR-12).
   */
  async add({ text }) {
    const author = await this.#auth.getCurrentUser();
    if (!author) {
      throw new PermissionError();
    }

    const cleanText = normaliseCommentText(text);
    const check = validateCommentText(cleanText);
    if (!check.ok) {
      throw new ValidationError('text', check.code);
    }

    const comment = createComment({ parentId: null, author, text: cleanText });
    await this.#comments.add(comment);
    return comment;
  }
}
