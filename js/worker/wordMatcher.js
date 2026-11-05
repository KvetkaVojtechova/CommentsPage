/*
 * Finds banned words in a comment. Pure functions without DOM access, so they run in the
 * worker and in Node tests. The text goes through four stages:
 * normalise → split into tokens → build candidates → match against every form of each word.
 * Step 6 extends the stages to catch disguised forms ("W.A.R", "Russ1a", "Pu tin").
 */

/** Brings the text into one form for comparison. */
function normalise(text) {
  return text.toLowerCase();
}

/** Splits the text into words: runs of letters and digits. */
function tokenise(text) {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** The pieces of text that are compared with the banned forms, in text order. */
function candidates(tokens) {
  return tokens;
}

/**
 * Every accepted form of each banned word, mapped back to the word as written in the list,
 * so the message can name it ("War"). For now: the word itself and its plural with "s".
 */
function buildVariants(words) {
  const variants = new Map();
  for (const word of words) {
    const base = normalise(word);
    for (const form of [base, `${base}s`]) {
      if (!variants.has(form)) {
        variants.set(form, word);
      }
    }
  }
  return variants;
}

/**
 * @param {string[]} words The banned words, e.g. ["Putin", "Ukraine", "Russia", "War"].
 * @returns {(text: string) => string[]} Finds every banned word in the text, each once, in
 *   the order they appear and as written in the list. Whole words only, so "software" or
 *   "award" never match "war".
 */
export function buildMatcher(words) {
  const variants = buildVariants(words);

  return function findBannedWords(text) {
    const found = new Set();
    for (const candidate of candidates(tokenise(normalise(text)))) {
      const word = variants.get(candidate);
      if (word) {
        found.add(word);
      }
    }
    return [...found];
  };
}
