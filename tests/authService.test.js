import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../js/config.js';
import { AuthError, ValidationError } from '../js/core/errors.js';
import { MemoryStorageAdapter } from '../js/data/storageAdapter.js';
import { SessionRepository } from '../js/data/sessionRepository.js';
import { UserRepository } from '../js/data/userRepository.js';
import { LoginAttemptRepository } from '../js/data/loginAttemptRepository.js';
import { AuthService } from '../js/services/authService.js';
import { hashPassword } from '../js/services/passwordHasher.js';

const PASSWORD = 'correct horse battery';

describe('AuthService', () => {
  let localStore;
  let tabStore;
  let auth;
  let clock;

  beforeEach(() => {
    localStore = new MemoryStorageAdapter();
    tabStore = new MemoryStorageAdapter();
    clock = Date.parse('2026-11-06T10:00:00Z');
    auth = new AuthService({
      userRepository: new UserRepository(localStore),
      sessionRepository: new SessionRepository(tabStore, localStore),
      loginAttemptRepository: new LoginAttemptRepository(localStore),
      now: () => clock,
    });
  });

  it('registers a user, logs them in and never stores the password', async () => {
    const user = await auth.register('Anna', PASSWORD, PASSWORD);

    assert.deepEqual(Object.keys(user), ['id', 'username']);
    assert.equal(user.username, 'Anna');
    assert.deepEqual(await auth.getCurrentUser(), user);

    const [stored] = localStore.read(STORAGE_KEYS.users);
    assert.match(stored.passwordHash, /^pbkdf2-sha256\$600000\$/);
    assert.equal(JSON.stringify(localStore.read(STORAGE_KEYS.users)).includes(PASSWORD), false);
    assert.equal(JSON.stringify(tabStore.read(STORAGE_KEYS.session)).includes(PASSWORD), false);
  });

  it('refuses a username that differs only in case', async () => {
    await auth.register('Anna', PASSWORD, PASSWORD);

    await assert.rejects(auth.register('anna', PASSWORD, PASSWORD), {
      name: 'ValidationError',
      field: 'username',
      code: 'usernameTaken',
    });
  });

  it('accepts a Slovak username and matches it however it is typed', async () => {
    const user = await auth.register('Ľubomír', PASSWORD, PASSWORD);
    await auth.logout();

    await assert.rejects(auth.register('ĽUBOMÍR', PASSWORD, PASSWORD), { code: 'usernameTaken' });
    // "í" typed as "i" plus a combining accent
    assert.deepEqual(await auth.login('Ľubomír', PASSWORD), user);
  });

  it('reports which field is invalid', async () => {
    await assert.rejects(auth.register('a', PASSWORD, PASSWORD), { field: 'username' });
    await assert.rejects(auth.register('Anna', 'short', 'short'), { field: 'password' });
    await assert.rejects(auth.register('Anna', PASSWORD, 'something else'), {
      field: 'confirmation',
      code: 'passwordMismatch',
    });
  });

  it('logs out and logs in again', async () => {
    const registered = await auth.register('Anna', PASSWORD, PASSWORD);
    await auth.logout();
    assert.equal(await auth.getCurrentUser(), null);

    const user = await auth.login('ANNA', PASSWORD);

    assert.deepEqual(user, registered);
    assert.deepEqual(await auth.getCurrentUser(), registered);
  });

  it('gives the same error for a wrong password and an unknown user', async () => {
    await auth.register('Anna', PASSWORD, PASSWORD);
    await auth.logout();

    await assert.rejects(auth.login('Anna', 'wrong password!'), AuthError);
    await assert.rejects(auth.login('Nobody', PASSWORD), AuthError);
    assert.equal(await auth.getCurrentUser(), null);
  });

  it('asks for missing login fields', async () => {
    await assert.rejects(auth.login('', PASSWORD), ValidationError);
    await assert.rejects(auth.login('Anna', ''), { field: 'password', code: 'passwordRequired' });
  });

  it('ends the session when the user no longer exists', async () => {
    await auth.register('Anna', PASSWORD, PASSWORD);
    localStore.remove(STORAGE_KEYS.users);

    assert.equal(await auth.restoreSession(), null);
    assert.equal(tabStore.read(STORAGE_KEYS.session), null);
  });

  it('refuses common passwords and passwords that contain the username', async () => {
    await assert.rejects(auth.register('Anna', 'passwordpassword', 'passwordpassword'), {
      field: 'password',
      code: 'passwordTooCommon',
    });
    await assert.rejects(auth.register('Anna', 'I am anna, hello', 'I am anna, hello'), {
      field: 'password',
      code: 'passwordContainsUsername',
    });
  });

  describe('lockout after failed logins', () => {
    const wrongLogin = () => auth.login('Anna', 'wrong password!');
    const tooMany = (seconds) => ({ code: 'tooManyAttempts', retryAfterSeconds: seconds });

    beforeEach(async () => {
      await auth.register('Anna', PASSWORD, PASSWORD);
      await auth.logout();
    });

    it('blocks the next try after 5 failures, doubling the wait up to 15 minutes', async () => {
      for (let i = 0; i < 5; i++) {
        await assert.rejects(wrongLogin(), { code: 'wrongCredentials' });
      }
      // Even the right password is refused while the name is locked.
      await assert.rejects(auth.login('Anna', PASSWORD), tooMany(30));

      clock += 10_000;
      await assert.rejects(wrongLogin(), tooMany(20));

      for (const waitSeconds of [60, 120, 240, 480, 900, 900]) {
        clock += 60 * 60_000;
        await assert.rejects(wrongLogin(), { code: 'wrongCredentials' });
        await assert.rejects(wrongLogin(), tooMany(waitSeconds));
      }
    });

    it('resets the counter after a successful login', async () => {
      for (let i = 0; i < 4; i++) {
        await assert.rejects(wrongLogin(), { code: 'wrongCredentials' });
      }
      await auth.login('Anna', PASSWORD);
      await auth.logout();

      for (let i = 0; i < 4; i++) {
        await assert.rejects(wrongLogin(), { code: 'wrongCredentials' });
      }
      await auth.login('Anna', PASSWORD);
    });

    it('counts unknown usernames the same way', async () => {
      for (let i = 0; i < 5; i++) {
        await assert.rejects(auth.login('Nobody', PASSWORD), { code: 'wrongCredentials' });
      }
      await assert.rejects(auth.login('Nobody', PASSWORD), tooMany(30));
      await auth.login('Anna', PASSWORD);
    });
  });

  it('takes about as long for an unknown user as for a wrong password', async () => {
    await auth.register('Anna', PASSWORD, PASSWORD);
    const time = async (username) => {
      const start = performance.now();
      await assert.rejects(auth.login(username, 'wrong password!'), { code: 'wrongCredentials' });
      return performance.now() - start;
    };

    const wrongPassword = await time('Anna');
    const unknownUser = await time('Nobody');

    const ratio = unknownUser / wrongPassword;
    assert.ok(ratio > 0.5 && ratio < 2, `unknown user took ${ratio.toFixed(2)}× as long`);
  });

  it('re-hashes a password stored with older settings after a successful login', async () => {
    const user = await auth.register('Anna', PASSWORD, PASSWORD);
    const old = await hashPassword(PASSWORD, { iterations: 1000 });
    const users = localStore.read(STORAGE_KEYS.users);
    localStore.write(STORAGE_KEYS.users, [{ ...users[0], ...old }]);
    await auth.logout();

    assert.deepEqual(await auth.login('Anna', PASSWORD), user);

    const [stored] = localStore.read(STORAGE_KEYS.users);
    assert.match(stored.passwordHash, /^pbkdf2-sha256\$600000\$/);
    assert.notEqual(stored.salt, old.salt);
    await auth.logout();
    assert.deepEqual(await auth.login('Anna', PASSWORD), user);
  });

  describe('tamper-resistant sessions', () => {
    const MINUTE = 60_000;
    let user;

    beforeEach(async () => {
      user = await auth.register('Anna', PASSWORD, PASSWORD);
    });

    const tabSession = () => tabStore.read(STORAGE_KEYS.session);
    const records = () => localStore.read(STORAGE_KEYS.sessions) ?? [];

    it('keeps the token in the tab and only its SHA-256 in localStorage', () => {
      const [record] = records();

      assert.deepEqual(Object.keys(tabSession()), ['userId', 'token']);
      assert.deepEqual(Object.keys(record), ['userId', 'tokenHash', 'createdAt', 'expiresAt']);
      assert.notEqual(record.tokenHash, tabSession().token);
      const everything = JSON.stringify([tabSession(), records()]);
      assert.equal(everything.includes(PASSWORD), false);
      assert.equal(everything.includes('pbkdf2'), false);
    });

    it('logs out when the userId in sessionStorage is changed', async () => {
      const annasSession = tabSession();
      const other = await auth.register('Ben', PASSWORD, PASSWORD);
      tabStore.write(STORAGE_KEYS.session, { ...annasSession, userId: other.id });

      assert.equal(await auth.getCurrentUser(), null);
      assert.equal(tabSession(), null);
    });

    it('logs out when the token is changed', async () => {
      tabStore.write(STORAGE_KEYS.session, { ...tabSession(), token: 'a'.repeat(64) });

      assert.equal(await auth.getCurrentUser(), null);
    });

    it('ends after 30 minutes without activity', async () => {
      clock += 29 * MINUTE;
      assert.deepEqual(await auth.getCurrentUser(), user);
      clock += 2 * MINUTE;

      assert.equal(await auth.getCurrentUser(), null);
    });

    it('stays alive with activity, written at most once a minute', async () => {
      clock += 20 * MINUTE;
      await auth.touch();
      const afterFirstTouch = records()[0].expiresAt;
      clock += 30_000;
      await auth.touch();
      assert.equal(records()[0].expiresAt, afterFirstTouch);

      clock += 20 * MINUTE;
      assert.deepEqual(await auth.getCurrentUser(), user);
    });

    it('ends after 8 hours even with activity', async () => {
      for (let hour = 0; hour < 8 * 4; hour++) {
        clock += 15 * MINUTE;
        await auth.touch();
      }

      assert.equal(await auth.getCurrentUser(), null);
    });

    it('logs out when the user no longer exists', async () => {
      localStore.write(STORAGE_KEYS.users, []);

      assert.equal(await auth.getCurrentUser(), null);
      assert.deepEqual(records(), []);
    });

    it('logout removes the record, so a copy of the tab is logged out too', async () => {
      const copiedTab = new MemoryStorageAdapter();
      copiedTab.write(STORAGE_KEYS.session, tabSession());
      const otherTab = new AuthService({
        userRepository: new UserRepository(localStore),
        sessionRepository: new SessionRepository(copiedTab, localStore),
        loginAttemptRepository: new LoginAttemptRepository(localStore),
        now: () => clock,
      });
      assert.deepEqual(await otherTab.getCurrentUser(), user);

      await auth.logout();

      assert.deepEqual(records(), []);
      assert.equal(await otherTab.getCurrentUser(), null);
    });

    it('removes expired records of closed tabs on the next page load', async () => {
      tabStore.remove(STORAGE_KEYS.session);
      clock += 31 * MINUTE;

      await auth.restoreSession();

      assert.deepEqual(records(), []);
    });
  });
});
