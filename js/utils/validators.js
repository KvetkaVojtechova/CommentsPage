import { LIMITS } from '../config.js';
import { isCommonPassword } from '../services/commonPasswords.js';

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

/**
 * FR-05 / SEC-25: 12–128 characters, any characters allowed, not a common password, not
 * containing the username, entered twice.
 * @param {string} password
 * @param {string} confirmation
 * @param {string} [username]
 */
export function validatePassword(password, confirmation, username = '') {
  const ruleCheck = checkPasswordRules(password, username);
  if (!ruleCheck.ok) {
    return ruleCheck;
  }
  return password === confirmation ? VALID : invalid('passwordMismatch');
}

function checkPasswordRules(password, username) {
  if (typeof password !== 'string' || password.length < LIMITS.password.min) {
    return invalid('passwordTooShort');
  }
  if (password.length > LIMITS.password.max) {
    return invalid('passwordTooLong');
  }
  if (isCommonPassword(password)) {
    return invalid('passwordTooCommon');
  }
  const usernameKey = toUsernameKey(username);
  if (usernameKey && password.normalize('NFKC').toLowerCase().includes(usernameKey)) {
    return invalid('passwordContainsUsername');
  }
  return VALID;
}

const CHARACTER_KINDS = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u];

/**
 * A rough strength estimate for the hint under the password field (SEC-25). Length counts
 * most; a mix of character kinds helps a little. It never adds rules beyond validatePassword.
 * @returns {{ level: 'weak' | 'fair' | 'good' | 'strong', code: string | null }}
 *   `code` says why a password is weak, e.g. "passwordTooCommon".
 */
export function passwordStrength(password, username = '') {
  const check = checkPasswordRules(password, username);
  if (!check.ok) {
    return { level: 'weak', code: check.code };
  }
  const kinds = CHARACTER_KINDS.filter((kind) => kind.test(password)).length;
  if (password.length >= 20 || (password.length >= 16 && kinds >= 3)) {
    return { level: 'strong', code: null };
  }
  if (password.length >= 16 || kinds >= 3) {
    return { level: 'good', code: null };
  }
  return { level: 'fair', code: null };
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
