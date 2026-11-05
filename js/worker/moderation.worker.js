/*
 * Checks one comment for banned words (FR-30 to FR-38). The page starts a new worker for
 * every check and stops it after the answer. Messages have a fixed shape (SEC-31):
 *   in:  { type: 'check', requestId, text }
 *   out: { type: 'result', requestId, blocked, words } or { type: 'error', requestId, reason }
 */
import { buildMatcher } from './wordMatcher.js';

const WORDS_URL = new URL('../../data/banned-words.json', import.meta.url);
const MAX_WORDS = 100;

function isCheckRequest(data) {
  return (
    typeof data === 'object' &&
    data !== null &&
    data.type === 'check' &&
    typeof data.requestId === 'string' &&
    typeof data.text === 'string'
  );
}

/** SEC-32: an array of 1–100 non-empty strings. */
function isWordList(value) {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_WORDS &&
    value.every((word) => typeof word === 'string' && word.trim() !== '')
  );
}

async function loadBannedWords() {
  // A relative URL keeps the request on the same origin; credentials never leave it either.
  const response = await fetch(WORDS_URL, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Loading the banned words failed with HTTP ${response.status}.`);
  }
  const words = await response.json();
  if (!isWordList(words)) {
    throw new Error('The banned-words file is not a list of 1–100 words.');
  }
  return words;
}

self.addEventListener('message', async (event) => {
  const request = event.data;
  if (!isCheckRequest(request)) {
    return;
  }
  try {
    const findBannedWords = buildMatcher(await loadBannedWords());
    const words = findBannedWords(request.text);
    self.postMessage({
      type: 'result',
      requestId: request.requestId,
      blocked: words.length > 0,
      words,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: request.requestId,
      reason: String(error.message),
    });
  }
});
