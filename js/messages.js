import { LIMITS, UI } from './config.js';

const listFormat = new Intl.ListFormat(UI.locale, { type: 'conjunction' });

export const MESSAGES = Object.freeze({
  emptyState: Object.freeze({
    title: 'No comments yet',
    guestText: 'Be the first to start the conversation.',
    userText: 'Write the first comment above.',
    guestPrompt: 'Want to join the conversation? Log in at the top.',
  }),
  composer: Object.freeze({
    label: 'Your comment',
    placeholderFirst: 'Be the first to comment…',
    placeholder: 'Write a comment…',
    replyLabel: 'Your reply',
    replyPlaceholder: 'Write a reply…',
    submit: 'Add Comment',
    checkingButton: 'Checking…',
    checking: 'Checking your comment…',
    cancel: 'Cancel',
    counter: (length) => `${length} / ${LIMITS.comment.max}`,
  }),
  comment: Object.freeze({
    you: 'You',
    reply: 'Reply',
  }),
  startup: Object.freeze({
    fileProtocol: 'Please open this page through a local server or the live link (see README).',
    noWorker:
      'This browser cannot run Web Workers, which are needed to check comments. Please use the latest Chrome, Edge, Firefox or Safari.',
    noCrypto:
      'Secure login is not available here. Please open this page over HTTPS or on localhost.',
    noStorage:
      'This page needs browser storage. Please allow site data for this page and reload it.',
  }),
  header: Object.freeze({
    logIn: 'Log in',
    logOut: 'Log out',
  }),
  auth: Object.freeze({
    loginTitle: 'Log in',
    registerTitle: 'Create account',
    username: 'Username',
    password: 'Password',
    confirmation: 'Repeat password',
    loginSubmit: 'Log in',
    registerSubmit: 'Create account',
    loginBusy: 'Signing in…',
    registerBusy: 'Creating account…',
    toRegisterPrompt: 'No account yet?',
    toRegisterAction: 'Create account',
    toLoginPrompt: 'Already have an account?',
    toLoginAction: 'Log in',
    close: 'Close',
  }),
  errors: Object.freeze({
    usernameRequired: 'Please enter a username.',
    usernameInvalid: `Use ${LIMITS.username.min}–${LIMITS.username.max} characters: Latin letters (á, č, ž… are fine), digits, _ . or -`,
    usernameTaken: 'This username is already taken.',
    passwordRequired: 'Please enter your password.',
    passwordTooShort: `Password needs at least ${LIMITS.password.min} characters.`,
    passwordTooLong: `Password can have at most ${LIMITS.password.max} characters.`,
    passwordMismatch: 'The passwords do not match.',
    wrongCredentials: 'Wrong username or password.',
    loginRequired: 'Please log in again to post your comment.',
    blockedWords: (words) =>
      words.length === 1
        ? `You cannot use the word “${words[0]}” in your comment.`
        : `You cannot use the words ${listFormat.format(words.map((word) => `“${word}”`))} in your comment.`,
    moderationFailed: 'We could not check your comment. Please try again.',
    parentMissing: 'The comment you are replying to no longer exists.',
    commentEmpty: 'Please write a comment first.',
    commentTooLong: `A comment can have at most ${LIMITS.comment.max} characters.`,
    storageFailed: 'This browser could not save your data. Please allow site data and try again.',
    unexpected: 'Something went wrong. Please try again.',
  }),
});
