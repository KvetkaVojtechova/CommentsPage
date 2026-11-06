import { ASSETS } from '../config.js';
import { MESSAGES } from '../messages.js';
import { STORE_EVENTS } from '../core/store.js';
import { el } from '../utils/dom.js';

/**
 * The empty-state card while there are no comments, and the guest prompt card that
 * replaces the comment box for visitors who are not logged in.
 */
export class EmptyStateView {
  #commentsRoot;
  #composerRoot;
  #store;
  #card;
  #cardText;
  #guestPrompt;

  /**
   * @param {{ commentsRoot: HTMLElement, composerRoot: HTMLElement }} roots
   * @param {import('../core/store.js').Store} store
   */
  constructor({ commentsRoot, composerRoot }, store) {
    this.#commentsRoot = commentsRoot;
    this.#composerRoot = composerRoot;
    this.#store = store;

    this.#cardText = el('p', { className: 'empty-state__text' });
    this.#card = el('div', { className: 'empty-state' }, [
      el('img', {
        className: 'empty-state__image',
        attrs: { src: ASSETS.emptyStateImage, alt: '', width: 200, height: 160 },
      }),
      el('p', { className: 'empty-state__title', text: MESSAGES.emptyState.title }),
      this.#cardText,
    ]);
    this.#guestPrompt = el('p', {
      className: 'guest-prompt',
      text: MESSAGES.emptyState.guestPrompt,
    });

    for (const event of [
      STORE_EVENTS.commentsLoaded,
      STORE_EVENTS.commentAdded,
      STORE_EVENTS.userChanged,
    ]) {
      store.on(event, () => this.render());
    }
  }

  render() {
    const { comments, currentUser } = this.#store.state;
    const hasComments = comments.length > 0;

    if (hasComments) {
      this.#card.remove();
    } else {
      this.#cardText.textContent = currentUser
        ? MESSAGES.emptyState.userText
        : MESSAGES.emptyState.guestText;
      this.#commentsRoot.prepend(this.#card);
    }

    if (!currentUser && hasComments) {
      this.#composerRoot.append(this.#guestPrompt);
    } else {
      this.#guestPrompt.remove();
    }
  }
}
