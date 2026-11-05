const SALT = '0123456789abcdef0123456789abcdef';

/** A user record as it is stored, with a well-formed (not real) password hash. */
export function storedUser(overrides = {}) {
  return {
    id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
    username: 'Anna',
    usernameKey: 'anna',
    passwordHash: `pbkdf2-sha256$600000$${SALT}$${'ab'.repeat(32)}`,
    salt: SALT,
    createdAt: '2026-11-05T18:00:00.000Z',
    ...overrides,
  };
}
