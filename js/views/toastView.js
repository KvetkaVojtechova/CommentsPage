import { UI } from '../config.js';
import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { el } from '../utils/dom.js';

/** "Comment posted": a short confirmation after each post, also read out by screen readers. */
export class ToastView {
  #toast;
  #hideTimer = null;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   */
  constructor(root, store) {
    // The status element exists from the start, so screen readers announce every new message.
    this.#toast = el('p', { className: 'toast', attrs: { role: 'status' } });
    root.append(this.#toast);
    store.on(STORE_EVENTS.commentAdded, () => this.show(MESSAGES.toast.commentPosted));
  }

  show(message) {
    clearTimeout(this.#hideTimer);
    this.#toast.textContent = message;
    this.#toast.classList.add('toast--visible');
    this.#hideTimer = setTimeout(() => {
      this.#toast.classList.remove('toast--visible');
      this.#toast.textContent = '';
    }, UI.toastMs);
  }
}
