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
  // The counter turns to the warning colour from `warnAt` characters.
  comment: Object.freeze({ min: 1, max: 500, warnAt: 450 }),
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

export const MODERATION = Object.freeze({
  // FR-36: a check that takes longer fails, and the comment is not saved.
  timeoutMs: 5_000,
});

export const UI = Object.freeze({
  locale: 'en-GB',
  // From this level on, replies stop indenting further (spec 4.4).
  indentCapLevel: 6,
  // Deeper replies are not drawn; this also stops broken data that loops (spec 5.3).
  maxDepth: 50,
  // Large threads (D-14): replies shown before "Show N more replies", and the level below
  // which a branch opens on its own via "Continue this thread".
  repliesPreview: 3,
  continueThreadAfter: 10,
  timeRefreshMs: 60_000,
  toastMs: 3_000,
});

export const ASSETS = Object.freeze({
  emptyStateImage: 'assets/empty-state.svg',
});
