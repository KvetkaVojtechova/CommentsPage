import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { clear, el } from '../utils/dom.js';

/** The account area in the header: "Log in" for guests, avatar, name and "Log out" for users. */
export class HeaderView {
  #root;
  #store;
  #handlers;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   * @param {{ openAuth: () => void, logout: () => void }} handlers
   */
  constructor(root, store, handlers) {
    this.#root = root;
    this.#store = store;
    this.#handlers = handlers;
    store.on(STORE_EVENTS.userChanged, () => this.render());
  }

  render() {
    // Keep keyboard focus in the header when its button is replaced.
    const hadFocus = this.#root.contains(document.activeElement);
    const user = this.#store.state.currentUser;

    clear(this.#root);
    const button = user ? this.#renderUser(user) : this.#renderGuest();
    if (hadFocus) {
      button.focus();
    }
  }

  #renderGuest() {
    const logIn = el('button', {
      className: 'btn btn--primary',
      text: MESSAGES.header.logIn,
      attrs: { type: 'button', 'aria-haspopup': 'dialog' },
      on: { click: () => this.#handlers.openAuth() },
    });
    this.#root.append(logIn);
    return logIn;
  }

  #renderUser(user) {
    const logOut = el('button', {
      className: 'btn btn--secondary',
      text: MESSAGES.header.logOut,
      attrs: { type: 'button' },
      on: { click: () => this.#handlers.logout() },
    });
    this.#root.append(
      el('span', { className: 'user-badge' }, [
        el('span', {
          className: 'avatar',
          text: user.username.charAt(0).toUpperCase(),
          attrs: { 'aria-hidden': 'true' },
        }),
        el('span', { className: 'user-badge__name', text: user.username }),
      ]),
      logOut,
    );
    return logOut;
  }
}
