import { LIMITS } from '../config.js';
import { commentErrorKey } from '../controllers/commentController.js';
import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { el } from '../utils/dom.js';
import { normaliseCommentText } from '../utils/validators.js';

let replyBoxCount = 0;

/**
 * A comment box. Without a parentId it is the box at the top of the page, shown only to
 * logged-in users (FR-11). With a parentId it is an inline reply box with a Cancel button.
 */
export class ComposerView {
  #root;
  #store;
  #handlers;
  #parentId;
  #busy = false;
  #unsubscribes = [];

  #form;
  #input;
  #counter;
  #submit;
  #error;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   * @param {{
   *   submit: (parentId: string | null, text: string) => Promise<boolean>,
   *   clearError: (parentId: string | null) => void,
   *   cancel?: () => void,
   * }} handlers `cancel` is needed for a reply box.
   * @param {{ parentId?: string | null }} [options]
   */
  constructor(root, store, handlers, { parentId = null } = {}) {
    this.#root = root;
    this.#store = store;
    this.#handlers = handlers;
    this.#parentId = parentId;
    this.#build();
    this.#listen(STORE_EVENTS.uiChanged, () => this.#renderError());

    if (this.#isReply) {
      root.append(this.#form);
      this.#input.focus();
    } else {
      this.#listen(STORE_EVENTS.userChanged, () => this.render());
      this.#listen(STORE_EVENTS.commentsLoaded, () => this.#renderPlaceholder());
      this.#listen(STORE_EVENTS.commentAdded, () => this.#renderPlaceholder());
    }
  }

  get #isReply() {
    return this.#parentId !== null;
  }

  /** Shows or hides the top comment box for the current user. */
  render() {
    if (this.#store.state.currentUser) {
      this.#root.append(this.#form);
    } else {
      // A draft never carries over to the next person who logs in on this tab.
      this.#form.remove();
      this.#input.value = '';
      this.#renderState();
    }
  }

  /** Removes a reply box and stops listening to the Store. */
  destroy() {
    for (const unsubscribe of this.#unsubscribes) {
      unsubscribe();
    }
    this.#form.remove();
  }

  #listen(event, handler) {
    this.#unsubscribes.push(this.#store.on(event, handler));
  }

  #build() {
    const inputId = this.#isReply ? `reply-text-${++replyBoxCount}` : 'comment-text';
    this.#input = el('textarea', {
      className: 'composer__input',
      attrs: {
        id: inputId,
        name: 'text',
        rows: 3,
        maxlength: LIMITS.comment.max,
        'aria-describedby': `${inputId}-counter ${inputId}-error`,
      },
      dataset: { commentInput: '' },
      on: { input: () => this.#onInput() },
    });
    this.#counter = el('span', {
      className: 'composer__counter',
      attrs: { id: `${inputId}-counter` },
    });
    this.#submit = el('button', {
      className: 'btn btn--add',
      text: MESSAGES.composer.submit,
      attrs: { type: 'submit' },
    });
    this.#error = el('p', {
      className: 'composer__error',
      attrs: { id: `${inputId}-error`, role: 'alert', hidden: true },
    });

    const buttons = this.#isReply
      ? [
          el('button', {
            className: 'btn btn--secondary',
            text: MESSAGES.composer.cancel,
            attrs: { type: 'button' },
            on: { click: () => this.#handlers.cancel() },
          }),
          this.#submit,
        ]
      : [this.#submit];

    this.#form = el(
      'form',
      {
        className: this.#isReply ? 'composer__form composer__form--reply' : 'composer__form',
        attrs: { novalidate: true },
        on: {
          submit: (event) => this.#onSubmit(event),
          keydown: (event) => this.#onKeydown(event),
        },
      },
      [
        el('label', {
          className: 'visually-hidden',
          text: this.#isReply ? MESSAGES.composer.replyLabel : MESSAGES.composer.label,
          attrs: { for: inputId },
        }),
        this.#input,
        this.#error,
        el('div', { className: 'composer__footer' }, [
          this.#counter,
          el('div', { className: 'composer__buttons' }, buttons),
        ]),
      ],
    );
    this.#renderState();
    this.#renderPlaceholder();
  }

  #onInput() {
    this.#renderState();
    if (!this.#error.hidden) {
      this.#handlers.clearError(this.#parentId);
    }
  }

  #onKeydown(event) {
    if (this.#isReply && event.key === 'Escape') {
      event.preventDefault();
      this.#handlers.cancel();
    }
  }

  async #onSubmit(event) {
    event.preventDefault();
    if (this.#submit.disabled) {
      return;
    }
    // The text is read once, so exactly what was checked is saved (SEC-33).
    const text = this.#input.value;

    this.#busy = true;
    this.#renderState();
    try {
      if (await this.#handlers.submit(this.#parentId, text)) {
        this.#input.value = '';
      }
    } finally {
      this.#busy = false;
      this.#renderState();
      // A reply box is gone after a successful reply.
      if (this.#form.isConnected) {
        this.#input.focus();
      }
    }
  }

  // Add Comment stays disabled while the text is empty or only whitespace (FR-25).
  #renderState() {
    this.#counter.textContent = MESSAGES.composer.counter(this.#input.value.length);
    this.#submit.disabled = this.#busy || normaliseCommentText(this.#input.value) === '';
  }

  #renderPlaceholder() {
    if (this.#isReply) {
      this.#input.placeholder = MESSAGES.composer.replyPlaceholder;
      return;
    }
    const isFirst = this.#store.state.comments.length === 0;
    this.#input.placeholder = isFirst
      ? MESSAGES.composer.placeholderFirst
      : MESSAGES.composer.placeholder;
  }

  #renderError() {
    const message = this.#store.state.ui.errors.get(commentErrorKey(this.#parentId));
    this.#error.textContent = message ?? '';
    this.#error.hidden = !message;
  }
}
