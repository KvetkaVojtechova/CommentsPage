import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseComment, parseList, parseTabSession, parseUser } from '../js/data/schemas.js';
import { storedComment } from './fixtures/comments.js';
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

describe('parseComment', () => {
  it('accepts a top-level comment and a reply', () => {
    assert.deepEqual(parseComment(storedComment()), storedComment());
    const reply = storedComment({ parentId: '1c2d3e4f-5a6b-4c7d-9e8f-a0b1c2d3e4f5' });
    assert.deepEqual(parseComment(reply), reply);
  });

  it('copies only the known fields', () => {
    const raw = JSON.parse(
      `{"__proto__": {"x": 1}, "html": "<b>", ${JSON.stringify(storedComment()).slice(1)}`,
    );
    const parsed = parseComment(raw);

    assert.deepEqual(Object.keys(parsed), Object.keys(storedComment()));
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  });

  for (const [description, overrides] of [
    ['an invalid id', { id: 'abc' }],
    ['an invalid parentId', { parentId: 'abc' }],
    ['a missing parentId', { parentId: undefined }],
    ['an invalid author name', { authorName: '<script>' }],
    ['empty text', { text: '' }],
    ['text over 500 characters', { text: 'x'.repeat(501) }],
    ['text with control characters', { text: 'hi\u0000' }],
    ['text that is not a string', { text: 42 }],
    ['an invalid date', { createdAt: 'now' }],
  ]) {
    it(`rejects ${description}`, () => {
      assert.equal(parseComment(storedComment(overrides)), null);
    });
  }
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
