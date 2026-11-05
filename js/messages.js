export const MESSAGES = Object.freeze({
  emptyState: Object.freeze({
    title: 'No comments yet',
    text: 'Be the first to start the conversation.',
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
});
