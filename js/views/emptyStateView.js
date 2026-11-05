import { ASSETS } from '../config.js';
import { MESSAGES } from '../messages.js';
import { STORE_EVENTS } from '../core/store.js';
import { el } from '../utils/dom.js';

/** Shows the empty-state card while there are no comments. */
export class EmptyStateView {
  #root;
  #store;
  #card;

  constructor(root, store) {
    this.#root = root;
    this.#store = store;
    this.#card = el('div', { className: 'empty-state' }, [
      el('img', {
        className: 'empty-state__image',
        attrs: { src: ASSETS.emptyStateImage, alt: '', width: 200, height: 160 },
      }),
      el('p', { className: 'empty-state__title', text: MESSAGES.emptyState.title }),
      el('p', { className: 'empty-state__text', text: MESSAGES.emptyState.text }),
    ]);

    store.on(STORE_EVENTS.commentsLoaded, () => this.render());
    store.on(STORE_EVENTS.commentAdded, () => this.render());
  }

  render() {
    if (this.#store.state.comments.length === 0) {
      this.#root.prepend(this.#card);
    } else {
      this.#card.remove();
    }
  }
}
