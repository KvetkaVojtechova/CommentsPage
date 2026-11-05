import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime } from '../js/utils/formatTime.js';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  for (const [label, iso, expected] of [
    ['under a minute', ago(30_000), 'just now'],
    ['a time slightly in the future', ago(-5_000), 'just now'],
    ['1 minute', ago(MINUTE), '1 min ago'],
    ['40 minutes', ago(40 * MINUTE), '40 min ago'],
    ['59 minutes', ago(59 * MINUTE + 59_000), '59 min ago'],
    ['1 hour', ago(HOUR), '1 hr ago'],
    ['3 hours', ago(3 * HOUR + 20 * MINUTE), '3 hr ago'],
    ['1 day', ago(DAY), 'yesterday'],
    ['3 days', ago(3 * DAY), '3 days ago'],
    ['8 days', ago(8 * DAY), '28 Oct 2026'],
  ]) {
    it(`${label} → "${expected}"`, () => {
      assert.equal(relativeTime(iso, NOW), expected);
    });
  }
});
