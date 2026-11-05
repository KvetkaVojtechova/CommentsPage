import { STORAGE_KEYS } from './config.js';
import { MESSAGES } from './messages.js';
import { EventBus } from './core/eventBus.js';
import { Store } from './core/store.js';
import { WebStorageAdapter } from './data/storageAdapter.js';
import { UserRepository } from './data/userRepository.js';
import { SessionRepository } from './data/sessionRepository.js';
import { AuthService } from './services/authService.js';
import { AuthController } from './controllers/authController.js';
import { HeaderView } from './views/headerView.js';
import { AuthModalView } from './views/authModalView.js';
import { EmptyStateView } from './views/emptyStateView.js';

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

  const authService = new AuthService({
    userRepository: new UserRepository(new WebStorageAdapter(localStorage)),
    sessionRepository: new SessionRepository(new WebStorageAdapter(sessionStorage)),
  });
  const store = new Store(new EventBus());
  const authController = new AuthController({ authService, store });

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
  new EmptyStateView(document.querySelector('[data-comments]'), store);

  await authController.restore();
  store.setComments([]);
}

start().catch((error) => console.error('The page could not start:', error));
