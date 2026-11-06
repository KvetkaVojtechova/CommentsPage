import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  constantTimeEqual,
  dummyVerify,
  hashPassword,
  randomHex,
  sha256Hex,
  verifyPassword,
} from '../js/services/passwordHasher.js';

const PASSWORD = 'correct horse battery';

describe('passwordHasher', () => {
  it('stores a versioned PBKDF2 hash that does not contain the password', async () => {
    const { passwordHash, salt } = await hashPassword(PASSWORD);

    assert.match(passwordHash, /^pbkdf2-sha256\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(passwordHash.split('$')[2], salt);
    assert.equal(passwordHash.includes(PASSWORD), false);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const { passwordHash } = await hashPassword(PASSWORD);

    assert.deepEqual(await verifyPassword(PASSWORD, passwordHash), {
      ok: true,
      needsRehash: false,
    });
    assert.equal((await verifyPassword('wrong password!', passwordHash)).ok, false);
  });

  it('uses a new salt every time', async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.passwordHash, second.passwordHash);
  });

  it('normalises the password with NFKC', async () => {
    const composed = 'café password';
    const decomposed = 'café password';
    const { passwordHash } = await hashPassword(composed);

    assert.equal((await verifyPassword(decomposed, passwordHash)).ok, true);
  });

  it('asks for a re-hash when the stored hash used older settings', async () => {
    const { passwordHash } = await hashPassword(PASSWORD, { iterations: 1000 });

    assert.match(passwordHash, /^pbkdf2-sha256\$1000\$/);
    assert.deepEqual(await verifyPassword(PASSWORD, passwordHash), { ok: true, needsRehash: true });
  });

  it('dummyVerify always fails', async () => {
    assert.deepEqual(await dummyVerify(PASSWORD), { ok: false, needsRehash: false });
  });

  it('rejects a stored value in an unknown format', async () => {
    assert.equal((await verifyPassword(PASSWORD, 'plain text')).ok, false);
  });
});

describe('helpers', () => {
  it('constantTimeEqual compares whole strings', () => {
    assert.equal(constantTimeEqual('abc', 'abc'), true);
    assert.equal(constantTimeEqual('abc', 'abd'), false);
    assert.equal(constantTimeEqual('abc', 'abcd'), false);
  });

  it('randomHex returns two hex characters per byte', () => {
    assert.match(randomHex(16), /^[0-9a-f]{32}$/);
    assert.notEqual(randomHex(16), randomHex(16));
  });

  it('sha256Hex matches a known digest', async () => {
    assert.equal(
      await sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
