import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LOCKOUT, STORAGE_KEYS } from '../js/config.js';
import { LoginAttemptRepository } from '../js/data/loginAttemptRepository.js';
import { MemoryStorageAdapter } from '../js/data/storageAdapter.js';

const NOW = Date.parse('2026-11-06T10:00:00Z');

describe('LoginAttemptRepository', () => {
  it('starts with no failures', async () => {
    const repository = new LoginAttemptRepository(new MemoryStorageAdapter());

    assert.deepEqual(await repository.get('anna'), {
      usernameKey: 'anna',
      failures: 0,
      lockLevel: 0,
      lockedUntil: 0,
    });
  });

  it('locks from the 5th failure on, for 30 s and then twice as long each time', async () => {
    const repository = new LoginAttemptRepository(new MemoryStorageAdapter());
    const waits = [];
    for (let i = 0; i < 8; i++) {
      const record = await repository.recordFailure('anna', NOW);
      waits.push((record.lockedUntil - NOW) / 1000);
    }

    assert.deepEqual(waits, [-NOW / 1000, -NOW / 1000, -NOW / 1000, -NOW / 1000, 30, 60, 120, 240]);
  });

  it('never waits longer than 15 minutes', async () => {
    const repository = new LoginAttemptRepository(new MemoryStorageAdapter());
    let record;
    for (let i = 0; i < 20; i++) {
      record = await repository.recordFailure('anna', NOW);
    }

    assert.equal(record.lockedUntil - NOW, LOCKOUT.maxWaitMs);
  });

  it('keeps names apart and resets one of them', async () => {
    const repository = new LoginAttemptRepository(new MemoryStorageAdapter());
    await repository.recordFailure('anna', NOW);
    await repository.recordFailure('ben', NOW);

    await repository.reset('anna');

    assert.equal((await repository.get('anna')).failures, 0);
    assert.equal((await repository.get('ben')).failures, 1);
  });

  it('treats "__proto__" as an ordinary name', async () => {
    const storage = new MemoryStorageAdapter();
    const repository = new LoginAttemptRepository(storage);

    await repository.recordFailure('__proto__', NOW);

    assert.equal((await repository.get('__proto__')).failures, 1);
    assert.equal(Object.prototype.failures, undefined);
    assert.equal(Array.isArray(storage.read(STORAGE_KEYS.loginAttempts)), true);
  });

  it('keeps at most the most recent names', async () => {
    const storage = new MemoryStorageAdapter();
    const repository = new LoginAttemptRepository(storage);
    for (let i = 0; i <= LOCKOUT.maxTrackedNames; i++) {
      await repository.recordFailure(`name${i}`, NOW);
    }

    assert.equal(storage.read(STORAGE_KEYS.loginAttempts).length, LOCKOUT.maxTrackedNames);
    assert.equal((await repository.get('name0')).failures, 0);
  });

  it('ignores damaged records', async (t) => {
    t.mock.method(console, 'warn', () => {});
    const storage = new MemoryStorageAdapter();
    storage.write(STORAGE_KEYS.loginAttempts, [
      { usernameKey: 'anna', failures: 'many', lockLevel: 0, lockedUntil: 0 },
    ]);

    assert.equal((await new LoginAttemptRepository(storage).get('anna')).failures, 0);
  });
});
