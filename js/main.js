import { STORAGE_KEYS, UI } from './config.js';
import { MESSAGES } from './messages.js';
import { EventBus } from './core/eventBus.js';
import { Store } from './core/store.js';
import { WebStorageAdapter } from './data/storageAdapter.js';
import { UserRepository } from './data/userRepository.js';
import { SessionRepository } from './data/sessionRepository.js';
import { LoginAttemptRepository } from './data/loginAttemptRepository.js';
import { CommentRepository } from './data/commentRepository.js';
import { AuthService } from './services/authService.js';
import { CommentService } from './services/commentService.js';
import { ModerationService } from './services/moderationService.js';
import { AuthController } from './controllers/authController.js';
import { CommentController } from './controllers/commentController.js';
import { HeaderView } from './views/headerView.js';
import { AuthModalView } from './views/authModalView.js';
import { ComposerView } from './views/composerView.js';
import { CommentTreeView } from './views/commentTreeView.js';
import { EmptyStateView } from './views/emptyStateView.js';
import { ToastView } from './views/toastView.js';
import { attachKeyRepeatGuard } from './utils/blockKeyRepeat.js';

// A startup probe only; all other storage access goes through the data layer.
function canUseStorage() {
  try {
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem(STORAGE_KEYS.probe, '1');
      storage.removeItem(STORAGE_KEYS.probe);
    }
    return true;
  } catch {
    return false;
  }
}

/** @returns {string | null} A message for the user, or null when the page can run. */
function findEnvironmentProblem() {
  if (location.protocol === 'file:') {
    return MESSAGES.startup.fileProtocol;
  }
  if (typeof Worker !== 'function') {
    return MESSAGES.startup.noWorker;
  }
  if (!isSecureContext || !globalThis.crypto?.subtle) {
    return MESSAGES.startup.noCrypto;
  }
  if (!canUseStorage()) {
    return MESSAGES.startup.noStorage;
  }
  return null;
}

async function start() {
  const notice = document.querySelector('[data-startup-notice]');
  const problem = findEnvironmentProblem();

  if (problem) {
    notice.textContent = problem;
    notice.classList.add('startup-notice--visible');
    return;
  }
  notice.remove();

  const localStore = new WebStorageAdapter(localStorage);
  const authService = new AuthService({
    userRepository: new UserRepository(localStore),
    sessionRepository: new SessionRepository(new WebStorageAdapter(sessionStorage)),
    loginAttemptRepository: new LoginAttemptRepository(localStore),
  });
  const commentService = new CommentService({
    commentRepository: new CommentRepository(localStore),
    authService,
    moderationService: new ModerationService({
      createWorker: () =>
        new Worker(new URL('./worker/moderation.worker.js', import.meta.url), { type: 'module' }),
    }),
  });
  const store = new Store(new EventBus());
  const authController = new AuthController({ authService, store });
  const commentController = new CommentController({ commentService, store });

  const composerRoot = document.querySelector('[data-composer]');
  const commentsRoot = document.querySelector('[data-comments]');

  new HeaderView(document.querySelector('[data-auth-controls]'), store, {
    openAuth: () => authController.openAuth(),
    logout: () => authController.logout(),
  });
  new AuthModalView(document.body, store, {
    openAuth: (mode) => authController.openAuth(mode),
    closeAuth: () => authController.closeAuth(),
    submitLogin: (values) => authController.submitLogin(values),
    submitRegister: (values) => authController.submitRegister(values),
  });
  const commentHandlers = {
    submit: (parentId, text) => commentController.submit(parentId, text),
    clearError: (parentId) => commentController.clearError(parentId),
  };
  new ComposerView(composerRoot, store, commentHandlers);
  const commentTreeView = new CommentTreeView(commentsRoot, store, {
    ...commentHandlers,
    openReply: (commentId) => commentController.openReply(commentId),
    cancelReply: () => commentController.cancelReply(),
    toggleThread: (commentId) => commentController.toggleThread(commentId),
    showAllReplies: (commentId) => commentController.showAllReplies(commentId),
    focusThread: (commentId) => commentController.focusThread(commentId),
    clearFocus: () => commentController.clearFocus(),
  });
  new EmptyStateView({ commentsRoot, composerRoot }, store);
  new ToastView(document.body, store);
  attachKeyRepeatGuard(document.querySelector('main'), 'textarea[data-comment-input]');

  await authController.restore();
  await commentController.load();
  setInterval(() => commentTreeView.refreshTimes(), UI.timeRefreshMs);
}

start().catch((error) => console.error('The page could not start:', error));
