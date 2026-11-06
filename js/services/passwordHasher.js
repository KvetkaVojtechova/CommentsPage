/*
 * Password hashing with PBKDF2-HMAC-SHA-256 from the Web Crypto API (SEC-20 to SEC-24).
 * Stored format: pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>
 */
import { PBKDF2 } from '../config.js';

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

async function deriveHashHex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    PBKDF2.hashBytes * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

function parseStoredHash(stored) {
  const [algorithm, iterations, salt, hash, ...rest] = String(stored).split('$');
  if (
    algorithm !== PBKDF2.algorithm ||
    !/^\d+$/.test(iterations) ||
    !salt ||
    !hash ||
    rest.length
  ) {
    return null;
  }
  return { iterations: Number(iterations), salt, hash };
}

export function randomHex(byteLength) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/** Compares every character, so the time taken does not reveal where two hashes differ. */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * @param {string} password
 * @param {{ iterations?: number }} [options] Only tests use other settings.
 * @returns {Promise<{ passwordHash: string, salt: string }>}
 */
export async function hashPassword(password, { iterations = PBKDF2.iterations } = {}) {
  const salt = randomHex(PBKDF2.saltBytes);
  const hash = await deriveHashHex(password, salt, iterations);
  return { passwordHash: [PBKDF2.algorithm, iterations, salt, hash].join('$'), salt };
}

// A hash no password matches, used to spend the same time on an unknown username (SEC-27).
const DUMMY_HASH = [PBKDF2.algorithm, PBKDF2.iterations, '0'.repeat(32), '0'.repeat(64)].join('$');

/** Does the same work as verifyPassword and always fails. */
export async function dummyVerify(password) {
  await verifyPassword(password, DUMMY_HASH);
  return { ok: false, needsRehash: false };
}

/**
 * @returns {Promise<{ ok: boolean, needsRehash: boolean }>} `needsRehash` is true when the
 *   password is correct but was hashed with older settings (SEC-22).
 */
export async function verifyPassword(password, storedHash) {
  const stored = parseStoredHash(storedHash);
  if (!stored) {
    return { ok: false, needsRehash: false };
  }
  const actual = await deriveHashHex(password, stored.salt, stored.iterations);
  const ok = constantTimeEqual(actual, stored.hash);
  return { ok, needsRehash: ok && stored.iterations !== PBKDF2.iterations };
}
