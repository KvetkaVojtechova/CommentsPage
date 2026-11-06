import { SESSION } from '../config.js';
import { AuthError, ValidationError } from '../core/errors.js';
import {
  normaliseUsername,
  toUsernameKey,
  validatePassword,
  validateUsername,
} from '../utils/validators.js';
import {
  dummyVerify,
  hashPassword,
  randomHex,
  sha256Hex,
  verifyPassword,
} from './passwordHasher.js';

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

  /** Ends this tab's session; other tabs of the same session notice through the storage event. */
  async logout() {
    const session = await this.#sessions.getTabSession();
    await this.#sessions.clearTabSession();
    if (session) {
      await this.#sessions.removeRecord(await sha256Hex(session.token));
    }
  }

  /**
   * The logged-in user of this tab, or null. On every call both parts of the session are
   * checked, along with its expiry and the user, so an edited or expired session ends here.
   */
  async getCurrentUser() {
    const record = await this.#validRecord();
    if (!record) {
      return null;
    }
    const user = await this.#users.findById(record.userId);
    if (!user) {
      await this.logout();
      return null;
    }
    return toPublicUser(user);
  }

  /** Called on page load: the session survives a reload in the same tab (FR-08). */
  async restoreSession() {
    await this.#sessions.purgeExpired(this.#now());
    return this.getCurrentUser();
  }

  /** Records activity, which keeps the session alive; written at most once a minute. */
  async touch() {
    const record = await this.#validRecord();
    if (!record) {
      return;
    }
    const expiresAt = this.#expiryFrom(this.#now(), record.createdAt);
    if (expiresAt - record.expiresAt >= SESSION.activityWriteMs) {
      await this.#sessions.saveRecord({ ...record, expiresAt });
    }
  }

  async #startSession(user) {
    const token = randomHex(SESSION.tokenBytes);
    const now = this.#now();
    await this.#sessions.saveRecord({
      userId: user.id,
      tokenHash: await sha256Hex(token),
      createdAt: now,
      expiresAt: this.#expiryFrom(now, now),
    });
    await this.#sessions.setTabSession({ userId: user.id, token });
    return toPublicUser(user);
  }

  // 30 minutes after the last activity, but never more than 8 hours after login.
  #expiryFrom(lastActivity, createdAt) {
    return Math.min(lastActivity + SESSION.idleMs, createdAt + SESSION.maxAgeMs);
  }

  /** The stored record of this tab's session, if the session is genuine and still valid. */
  async #validRecord() {
    const session = await this.#sessions.getTabSession();
    if (!session) {
      return null;
    }
    const record = await this.#sessions.findRecord(await sha256Hex(session.token));
    const now = this.#now();
    const isValid =
      record !== null &&
      record.userId === session.userId &&
      now < record.expiresAt &&
      now < record.createdAt + SESSION.maxAgeMs;
    if (!isValid) {
      await this.logout();
      return null;
    }
    return record;
  }
}
