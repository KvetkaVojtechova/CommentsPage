import { PermissionError, ValidationError } from '../core/errors.js';
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
   * Saves a comment by the logged-in user: top-level when `parentId` is null, otherwise a reply.
   * Permission is checked here too, not only by hiding the buttons (FR-12).
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

    const comment = createComment({ parentId, author, text: cleanText });
    await this.#comments.add(comment);
    return comment;
  }
}
