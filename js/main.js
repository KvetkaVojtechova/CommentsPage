import { STORAGE_KEYS } from './config.js';
import { MESSAGES } from './messages.js';
import { EventBus } from './core/eventBus.js';
import { Store } from './core/store.js';
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

function start() {
  const notice = document.querySelector('[data-startup-notice]');
  const problem = findEnvironmentProblem();

  if (problem) {
    notice.textContent = problem;
    notice.classList.add('startup-notice--visible');
    return;
  }
  notice.remove();

  const store = new Store(new EventBus());
  new EmptyStateView(document.querySelector('[data-comments]'), store);

  store.setComments([]);
}

start();
