import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../js/config.js';
import { AuthError, ValidationError } from '../js/core/errors.js';
import { MemoryStorageAdapter } from '../js/data/storageAdapter.js';
import { SessionRepository } from '../js/data/sessionRepository.js';
import { UserRepository } from '../js/data/userRepository.js';
import { AuthService } from '../js/services/authService.js';

const PASSWORD = 'correct horse battery';

describe('AuthService', () => {
  let localStore;
  let tabStore;
  let auth;

  beforeEach(() => {
    localStore = new MemoryStorageAdapter();
    tabStore = new MemoryStorageAdapter();
    auth = new AuthService({
      userRepository: new UserRepository(localStore),
      sessionRepository: new SessionRepository(tabStore),
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
});
