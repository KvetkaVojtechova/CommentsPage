/*
 * Finds banned words "in any form" without blocking ordinary words.
 * Pure functions without DOM access, so they run in the worker and in Node tests.
 * The text goes through four stages (see docs/technical-design.md):
 *   normalise → split into tokens → build candidates → match against every form of each word.
 * Matching is always exact on a whole candidate, never a search inside a word, so "software",
 * "award" or "Edward" can never match "war".
 */

// Cyrillic and Greek letters that look like Latin ones, e.g. "Рutin" written with a Cyrillic Р.
// prettier-ignore
const LOOK_ALIKES = new Map(
  Object.entries({
    а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't',
    у: 'y', х: 'x', і: 'i', ї: 'i', ј: 'j', ѕ: 's', α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k',
    ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  }),
);

// Digits and symbols used in place of letters, e.g. "Russ1a", "PUT1N", "w@r".
// prettier-ignore
const LEETSPEAK = new Map(
  Object.entries({
    0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'i',
  }),
);

// Short everyday words. Neighbours are only joined into one candidate when the first of them
// is not on this list: "Pu tin" becomes "putin", but "put in" or "put in time" never do.
// prettier-ignore
const COMMON_WORDS = new Set([
  'a', 'i', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it',
  'me', 'my', 'no', 'of', 'oh', 'ok', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'all', 'and', 'any', 'are', 'but', 'can', 'did', 'for', 'get', 'got', 'had', 'has', 'her',
  'him', 'his', 'how', 'its', 'let', 'not', 'now', 'one', 'our', 'out', 'put', 'say', 'see',
  'she', 'the', 'tin', 'too', 'two', 'was', 'way', 'who', 'why', 'yes', 'yet', 'you',
]);

const PLURAL_ES_ENDINGS = /(s|x|z|ch|sh)$/;
// prettier-ignore
const GENERIC_ENDINGS = [
  'ism', 'ist', 'ists', 'ring', 'red', 'fare', 'like', 'lord', 'lords',
  'monger', 'mongers', 'ship', 'ships', 'time', 'zone',
];
const NATIONALITY_ENDINGS = ['an', 'ans', 'ian', 'ians'];
const ENDS_WITH_VOWEL = /[aeiouy]$/;
const MIN_SPELLED_OUT = 3;
const MAX_JOINED_TOKENS = 3;

/** Same letters for the same word: no accents, lower case, no look-alike letters. */
function normalise(text) {
  return Array.from(
    text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(),
    (char) => LOOK_ALIKES.get(char) ?? char,
  ).join('');
}

// Marks where a word is split into parts. An invisible character that normalising keeps.
const PART_MARK = '\u2063';
const TOKEN_PATTERN = new RegExp(`[\\p{L}\\p{N}@$!|${PART_MARK}]+`, 'gu');

/**
 * Marks the parts of joined words before letter case is lost. Digits inside a word are left
 * alone, so leetspeak such as "Russ1a" still reads as one word.
 */
function markWordParts(text) {
  return (
    text
      // The same invisible character typed by the user still separates words.
      .replaceAll(PART_MARK, ' ')
      // "NoWar" → "No|War"
      .replace(/(\p{Ll})(?=\p{Lu})/gu, `$1${PART_MARK}`)
      // "NOWar" → "NO|War"
      .replace(/(\p{Lu})(?=\p{Lu}\p{Ll})/gu, `$1${PART_MARK}`)
      // "Ukraine2024" → "Ukraine|2024"
      .replace(/(\p{L})(?=\p{N}+(?![\p{L}\p{N}]))/gu, `$1${PART_MARK}`)
      // "2war" → "2|war"
      .replace(/(?<![\p{L}\p{N}])(\p{N}+)(?=\p{L})/gu, `$1${PART_MARK}`)
  );
}

function fromLeetspeak(text) {
  return Array.from(text, (char) => LEETSPEAK.get(char) ?? char).join('');
}

/**
 * Runs of letters, digits and @ $ ! |; symbols at the edges are dropped ("war!" → "war").
 * Each token keeps its marked parts, so "nowar" can also be checked as "no" and "war".
 */
function tokenise(text) {
  return (text.match(TOKEN_PATTERN) ?? [])
    .map((token) => token.replace(/^[@$!|]+|[@$!|]+$/g, ''))
    .map((token) => {
      const parts = token.split(PART_MARK).filter(Boolean).map(fromLeetspeak);
      return { text: fromLeetspeak(token.replaceAll(PART_MARK, '')), parts };
    })
    .filter((token) => token.text !== '');
}

/**
 * Every piece of text that is compared with the banned forms, in text order: each token and
 * the parts of a joined word ("NoWar"), letters spelled out one by one ("w a r", "W.A.R") and
 * split words ("Pu tin").
 */
function* candidates(tokenList) {
  const tokens = tokenList.map((token) => token.text);
  for (let start = 0; start < tokens.length; start++) {
    yield tokens[start];

    // Parts of a joined word are compared one by one, never joined in other ways.
    if (tokenList[start].parts.length > 1) {
      yield* tokenList[start].parts;
    }

    // Spelled-out letters: every run of 3 or more single-letter tokens starting here.
    let letters = '';
    for (let end = start; end < tokens.length && tokens[end].length === 1; end++) {
      letters += tokens[end];
      if (letters.length >= MIN_SPELLED_OUT) {
        yield letters;
      }
    }

    // Split words: 2 or 3 neighbours, unless they start with an ordinary word.
    if (!COMMON_WORDS.has(tokens[start])) {
      for (let count = 2; count <= MAX_JOINED_TOKENS && start + count <= tokens.length; count++) {
        yield tokens.slice(start, start + count).join('');
      }
    }
  }
}

/** "warrrr" → "war", "russsia" → "rusia": every run of a repeated letter becomes one letter. */
function collapseRepeats(text) {
  return text.replace(/(.)\1+/gu, '$1');
}

function hasTripleLetter(text) {
  return /(.)\1\1/u.test(text);
}

/** The accepted forms of one banned word. */
function formsOf(base) {
  const forms = [base, `${base}s`, ...GENERIC_ENDINGS.map((ending) => base + ending)];
  if (PLURAL_ES_ENDINGS.test(base)) {
    forms.push(`${base}es`);
  }
  forms.push(...NATIONALITY_ENDINGS.map((ending) => base + ending));
  if (ENDS_WITH_VOWEL.test(base)) {
    // "russia" → "russian", "ukraine" → "ukrainian". Only after a vowel, so "war" never
    // becomes "warn".
    forms.push(`${base}n`, `${base}ns`);
    forms.push(...NATIONALITY_ENDINGS.map((ending) => base.slice(0, -1) + ending));
  }
  return forms;
}

/**
 * Maps every form of each banned word, and its collapsed spelling, back to the word as
 * written in the list, so the message can name it ("War").
 */
function buildVariants(words) {
  const exact = new Map();
  const collapsed = new Map();
  for (const word of words) {
    for (const form of formsOf(normalise(word))) {
      if (!exact.has(form)) {
        exact.set(form, word);
      }
      if (!collapsed.has(collapseRepeats(form))) {
        collapsed.set(collapseRepeats(form), word);
      }
    }
  }
  return { exact, collapsed };
}

/**
 * @param {string[]} words The banned words, e.g. ["Putin", "Ukraine", "Russia", "War"].
 * @returns {(text: string) => string[]} Finds every banned word in the text, each once, in
 *   the order they appear and as written in the list.
 */
export function buildMatcher(words) {
  const { exact, collapsed } = buildVariants(words);

  // A stretched word ("warrrr") is compared without its repeated letters. Only with 3 or more
  // of the same letter in a row, so normal double letters ("Waring", "puttin'") never match.
  const match = (candidate) =>
    exact.get(candidate) ??
    (hasTripleLetter(candidate) ? collapsed.get(collapseRepeats(candidate)) : undefined);

  return function findBannedWords(text) {
    const found = new Set();
    for (const candidate of candidates(tokenise(normalise(markWordParts(text))))) {
      const word = match(candidate);
      if (word) {
        found.add(word);
      }
    }
    return [...found];
  };
}
