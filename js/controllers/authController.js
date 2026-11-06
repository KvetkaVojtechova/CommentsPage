import { AppError, AuthError, ValidationError } from '../core/errors.js';
import { MESSAGES } from '../messages.js';

const AUTH_ERROR_FIELDS = ['username', 'password', 'confirmation', 'form'];

/** The Store key for an error shown in the login / registration form. */
export function authErrorKey(field) {
  return `auth.${field}`;
}

export class AuthController {
  #auth;
  #store;

  /**
   * @param {{
   *   authService: import('../services/authService.js').AuthService,
   *   store: import('../core/store.js').Store,
   * }} dependencies
   */
  constructor({ authService, store }) {
    this.#auth = authService;
    this.#store = store;
  }

  async restore() {
    try {
      this.#store.setUser(await this.#auth.restoreSession());
    } catch (error) {
      console.error('Could not restore the session:', error);
      this.#store.setUser(null);
    }
  }

  /**
   * Checks the session again: after another tab logged out, the stored data changed or time
   * passed. Logs this tab out if the session is no longer valid.
   */
  async recheck() {
    try {
      const user = await this.#auth.getCurrentUser();
      if (user?.id !== this.#store.state.currentUser?.id) {
        this.#store.setUser(user);
      }
    } catch (error) {
      console.error('Could not check the session:', error);
    }
  }

  /** Activity on the page keeps the session alive. */
  async touch() {
    try {
      await this.#auth.touch();
    } catch (error) {
      console.error('Could not record activity:', error);
    }
  }

  /** @param {'login' | 'register'} [mode] */
  openAuth(mode = 'login') {
    this.#clearErrors();
    this.#store.openModal(mode);
  }

  // Close before clearing errors, so no update arrives while the modal is still marked open.
  closeAuth() {
    this.#store.closeModal();
    this.#clearErrors();
  }

  async submitLogin({ username, password }) {
    this.#clearErrors();
    try {
      this.#signIn(await this.#auth.login(username, password));
    } catch (error) {
      this.#handleError(error);
    }
  }

  async submitRegister({ username, password, confirmation }) {
    this.#clearErrors();
    try {
      this.#signIn(await this.#auth.register(username, password, confirmation));
    } catch (error) {
      this.#handleError(error);
    }
  }

  async logout() {
    try {
      await this.#auth.logout();
    } catch (error) {
      console.error('Could not clear the session:', error);
    }
    this.#store.setUser(null);
  }

  // Close first, so focus returns to the header before it changes to the logged-in view.
  #signIn(user) {
    this.closeAuth();
    this.#store.setUser(user);
  }

  #clearErrors() {
    for (const field of AUTH_ERROR_FIELDS) {
      this.#store.clearError(authErrorKey(field));
    }
  }

  #handleError(error) {
    if (!(error instanceof AppError)) {
      console.error(error);
    }
    const field = error instanceof ValidationError ? error.field : 'form';
    const message =
      error instanceof AuthError && error.code === 'tooManyAttempts'
        ? MESSAGES.errors.tooManyAttempts(error.retryAfterSeconds)
        : (MESSAGES.errors[error?.messageKey] ?? MESSAGES.errors.unexpected);
    this.#store.setError(authErrorKey(field), message);
  }
}
