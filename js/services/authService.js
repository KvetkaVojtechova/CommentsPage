import { SESSION } from '../config.js';
import { AuthError, ValidationError } from '../core/errors.js';
import {
  normaliseUsername,
  toUsernameKey,
  validatePassword,
  validateUsername,
} from '../utils/validators.js';
import { hashPassword, randomHex, verifyPassword } from './passwordHasher.js';

export function createUser({ username, passwordHash, salt }) {
  return {
    id: crypto.randomUUID(),
    username,
    usernameKey: toUsernameKey(username),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };
}

/** The only user data that leaves this service: never the password hash. */
function toPublicUser(user) {
  return { id: user.id, username: user.username };
}

export class AuthService {
  #users;
  #sessions;

  /**
   * @param {{
   *   userRepository: import('../data/userRepository.js').UserRepository,
   *   sessionRepository: import('../data/sessionRepository.js').SessionRepository,
   * }} dependencies
   */
  constructor({ userRepository, sessionRepository }) {
    this.#users = userRepository;
    this.#sessions = sessionRepository;
  }

  async register(username, password, confirmation) {
    const name = normaliseUsername(username);
    const usernameCheck = validateUsername(name);
    if (!usernameCheck.ok) {
      throw new ValidationError('username', usernameCheck.code);
    }
    const passwordCheck = validatePassword(password, confirmation);
    if (!passwordCheck.ok) {
      const field = passwordCheck.code === 'passwordMismatch' ? 'confirmation' : 'password';
      throw new ValidationError(field, passwordCheck.code);
    }
    if (await this.#users.findByUsernameKey(toUsernameKey(name))) {
      throw new ValidationError('username', 'usernameTaken');
    }

    const { passwordHash, salt } = await hashPassword(password);
    const user = createUser({ username: name, passwordHash, salt });
    await this.#users.add(user);
    return this.#startSession(user);
  }

  async login(username, password) {
    const name = normaliseUsername(username);
    if (!name) {
      throw new ValidationError('username', 'usernameRequired');
    }
    if (!password) {
      throw new ValidationError('password', 'passwordRequired');
    }

    // One error for an unknown user and a wrong password (FR-07).
    const user = await this.#users.findByUsernameKey(toUsernameKey(name));
    if (!user || !(await verifyPassword(password, user.passwordHash)).ok) {
      throw new AuthError();
    }
    return this.#startSession(user);
  }

  async logout() {
    await this.#sessions.clearTabSession();
  }

  /** The logged-in user of this tab, or null. The session is checked against storage on every call. */
  async getCurrentUser() {
    const session = await this.#sessions.getTabSession();
    if (!session) {
      return null;
    }
    const user = await this.#users.findById(session.userId);
    if (!user) {
      await this.#sessions.clearTabSession();
      return null;
    }
    return toPublicUser(user);
  }

  /** Called on page load: the session survives a reload in the same tab (FR-08). */
  async restoreSession() {
    return this.getCurrentUser();
  }

  async #startSession(user) {
    await this.#sessions.setTabSession({ userId: user.id, token: randomHex(SESSION.tokenBytes) });
    return toPublicUser(user);
  }
}
