import { STORE_EVENTS } from '../core/store.js';
import { el } from '../utils/dom.js';
import { createCommentElement } from './commentView.js';

/** The list of comments, newest first. Step 4 turns it into a tree of replies. */
export class CommentTreeView {
  #store;
  #list;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   */
  constructor(root, store) {
    this.#store = store;
    this.#list = el('ul', { className: 'comment-list' });
    root.append(this.#list);

    store.on(STORE_EVENTS.commentsLoaded, () => this.render());
    // The "You" labels depend on who is logged in.
    store.on(STORE_EVENTS.userChanged, () => this.render());
    // A new comment is inserted on its own, without drawing the whole list again.
    store.on(STORE_EVENTS.commentAdded, (comment) => this.#list.prepend(this.#createItem(comment)));
  }

  render() {
    const newestFirst = [...this.#store.state.comments].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    this.#list.replaceChildren(...newestFirst.map((comment) => this.#createItem(comment)));
  }

  #createItem(comment) {
    return el('li', { className: 'comment-thread' }, [
      createCommentElement(comment, this.#store.state.currentUser),
    ]);
  }
}
