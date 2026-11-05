export const STORAGE_KEYS = Object.freeze({
  users: 'commentsPage.v1.users',
  comments: 'commentsPage.v1.comments',
  sessions: 'commentsPage.v1.sessions',
  loginAttempts: 'commentsPage.v1.loginAttempts',
  session: 'commentsPage.v1.session',
  probe: 'commentsPage.v1.probe',
});

export const LIMITS = Object.freeze({
  username: Object.freeze({ min: 3, max: 20 }),
  password: Object.freeze({ min: 12, max: 128 }),
});

export const PBKDF2 = Object.freeze({
  algorithm: 'pbkdf2-sha256',
  iterations: 600_000,
  saltBytes: 16,
  hashBytes: 32,
});

export const SESSION = Object.freeze({
  tokenBytes: 32,
});

export const ASSETS = Object.freeze({
  emptyStateImage: 'assets/empty-state.svg',
});
