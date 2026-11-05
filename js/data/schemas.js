/*
 * Validates records read from storage (SEC-10/11). Each parser returns a new object that
 * contains only the known fields, so keys like __proto__ can never reach the app, or null.
 */
import { SESSION } from '../config.js';
import { isIsoDate, isUuid, toUsernameKey, validateUsername } from '../utils/validators.js';

const SALT_PATTERN = /^[0-9a-f]{32}$/;
const PASSWORD_HASH_PATTERN = /^[a-z0-9-]+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/;
const TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${SESSION.tokenBytes * 2}}$`);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseUser(raw) {
  if (!isRecord(raw)) {
    return null;
  }
  const { id, username, usernameKey, passwordHash, salt, createdAt } = raw;
  const isValid =
    isUuid(id) &&
    validateUsername(username).ok &&
    usernameKey === toUsernameKey(username) &&
    typeof salt === 'string' &&
    SALT_PATTERN.test(salt) &&
    typeof passwordHash === 'string' &&
    PASSWORD_HASH_PATTERN.test(passwordHash) &&
    passwordHash.includes(`$${salt}$`) &&
    isIsoDate(createdAt);

  return isValid ? { id, username, usernameKey, passwordHash, salt, createdAt } : null;
}

export function parseTabSession(raw) {
  if (!isRecord(raw)) {
    return null;
  }
  const { userId, token } = raw;
  const isValid = isUuid(userId) && typeof token === 'string' && TOKEN_PATTERN.test(token);
  return isValid ? { userId, token } : null;
}

/**
 * Parses a stored list. Invalid records are dropped with a warning; the rest still loads.
 * @template T
 * @param {unknown} raw
 * @param {(item: unknown) => T | null} parse
 * @param {string} name Used in the warning, e.g. "user".
 * @returns {T[]}
 */
export function parseList(raw, parse, name) {
  if (raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    console.warn(`Ignoring stored ${name} list: it is not an array.`);
    return [];
  }
  const records = raw.map(parse).filter((record) => record !== null);
  const dropped = raw.length - records.length;
  if (dropped > 0) {
    console.warn(`Ignored ${dropped} invalid ${name} record(s) in storage.`);
  }
  return records;
}
