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
  /**
   * @param {'wrongCredentials' | 'tooManyAttempts'} [code]
   * @param {{ retryAfterSeconds?: number }} [details] For "tooManyAttempts": how long to wait.
   */
  constructor(code = 'wrongCredentials', { retryAfterSeconds = 0 } = {}) {
    super(code);
    this.retryAfterSeconds = retryAfterSeconds;
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
   * @param {string[]} [words] The banned words found, when `reason` is 'blocked'.
   */
  constructor(reason, words = [], { cause } = {}) {
    super(reason === 'blocked' ? 'blockedWords' : 'moderationFailed', { cause });
    this.reason = reason;
    this.words = words;
  }
}

export class StorageError extends AppError {
  constructor({ cause } = {}) {
    super('storageFailed', { cause });
  }
}
