import { SESSION } from '../config.js';
import { AuthError, ValidationError } from '../core/errors.js';
import {
  normaliseUsername,
  toUsernameKey,
  validatePassword,
  validateUsername,
} from '../utils/validators.js';
import { dummyVerify, hashPassword, randomHex, verifyPassword } from './passwordHasher.js';

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
  #attempts;
  #now;

  /**
   * @param {{
   *   userRepository: import('../data/userRepository.js').UserRepository,
   *   sessionRepository: import('../data/sessionRepository.js').SessionRepository,
   *   loginAttemptRepository: import('../data/loginAttemptRepository.js').LoginAttemptRepository,
   *   now?: () => number,
   * }} dependencies `now` is the clock, replaceable in tests.
   */
  constructor({ userRepository, sessionRepository, loginAttemptRepository, now = Date.now }) {
    this.#users = userRepository;
    this.#sessions = sessionRepository;
    this.#attempts = loginAttemptRepository;
    this.#now = now;
  }

  async register(username, password, confirmation) {
    const name = normaliseUsername(username);
    const usernameCheck = validateUsername(name);
    if (!usernameCheck.ok) {
      throw new ValidationError('username', usernameCheck.code);
    }
    const passwordCheck = validatePassword(password, confirmation, name);
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

    const usernameKey = toUsernameKey(name);
    // A name that can never be an account is not tracked, so it cannot fill the storage.
    const isTracked = validateUsername(name).ok;
    if (isTracked) {
      await this.#checkLockout(usernameKey);
    }

    // An unknown username and a wrong password take the same time and give the same
    // error, so neither reveals which accounts exist (FR-07, SEC-27).
    const user = await this.#users.findByUsernameKey(usernameKey);
    const result = user
      ? await verifyPassword(password, user.passwordHash)
      : await dummyVerify(password);
    if (!user || !result.ok) {
      if (isTracked) {
        await this.#attempts.recordFailure(usernameKey, this.#now());
      }
      throw new AuthError();
    }

    await this.#attempts.reset(usernameKey);
    if (result.needsRehash) {
      await this.#rehash(user, password);
    }
    return this.#startSession(user);
  }

  /** SEC-28: a locked name is refused before the password is even checked. */
  async #checkLockout(usernameKey) {
    const { lockedUntil } = await this.#attempts.get(usernameKey);
    const waitMs = lockedUntil - this.#now();
    if (waitMs > 0) {
      throw new AuthError('tooManyAttempts', { retryAfterSeconds: Math.ceil(waitMs / 1000) });
    }
  }

  /** SEC-22: a password hashed with older settings is hashed again with the current ones. */
  async #rehash(user, password) {
    const { passwordHash, salt } = await hashPassword(password);
    await this.#users.update({ ...user, passwordHash, salt });
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
