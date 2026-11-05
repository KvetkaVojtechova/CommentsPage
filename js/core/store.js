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
      errors: new Map(),
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
}
