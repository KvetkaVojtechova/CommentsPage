/**
 * Base class for expected errors. `messageKey` names the user-facing text in messages.js.
 */
export class AppError extends Error {
  constructor(code, { messageKey = code, cause } = {}) {
    super(code, { cause });
    this.name = new.target.name;
    this.code = code;
    this.messageKey = messageKey;
  }
}

export class ValidationError extends AppError {
  constructor(field, code) {
    super(code);
    this.field = field;
  }
}

export class AuthError extends AppError {
  constructor(code = 'wrongCredentials') {
    super(code);
  }
}

export class PermissionError extends AppError {
  constructor(code = 'loginRequired') {
    super(code);
  }
}

export class ModerationError extends AppError {
  /**
   * @param {'blocked' | 'failed'} reason
   * @param {string | null} [word] The banned word, when `reason` is 'blocked'.
   */
  constructor(reason, word = null, { cause } = {}) {
    super(reason === 'blocked' ? 'blockedWord' : 'moderationFailed', { cause });
    this.reason = reason;
    this.word = word;
  }
}

export class StorageError extends AppError {
  constructor({ cause } = {}) {
    super('storageFailed', { cause });
  }
}
