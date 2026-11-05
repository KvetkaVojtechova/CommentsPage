import { LIMITS } from '../config.js';

// Letters of the Latin alphabet only, accented ones included ("Ľubomír"), so look-alike
// letters from other alphabets (Cyrillic "а" for "a") cannot imitate another username.
const USERNAME_PATTERN = new RegExp(
  `^(?:(?=\\p{L})\\p{Script=Latin}|[0-9_.-]){${LIMITS.username.min},${LIMITS.username.max}}$`,
  'u',
);
// Control characters except line breaks and tabs, e.g. invisible codes pasted from other apps.
const CONTROL_CHARACTERS = /[^\P{Cc}\n\t]/gu;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

const VALID = Object.freeze({ ok: true, code: null });

function invalid(code) {
  return { ok: false, code };
}

/**
 * Trims the username and normalises it with NFKC, so the same name typed on different
 * keyboards ("á" as one or two characters, full-width letters) is stored the same way.
 */
export function normaliseUsername(username) {
  return String(username ?? '')
    .trim()
    .normalize('NFKC');
}

/** FR-04: 3–20 characters, letters, digits, _ . and - only. Expects a normalised username. */
export function validateUsername(username) {
  if (typeof username !== 'string' || username.length === 0) {
    return invalid('usernameRequired');
  }
  return USERNAME_PATTERN.test(username) ? VALID : invalid('usernameInvalid');
}

/** FR-05 / SEC-25: 12–128 characters, any characters allowed, entered twice. */
export function validatePassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < LIMITS.password.min) {
    return invalid('passwordTooShort');
  }
  if (password.length > LIMITS.password.max) {
    return invalid('passwordTooLong');
  }
  return password === confirmation ? VALID : invalid('passwordMismatch');
}

/** Usernames are unique regardless of case ("Anna" = "anna", "ĽUBO" = "ľubo"). */
export function toUsernameKey(username) {
  return normaliseUsername(username).toLowerCase();
}

/** Removes control characters (SEC-06) and surrounding whitespace. */
export function normaliseCommentText(text) {
  return String(text ?? '')
    .replace(CONTROL_CHARACTERS, '')
    .trim();
}

/** FR-25: 1–500 characters after trimming. Expects normalised text. */
export function validateCommentText(text) {
  if (typeof text !== 'string' || text.length < LIMITS.comment.min) {
    return invalid('commentEmpty');
  }
  return text.length <= LIMITS.comment.max ? VALID : invalid('commentTooLong');
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isIsoDate(value) {
  return (
    typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
  );
}
