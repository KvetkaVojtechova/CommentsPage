import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS } from '../js/config.js';
import { MemoryStorageAdapter } from '../js/data/storageAdapter.js';
import { UserRepository } from '../js/data/userRepository.js';
import { storedUser } from './fixtures/users.js';

describe('UserRepository', () => {
  it('saves a user and finds it by username key and id', async () => {
    const repository = new UserRepository(new MemoryStorageAdapter());
    const user = storedUser();

    await repository.add(user);

    assert.deepEqual(await repository.findByUsernameKey('anna'), user);
    assert.deepEqual(await repository.findById(user.id), user);
  });

  it('returns null when nothing matches', async () => {
    const repository = new UserRepository(new MemoryStorageAdapter());

    assert.equal(await repository.findByUsernameKey('nobody'), null);
    assert.equal(await repository.findById(storedUser().id), null);
  });

  it('keeps users added by another tab', async () => {
    const storage = new MemoryStorageAdapter();
    const firstTab = new UserRepository(storage);
    const secondTab = new UserRepository(storage);

    await firstTab.add(storedUser());
    await secondTab.add(
      storedUser({
        id: '7a1b2c3d-4e5f-4a6b-9c8d-0e1f2a3b4c5d',
        username: 'Ben',
        usernameKey: 'ben',
      }),
    );

    assert.notEqual(await firstTab.findByUsernameKey('anna'), null);
    assert.notEqual(await firstTab.findByUsernameKey('ben'), null);
  });

  it('ignores corrupted storage and invalid records', async (t) => {
    t.mock.method(console, 'warn', () => {});
    const storage = new MemoryStorageAdapter();
    const repository = new UserRepository(storage);

    storage.writeRaw(STORAGE_KEYS.users, '{broken');
    assert.equal(await repository.findByUsernameKey('anna'), null);

    storage.write(STORAGE_KEYS.users, [storedUser(), { username: 'Eve', usernameKey: 'eve' }]);
    assert.notEqual(await repository.findByUsernameKey('anna'), null);
    assert.equal(await repository.findByUsernameKey('eve'), null);
  });

  it('updates a stored user', async () => {
    const repository = new UserRepository(new MemoryStorageAdapter());
    await repository.add(storedUser());
    const changed = storedUser({
      passwordHash: storedUser().passwordHash.replace('600000', '700000'),
    });

    await repository.update(changed);

    assert.deepEqual(await repository.findById(changed.id), changed);
  });
});
