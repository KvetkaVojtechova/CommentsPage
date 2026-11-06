import { UI } from '../config.js';
import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { buildCommentTree } from '../utils/buildCommentTree.js';
import { el } from '../utils/dom.js';
import { createCommentElement, refreshTime } from './commentView.js';
import { ComposerView } from './composerView.js';

/** Finds the node of one comment in the tree, for "Continue this thread". */
function findTreeNode(nodes, commentId) {
  for (const node of nodes) {
    if (node.comment.id === commentId) {
      return node;
    }
    const found = findTreeNode(node.children, commentId);
    if (found) {
      return found;
    }
  }
  return null;
}

// Broken stored data is left out of the tree (FR-27); the console says so.
function warnAboutHiddenComments(comments, tree) {
  const shown = tree.reduce((sum, node) => sum + 1 + node.descendantCount, 0);
  if (shown < comments.length) {
    console.warn(
      `${comments.length - shown} stored comment(s) are not shown: their parent is missing, they form a loop or they are nested too deeply.`,
    );
  }
}

/**
 * The comment tree as nested lists, one card per top-level comment and its replies.
 * A Map from comment id to its elements lets a new comment, the reply box or a collapse be
 * applied in place, without searching the page or drawing everything again (SEC-03).
 *
 * Large threads stay readable (spec 4.4, D-14): replies can be hidden, only the first few
 * replies of a comment are shown at first, replies from level 6 say whom they answer, and
 * a branch deeper than level 10 opens on its own.
 */
export class CommentTreeView {
  #store;
  #handlers;
  #list;
  #backButton;
  /**
   * @type {Map<string, {
   *   comment: object, item: HTMLElement, article: HTMLElement, actions: HTMLElement,
   *   replyButton: HTMLElement | null, time: HTMLTimeElement, depth: number,
   *   replies: HTMLElement | null, toggle: HTMLElement | null, more: HTMLElement | null,
   *   continueButton: HTMLElement | null, hiddenChildren: object[], descendantCount: number,
   * }>}
   */
  #nodes = new Map();
  // Replies posted on this page stay visible even beyond the first few.
  #postedHere = new Set();
  #focusId = null;
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
   *   toggleThread: (commentId: string) => void,
   *   showAllReplies: (commentId: string) => void,
   *   focusThread: (commentId: string) => void,
   *   clearFocus: () => void,
   * }} handlers
   */
  constructor(root, store, handlers) {
    this.#store = store;
    this.#handlers = handlers;
    this.#list = el('ul', { className: 'comment-list' });
    this.#backButton = el('button', {
      className: 'btn btn--link comments__back',
      text: MESSAGES.thread.backToAll,
      attrs: { type: 'button' },
      on: { click: () => handlers.clearFocus() },
    });
    root.append(this.#list);

    store.on(STORE_EVENTS.commentsLoaded, () => this.render());
    // Reply buttons and "You" labels depend on who is logged in.
    store.on(STORE_EVENTS.userChanged, () => this.render());
    store.on(STORE_EVENTS.commentAdded, (comment) => this.#insert(comment));
    store.on(STORE_EVENTS.uiChanged, () => this.#onUiChanged());
  }

  /**
   * Draws the whole tree, e.g. after another tab saved a comment. An open reply box is moved
   * over with its draft and focus, and the comment at the top of the screen stays in place.
   */
  render() {
    const { comments, ui } = this.#store.state;
    const anchor = this.#findScrollAnchor();
    const focusedInput = this.#replySlot?.contains(document.activeElement)
      ? document.activeElement
      : null;
    this.#nodes.clear();

    const tree = buildCommentTree(comments);
    const focused = ui.focusId ? findTreeNode(tree, ui.focusId) : null;
    this.#focusId = focused ? ui.focusId : null;

    if (focused) {
      const parent = comments.find((comment) => comment.id === focused.comment.parentId);
      this.#list.before(this.#backButton);
      this.#list.replaceChildren(this.#renderNode(focused, 0, parent?.authorName ?? null));
    } else {
      this.#backButton.remove();
      this.#list.replaceChildren(...tree.map((node) => this.#renderNode(node, 0, null)));
      warnAboutHiddenComments(comments, tree);
    }

    this.#keepReplyBox(focusedInput);
    this.#renderReplyBox();
    this.#restoreScroll(anchor);
  }

  /** Updates every "40 min ago"; called once a minute. */
  refreshTimes(now = new Date()) {
    for (const node of this.#nodes.values()) {
      refreshTime(node.time, now);
    }
  }

  // The first comment visible at the top of the screen and where it is. At the very top of
  // the page there is no anchor, so new comments there come into view.
  #findScrollAnchor() {
    if (window.scrollY === 0) {
      return null;
    }
    for (const [id, node] of this.#nodes) {
      const { top, bottom } = node.article.getBoundingClientRect();
      if (bottom > 0) {
        return { id, top };
      }
    }
    return null;
  }

  #restoreScroll(anchor) {
    const article = anchor && this.#nodes.get(anchor.id)?.article;
    if (article) {
      window.scrollBy(0, article.getBoundingClientRect().top - anchor.top);
    }
  }

  #keepReplyBox(focusedInput) {
    const node = this.#nodes.get(this.#replyTargetId);
    if (!node) {
      this.#closeReplyBox({ restoreFocus: false });
      return;
    }
    node.article.after(this.#replySlot);
    node.replyButton?.setAttribute('aria-expanded', 'true');
    focusedInput?.focus({ preventScroll: true });
  }

  #renderNode(treeNode, depth, replyingTo) {
    const node = this.#createNode(treeNode.comment, depth, replyingTo);
    node.descendantCount = treeNode.descendantCount;
    this.#renderChildren(node, treeNode.children);
    return node.item;
  }

  #createNode(comment, depth, replyingTo) {
    const parts = createCommentElement(comment, this.#store.state.currentUser, {
      onReply: () => this.#handlers.openReply(comment.id),
      replyingTo,
    });
    const item = el('li', { className: depth === 0 ? 'comment-thread' : 'comment-reply' }, [
      parts.element,
    ]);
    const node = {
      comment,
      item,
      article: parts.element,
      actions: parts.actions,
      replyButton: parts.replyButton,
      time: parts.time,
      depth,
      replies: null,
      toggle: null,
      more: null,
      continueButton: null,
      hiddenChildren: [],
      descendantCount: 0,
    };
    this.#nodes.set(comment.id, node);
    return node;
  }

  /** From level 6 on, the indentation stops growing, so a reply names the comment it answers. */
  #replyingToFor(parent) {
    return parent.depth + 1 >= UI.indentCapLevel ? parent.comment.authorName : null;
  }

  #renderChildren(node, children) {
    if (children.length === 0) {
      return;
    }
    if (node.depth >= UI.continueThreadAfter) {
      this.#addContinueButton(node);
      return;
    }

    const showAll = this.#store.state.ui.expanded.has(node.comment.id);
    const first = showAll ? children : children.slice(0, UI.repliesPreview);
    const rest = showAll ? [] : children.slice(UI.repliesPreview);
    const list = this.#repliesOf(node);

    list.append(...first.map((child) => this.#renderChild(node, child)));
    node.hiddenChildren = rest.filter((child) => !this.#postedHere.has(child.comment.id));
    if (node.hiddenChildren.length > 0) {
      this.#addMoreButton(node);
    }
    for (const child of rest.filter((child) => this.#postedHere.has(child.comment.id))) {
      list.append(this.#renderChild(node, child));
    }
    this.#renderToggle(node);
  }

  #renderChild(parent, child) {
    return this.#renderNode(child, parent.depth + 1, this.#replyingToFor(parent));
  }

  /** The list of replies under a comment, with its "Hide replies" button. */
  #repliesOf(node) {
    if (!node.replies) {
      const isFlat = node.depth + 1 > UI.indentCapLevel;
      node.replies = el('ul', {
        className: `comment-list comment-list--replies${isFlat ? ' comment-list--flat' : ''}`,
      });
      node.item.append(node.replies);
      node.toggle = el('button', {
        className: 'btn btn--link comment__toggle',
        attrs: { type: 'button' },
        on: { click: () => this.#handlers.toggleThread(node.comment.id) },
      });
      node.actions.append(node.toggle);
    }
    return node.replies;
  }

  #renderToggle(node) {
    if (!node.toggle) {
      return;
    }
    const collapsed = this.#store.state.ui.collapsed.has(node.comment.id);
    node.replies.hidden = collapsed;
    node.toggle.setAttribute('aria-expanded', String(!collapsed));
    node.toggle.textContent = collapsed
      ? MESSAGES.thread.showReplies(node.descendantCount)
      : MESSAGES.thread.hideReplies;
  }

  #addMoreButton(node) {
    const hiddenCount = node.hiddenChildren.reduce(
      (sum, child) => sum + 1 + child.descendantCount,
      0,
    );
    node.more = el('li', { className: 'comment-more' }, [
      el('button', {
        className: 'btn btn--link',
        text: MESSAGES.thread.showMoreReplies(hiddenCount),
        attrs: { type: 'button' },
        on: { click: () => this.#handlers.showAllReplies(node.comment.id) },
      }),
    ]);
    node.replies.append(node.more);
  }

  // Draws the hidden replies where the "Show N more replies" button was.
  #revealHiddenReplies(node) {
    const hadFocus = node.more.contains(document.activeElement);
    const items = node.hiddenChildren.map((child) => this.#renderChild(node, child));
    node.more.replaceWith(...items);
    node.more = null;
    node.hiddenChildren = [];
    // Keyboard users continue at the first reply that was hidden.
    if (hadFocus) {
      items[0]?.querySelector('button')?.focus();
    }
  }

  #addContinueButton(node) {
    if (node.continueButton) {
      return;
    }
    node.continueButton = el('button', {
      className: 'btn btn--link',
      text: MESSAGES.thread.continueThread,
      attrs: { type: 'button' },
      on: { click: () => this.#handlers.focusThread(node.comment.id) },
    });
    node.actions.append(node.continueButton);
  }

  // Inserts one new comment in place: a top-level comment first, a reply last under its parent.
  #insert(comment) {
    if (comment.parentId === null) {
      if (!this.#focusId) {
        this.#list.prepend(this.#createNode(comment, 0, null).item);
      }
      return;
    }
    const parent = this.#nodes.get(comment.parentId);
    if (!parent) {
      return;
    }
    this.#postedHere.add(comment.id);
    this.#countNewReply(parent);
    if (parent.depth >= UI.continueThreadAfter) {
      this.#addContinueButton(parent);
      return;
    }
    const child = this.#createNode(comment, parent.depth + 1, this.#replyingToFor(parent));
    this.#repliesOf(parent).append(child.item);
    this.#renderToggle(parent);
  }

  /** Keeps "Show N replies" right on the parent and every comment above it. */
  #countNewReply(parent) {
    for (let node = parent; node; node = this.#nodes.get(node.comment.parentId)) {
      node.descendantCount += 1;
      this.#renderToggle(node);
    }
  }

  #onUiChanged() {
    const { ui } = this.#store.state;
    if (ui.focusId !== this.#focusId) {
      const previousFocus = this.#focusId;
      this.render();
      this.#moveFocusAfterThreadChange(previousFocus);
      return;
    }
    for (const node of this.#nodes.values()) {
      this.#renderToggle(node);
      if (node.more && ui.expanded.has(node.comment.id)) {
        this.#revealHiddenReplies(node);
      }
    }
    this.#renderReplyBox();
  }

  // After "Continue this thread" focus moves to "Back"; after "Back", to where the user was.
  #moveFocusAfterThreadChange(previousFocus) {
    const target = this.#focusId
      ? this.#backButton
      : this.#nodes.get(previousFocus)?.continueButton;
    target?.focus();
    target?.scrollIntoView({ block: 'center' });
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
