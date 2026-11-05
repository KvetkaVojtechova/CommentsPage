import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isIsoDate,
  isUuid,
  normaliseCommentText,
  normaliseUsername,
  toUsernameKey,
  validateCommentText,
  validatePassword,
  validateUsername,
} from '../js/utils/validators.js';

describe('validateUsername', () => {
  it('accepts 3–20 letters, digits, _ . and -', () => {
    for (const username of ['Ann', 'anna_1', 'a.b-c', 'x'.repeat(20)]) {
      assert.deepEqual(validateUsername(username), { ok: true, code: null }, username);
    }
  });

  it('requires a username', () => {
    assert.equal(validateUsername('').code, 'usernameRequired');
    assert.equal(validateUsername(undefined).code, 'usernameRequired');
  });

  it('accepts Slovak and other accented Latin letters', () => {
    for (const username of ['Ľubomír', 'Šťastný', 'Žofia_1', 'Ďurčo', 'ôsmy.ŕ']) {
      assert.equal(validateUsername(username).ok, true, username);
    }
  });

  it('rejects wrong lengths and characters', () => {
    for (const username of ['ab', 'x'.repeat(21), 'anna smith', '<script>', 'anna@home', 'a✓b']) {
      assert.equal(validateUsername(username).code, 'usernameInvalid', username);
    }
  });

  it('rejects look-alike letters from other alphabets', () => {
    for (const username of ['Аnna', 'Annα', 'Ivanі']) {
      assert.equal(validateUsername(username).code, 'usernameInvalid', username);
    }
  });
});

describe('normaliseUsername and toUsernameKey', () => {
  it('trims and normalises the same name typed in different ways', () => {
    assert.equal(normaliseUsername('  Ján '), 'Ján');
    assert.equal(normaliseUsername('Ａnna'), 'Anna');
  });

  it('builds a case-insensitive key', () => {
    assert.equal(toUsernameKey('Anna'), toUsernameKey('anna'));
    assert.equal(toUsernameKey('ĽUBO'), toUsernameKey('ľubo'));
  });

  it('keeps names that differ only in accents apart', () => {
    assert.notEqual(toUsernameKey('Ján'), toUsernameKey('Jan'));
  });
});

describe('validatePassword', () => {
  const twelve = 'abcdefghijkl';

  it('accepts 12–128 characters, including spaces, entered twice', () => {
    assert.equal(validatePassword(twelve, twelve).ok, true);
    assert.equal(validatePassword(' '.repeat(12), ' '.repeat(12)).ok, true);
    assert.equal(validatePassword('x'.repeat(128), 'x'.repeat(128)).ok, true);
  });

  it('rejects passwords that are too short or too long', () => {
    assert.equal(validatePassword('short', 'short').code, 'passwordTooShort');
    assert.equal(validatePassword('x'.repeat(129), 'x'.repeat(129)).code, 'passwordTooLong');
  });

  it('rejects entries that do not match', () => {
    assert.equal(validatePassword(twelve, `${twelve}!`).code, 'passwordMismatch');
  });
});

describe('normaliseCommentText and validateCommentText', () => {
  it('trims and removes control characters but keeps line breaks and tabs', () => {
    assert.equal(normaliseCommentText('  Hi\u0000 there\r\n\tyou \n'), 'Hi there\n\tyou');
  });

  it('accepts 1–500 characters', () => {
    assert.equal(validateCommentText('a').ok, true);
    assert.equal(validateCommentText('x'.repeat(500)).ok, true);
  });

  it('rejects empty and too long text', () => {
    assert.equal(validateCommentText('').code, 'commentEmpty');
    assert.equal(validateCommentText(normaliseCommentText('  \n ')).code, 'commentEmpty');
    assert.equal(validateCommentText('x'.repeat(501)).code, 'commentTooLong');
  });
});

describe('isUuid and isIsoDate', () => {
  it('recognise valid values', () => {
    assert.equal(isUuid('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e'), true);
    assert.equal(isIsoDate('2026-11-05T18:00:00.000Z'), true);
  });

  it('reject invalid values', () => {
    assert.equal(isUuid('not-a-uuid'), false);
    assert.equal(isUuid(42), false);
    assert.equal(isIsoDate('2026-13-45T99:00:00.000Z'), false);
    assert.equal(isIsoDate('5 Nov 2026'), false);
  });
});
