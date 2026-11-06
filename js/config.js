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

// SEC-28: after 5 failed logins the next try waits 30 s, doubling each time up to 15 min.
export const LOCKOUT = Object.freeze({
  freeAttempts: 5,
  baseWaitMs: 30_000,
  maxWaitMs: 15 * 60_000,
  // Enough for many names; old entries drop out so storage cannot be filled up.
  maxTrackedNames: 200,
});

// SEC-29: a session ends after 30 minutes without activity, after 8 hours at most, on logout
// or when the tab closes. Activity is written at most once a minute.
export const SESSION = Object.freeze({
  tokenBytes: 32,
  idleMs: 30 * 60_000,
  maxAgeMs: 8 * 60 * 60_000,
  activityWriteMs: 60_000,
  checkIntervalMs: 60_000,
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
