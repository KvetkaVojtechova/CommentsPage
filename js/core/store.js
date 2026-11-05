import { EventBus } from './eventBus.js';

export const STORE_EVENTS = Object.freeze({
  userChanged: 'user:changed',
  commentsLoaded: 'comments:loaded',
  commentAdded: 'comment:added',
  uiChanged: 'ui:changed',
});

function createInitialState() {
  return {
    currentUser: null,
    comments: [],
    ui: {
      modal: null,
      replyTargetId: null,
      checkingTargetId: null,
      errors: new Map(), // key → { message, kind }
      collapsed: new Set(),
      expanded: new Set(),
      focusId: null,
    },
  };
}

/**
 * The single source of truth for the page. Views read `state` and subscribe with `on`;
 * only controllers call the update methods.
 */
export class Store {
  #bus;
  #state = createInitialState();

  constructor(bus = new EventBus()) {
    this.#bus = bus;
  }

  /** Read-only for views: change it only through the methods below. */
  get state() {
    return this.#state;
  }

  on(type, handler) {
    return this.#bus.on(type, handler);
  }

  setUser(user) {
    this.#state.currentUser = user;
    // A guest cannot have a reply box open.
    if (!user) {
      this.#state.ui.replyTargetId = null;
    }
    this.#bus.emit(STORE_EVENTS.userChanged, user);
  }

  setComments(comments) {
    this.#state.comments = [...comments];
    this.#bus.emit(STORE_EVENTS.commentsLoaded, this.#state.comments);
  }

  addComment(comment) {
    this.#state.comments.push(comment);
    this.#bus.emit(STORE_EVENTS.commentAdded, comment);
  }

  /** @param {'login' | 'register'} mode */
  openModal(mode) {
    this.#state.ui.modal = mode;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  closeModal() {
    this.#state.ui.modal = null;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  /** Opens the reply box under one comment; only one is open at a time. */
  openReply(commentId) {
    this.#state.ui.replyTargetId = commentId;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  closeReply() {
    this.#state.ui.replyTargetId = null;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  /** Hides or shows all replies under a comment. */
  toggleCollapsed(commentId) {
    const { collapsed } = this.#state.ui;
    if (collapsed.has(commentId)) {
      collapsed.delete(commentId);
    } else {
      collapsed.add(commentId);
    }
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  /** Shows the replies hidden behind "Show N more replies". */
  showAllReplies(commentId) {
    this.#state.ui.expanded.add(commentId);
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  /** Shows only the branch that starts at this comment ("Continue this thread"). */
  focusThread(commentId) {
    this.#state.ui.focusId = commentId;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  clearFocus() {
    this.#state.ui.focusId = null;
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  /**
   * @param {string} key Where the message belongs, e.g. "auth.username".
   * @param {string} message
   * @param {'error' | 'blocked'} [kind] "blocked" is the orange banned-word message.
   */
  setError(key, message, kind = 'error') {
    this.#state.ui.errors.set(key, { message, kind });
    this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
  }

  clearError(key) {
    if (this.#state.ui.errors.delete(key)) {
      this.#bus.emit(STORE_EVENTS.uiChanged, this.#state.ui);
    }
  }
}
