import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatcher } from '../js/worker/wordMatcher.js';

const BANNED_WORDS = ['Putin', 'Ukraine', 'Russia', 'War'];
const findBannedWords = buildMatcher(BANNED_WORDS);

describe('wordMatcher: must be blocked', () => {
  for (const [text, word] of [
    // Spec §12 table
    ['I hate war', 'War'],
    ['WAR', 'War'],
    ['wars', 'War'],
    ['warfare', 'War'],
    ['W.A.R', 'War'],
    ['w a r', 'War'],
    ['w-a-r', 'War'],
    ['Russian food', 'Russia'],
    ['RUSSIA', 'Russia'],
    ['Russ1a', 'Russia'],
    ['Ukrainian', 'Ukraine'],
    ['ukraine', 'Ukraine'],
    ['Putin', 'Putin'],
    ['p u t i n', 'Putin'],
    ['PUT1N', 'Putin'],
    // Implementation plan, Step 6
    ['Pu tin', 'Putin'],
    ['warrrr', 'War'],
    ['Russsia', 'Russia'],
    ['war!', 'War'],
    ["Ukraine's", 'Ukraine'],
    ['a w a r', 'War'],
    ['w@r', 'War'],
    ['Russ ia', 'Russia'],
    ['Ukr aine', 'Ukraine'],
    ['Russians', 'Russia'],
    ['warlord', 'War'],
    ['wartime', 'War'],
    ['warring', 'War'],
    ['Putinist', 'Putin'],
    ['Pütin', 'Putin'],
    // Cyrillic or Greek letters that look like Latin ones
    ['Рutin', 'Putin'],
    ['wаr', 'War'],
    ['Ukrаine', 'Ukraine'],
    ['Russiα', 'Russia'],
  ]) {
    it(`"${text}" → ${word}`, () => {
      assert.deepEqual(findBannedWords(text), [word]);
    });
  }
});

describe('wordMatcher: must be allowed', () => {
  for (const text of [
    'software',
    'award',
    'toward',
    'towards',
    'warm',
    'Warsaw',
    'warehouse',
    'put in',
    'I put in a lot of work',
    'I put in time and effort',
    'Put in red, then put in ring',
    'wares',
    'Waring',
    "puttin'",
    'Edward',
    'Warwick',
    'warfarin',
    'awkward',
    'warn',
    'warning',
    'reward',
    'swarm',
    'dwarf',
    'Tin can',
    'Rush hour',
    'a lovely day in 2026',
    '',
  ]) {
    it(`"${text}"`, () => {
      assert.deepEqual(findBannedWords(text), []);
    });
  }
});

describe('wordMatcher: other rules', () => {
  it('names every banned word once, in the order they appear', () => {
    assert.deepEqual(findBannedWords('I love Putin and w a r, WAR and Russ1a'), [
      'Putin',
      'War',
      'Russia',
    ]);
  });

  it('blocks harmless phrases with a real form of a banned word on purpose', () => {
    assert.deepEqual(findBannedWords('Star Wars'), ['War']);
    assert.deepEqual(findBannedWords('Russian doll'), ['Russia']);
  });

  it('applies every rule to a new word from the list, with no code change', () => {
    const withBelarus = buildMatcher([...BANNED_WORDS, 'Belarus']);

    assert.deepEqual(withBelarus('Belarusian'), ['Belarus']);
    assert.deepEqual(withBelarus('B e l a r u s'), ['Belarus']);
    assert.deepEqual(findBannedWords('Belarusian'), []);
  });

  it('ignores accents in the list itself', () => {
    assert.deepEqual(buildMatcher(['Kremľ'])('kreml'), ['Kremľ']);
  });
});
