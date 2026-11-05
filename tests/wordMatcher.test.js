import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatcher } from '../js/worker/wordMatcher.js';

const findBannedWords = buildMatcher(['Putin', 'Ukraine', 'Russia', 'War']);

describe('wordMatcher (basic forms)', () => {
  for (const [text, word] of [
    ['I hate war', 'War'],
    ['WAR', 'War'],
    ['wars', 'War'],
    ['RUSSIA', 'Russia'],
    ['ukraine', 'Ukraine'],
    ['Putin.', 'Putin'],
    ['no more war!', 'War'],
  ]) {
    it(`blocks "${text}" as ${word}`, () => {
      assert.deepEqual(findBannedWords(text), [word]);
    });
  }

  for (const text of ['software', 'award', 'toward', 'warm', 'Warsaw', 'A lovely day', '']) {
    it(`allows "${text}"`, () => {
      assert.deepEqual(findBannedWords(text), []);
    });
  }

  it('names every banned word once, in the order they appear', () => {
    assert.deepEqual(findBannedWords('I love Putin and war, war, WAR and Russia'), [
      'Putin',
      'War',
      'Russia',
    ]);
  });

  it('works for any word in the list', () => {
    assert.deepEqual(buildMatcher(['Kremlin'])('the kremlin'), ['Kremlin']);
  });
});
