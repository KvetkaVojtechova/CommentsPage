import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseList, parseTabSession, parseUser } from '../js/data/schemas.js';
import { storedUser } from './fixtures/users.js';

describe('parseUser', () => {
  it('accepts a valid user', () => {
    assert.deepEqual(parseUser(storedUser()), storedUser());
  });

  it('copies only the known fields', () => {
    const parsed = parseUser({ ...storedUser(), isAdmin: true });

    assert.equal('isAdmin' in parsed, false);
  });

  it('ignores a __proto__ payload from JSON', () => {
    const raw = JSON.parse(
      `{"__proto__": {"isAdmin": true}, ${JSON.stringify(storedUser()).slice(1)}`,
    );
    const parsed = parseUser(raw);

    assert.notEqual(parsed, null);
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.equal(parsed.isAdmin, undefined);
  });

  for (const [description, overrides] of [
    ['an id that is not a UUID', { id: '42' }],
    ['an invalid username', { username: '<script>', usernameKey: '<script>' }],
    ['a usernameKey that does not match', { usernameKey: 'someone-else' }],
    ['a plain-text password', { passwordHash: 'secret password' }],
    ['a salt not used in the hash', { salt: 'f'.repeat(32) }],
    ['an invalid date', { createdAt: 'yesterday' }],
    ['a field of the wrong type', { username: 42 }],
  ]) {
    it(`rejects ${description}`, () => {
      assert.equal(parseUser(storedUser(overrides)), null);
    });
  }

  it('rejects values that are not objects', () => {
    for (const raw of [null, 'user', 42, [storedUser()]]) {
      assert.equal(parseUser(raw), null);
    }
  });
});

describe('parseTabSession', () => {
  const valid = { userId: storedUser().id, token: 'a'.repeat(64) };

  it('accepts a valid session and drops extra fields', () => {
    assert.deepEqual(parseTabSession({ ...valid, role: 'admin' }), valid);
  });

  it('rejects a bad userId or token', () => {
    assert.equal(parseTabSession({ ...valid, userId: 'x' }), null);
    assert.equal(parseTabSession({ ...valid, token: 'short' }), null);
  });
});

describe('parseList', () => {
  it('keeps valid records and warns about the rest', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const users = parseList([storedUser(), { id: 'broken' }], parseUser, 'user');

    assert.deepEqual(users, [storedUser()]);
    assert.equal(warn.mock.callCount(), 1);
  });

  it('returns an empty list for missing or non-array data', (t) => {
    t.mock.method(console, 'warn', () => {});

    assert.deepEqual(parseList(null, parseUser, 'user'), []);
    assert.deepEqual(parseList({ length: 1 }, parseUser, 'user'), []);
  });
});
