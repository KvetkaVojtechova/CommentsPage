import { UI } from '../config.js';
import { STORE_EVENTS } from '../core/store.js';
import { buildCommentTree } from '../utils/buildCommentTree.js';
import { el } from '../utils/dom.js';
import { createCommentElement } from './commentView.js';
import { ComposerView } from './composerView.js';

/**
 * The comment tree as nested lists, one card per top-level comment and its replies.
 * A Map from comment id to its elements lets a new comment or the reply box be placed
 * without searching the page or drawing everything again (SEC-03).
 */
export class CommentTreeView {
  #store;
  #handlers;
  #list;
  /** @type {Map<string, { item: HTMLElement, article: HTMLElement, replyButton: HTMLElement | null, depth: number, replies: HTMLElement | null }>} */
  #nodes = new Map();
  #replyBox = null;
  #replySlot = null;
  #replyTargetId = null;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   * @param {{
   *   openReply: (commentId: string) => void,
   *   cancelReply: () => void,
   *   submit: (parentId: string | null, text: string) => Promise<boolean>,
   *   clearError: (parentId: string | null) => void,
   * }} handlers
   */
  constructor(root, store, handlers) {
    this.#store = store;
    this.#handlers = handlers;
    this.#list = el('ul', { className: 'comment-list' });
    root.append(this.#list);

    store.on(STORE_EVENTS.commentsLoaded, () => this.render());
    // Reply buttons and "You" labels depend on who is logged in.
    store.on(STORE_EVENTS.userChanged, () => this.render());
    store.on(STORE_EVENTS.commentAdded, (comment) => this.#insert(comment));
    store.on(STORE_EVENTS.uiChanged, () => this.#renderReplyBox());
  }

  render() {
    this.#closeReplyBox({ restoreFocus: false });
    this.#nodes.clear();
    const tree = buildCommentTree(this.#store.state.comments);
    this.#list.replaceChildren(...tree.map((node) => this.#renderNode(node)));
    this.#renderReplyBox();
  }

  #renderNode({ comment, depth, children }) {
    const item = this.#createItem(comment, depth);
    for (const child of children) {
      this.#repliesOf(comment.id).append(this.#renderNode(child));
    }
    return item;
  }

  #createItem(comment, depth) {
    const { element, replyButton } = createCommentElement(comment, this.#store.state.currentUser, {
      onReply: () => this.#handlers.openReply(comment.id),
    });
    const item = el('li', { className: depth === 0 ? 'comment-thread' : 'comment-reply' }, [
      element,
    ]);
    this.#nodes.set(comment.id, { item, article: element, replyButton, depth, replies: null });
    return item;
  }

  /** The list of replies under a comment, created when the first reply arrives. */
  #repliesOf(commentId) {
    const node = this.#nodes.get(commentId);
    if (!node.replies) {
      const isFlat = node.depth + 1 > UI.indentCapLevel;
      node.replies = el('ul', {
        className: `comment-list comment-list--replies${isFlat ? ' comment-list--flat' : ''}`,
      });
      node.item.append(node.replies);
    }
    return node.replies;
  }

  // Inserts one new comment in place: a top-level comment first, a reply last under its parent.
  #insert(comment) {
    if (comment.parentId === null) {
      this.#list.prepend(this.#createItem(comment, 0));
      return;
    }
    const parent = this.#nodes.get(comment.parentId);
    if (parent && parent.depth < UI.maxDepth) {
      this.#repliesOf(comment.parentId).append(this.#createItem(comment, parent.depth + 1));
    }
  }

  #renderReplyBox() {
    const { currentUser, ui } = this.#store.state;
    const targetId = currentUser ? ui.replyTargetId : null;
    if (targetId === this.#replyTargetId) {
      return;
    }
    this.#closeReplyBox({ restoreFocus: true });

    const node = this.#nodes.get(targetId);
    if (!node) {
      return;
    }
    this.#replyTargetId = targetId;
    this.#replySlot = el('div', { className: 'comment__reply-box' });
    node.article.after(this.#replySlot);
    node.replyButton?.setAttribute('aria-expanded', 'true');
    this.#replyBox = new ComposerView(
      this.#replySlot,
      this.#store,
      {
        submit: this.#handlers.submit,
        clearError: this.#handlers.clearError,
        cancel: this.#handlers.cancelReply,
      },
      { parentId: targetId },
    );
  }

  #closeReplyBox({ restoreFocus }) {
    if (!this.#replyBox) {
      return;
    }
    // While a reply is being saved, focus is on the disabled button, which the page may drop.
    const active = document.activeElement;
    const hadFocus = this.#replySlot.contains(active) || active === document.body;
    const node = this.#nodes.get(this.#replyTargetId);

    this.#replyBox.destroy();
    this.#replySlot.remove();
    this.#replyBox = null;
    this.#replySlot = null;
    this.#replyTargetId = null;

    node?.replyButton?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && hadFocus) {
      node?.replyButton?.focus();
    }
  }
}
