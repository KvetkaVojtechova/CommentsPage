import { UI } from '../config.js';
import { MESSAGES } from '../messages.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const relativeFormat = new Intl.RelativeTimeFormat(UI.locale, { numeric: 'auto', style: 'short' });
const dateFormat = new Intl.DateTimeFormat(UI.locale, { dateStyle: 'medium' });
const fullFormat = new Intl.DateTimeFormat(UI.locale, { dateStyle: 'full', timeStyle: 'short' });

/**
 * How long ago a comment was posted: "just now", "40 min ago", "3 hr ago", "yesterday",
 * "3 days ago", and the date for anything older than a week.
 * @param {string} iso
 * @param {Date} [now]
 */
export function relativeTime(iso, now = new Date()) {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();

  // Also covers a timestamp slightly in the future, from a clock that is a little off.
  if (elapsed < MINUTE) {
    return MESSAGES.time.justNow;
  }
  if (elapsed < HOUR) {
    return relativeFormat.format(-Math.floor(elapsed / MINUTE), 'minute');
  }
  if (elapsed < DAY) {
    return relativeFormat.format(-Math.floor(elapsed / HOUR), 'hour');
  }
  if (elapsed < WEEK) {
    return relativeFormat.format(-Math.floor(elapsed / DAY), 'day');
  }
  return dateFormat.format(date);
}

/** The full local date and time, shown on hover: "Thursday, 5 November 2026 at 22:15". */
export function fullDateTime(iso) {
  return fullFormat.format(new Date(iso));
}
