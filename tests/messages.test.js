import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES } from '../js/messages.js';

describe('blocked-word message', () => {
  const { blockedWords } = MESSAGES.errors;

  it('names one word as in the assignment', () => {
    assert.equal(blockedWords(['War']), 'You cannot use the word “War” in your comment.');
  });

  it('names every word when there are several', () => {
    assert.equal(
      blockedWords(['Putin', 'War']),
      'You cannot use the words “Putin” and “War” in your comment.',
    );
    assert.equal(
      blockedWords(['Putin', 'War', 'Russia']),
      'You cannot use the words “Putin”, “War” and “Russia” in your comment.',
    );
  });
});
