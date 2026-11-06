import { LIMITS, UI } from '../config.js';
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
  #showChecking = false;
  #draftOwnerId = null;
  #unsubscribes = [];

  #form;
  #input;
  #counter;
  #submit;
  #status;
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
    const user = this.#store.state.currentUser;
    if (!user) {
      // The draft stays, so it is still there if the same person logs in again.
      this.#form.remove();
      return;
    }
    // A draft never carries over to a different person on this tab.
    if (this.#draftOwnerId !== null && this.#draftOwnerId !== user.id) {
      this.#input.value = '';
      this.#renderState();
    }
    this.#draftOwnerId = user.id;
    this.#root.append(this.#form);
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
    this.#status = el('p', { className: 'composer__status', attrs: { role: 'status' } });
    this.#error = el('p', {
      className: 'composer__error',
      attrs: { id: `${inputId}-error`, role: 'alert' },
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
        this.#status,
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
    if (this.#error.textContent) {
      this.#handlers.clearError(this.#parentId);
    }
  }

  // Enter adds a new line; Ctrl+Enter (Cmd+Enter on a Mac) submits (D-5).
  #onKeydown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.#form.requestSubmit();
    } else if (this.#isReply && event.key === 'Escape') {
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
    const checkingTimer = setTimeout(() => {
      this.#showChecking = true;
      this.#renderState();
    }, UI.checkingDelayMs);
    try {
      if (await this.#handlers.submit(this.#parentId, text)) {
        this.#input.value = '';
      }
    } finally {
      clearTimeout(checkingTimer);
      this.#busy = false;
      this.#showChecking = false;
      this.#renderState();
      // A reply box is gone after a successful reply.
      if (this.#form.isConnected) {
        this.#input.focus();
      }
    }
  }

  // Add Comment stays disabled while the text is empty or only whitespace (FR-25), and while
  // the check runs, so a double click cannot post twice (FR-37).
  #renderState() {
    const { length } = this.#input.value;
    this.#counter.textContent = MESSAGES.composer.counter(length);
    this.#counter.classList.toggle('composer__counter--warning', length >= LIMITS.comment.warnAt);
    this.#submit.disabled = this.#busy || normaliseCommentText(this.#input.value) === '';
    this.#submit.textContent = this.#showChecking
      ? MESSAGES.composer.checkingButton
      : MESSAGES.composer.submit;
    this.#status.textContent = this.#showChecking ? MESSAGES.composer.checking : '';
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

  // The message disappears as soon as the text is edited (FR-39), see #onInput.
  #renderError() {
    const error = this.#store.state.ui.errors.get(commentErrorKey(this.#parentId));
    this.#error.textContent = error?.message ?? '';
    if (error) {
      this.#input.setAttribute('aria-invalid', 'true');
    } else {
      this.#input.removeAttribute('aria-invalid');
    }
    this.#error.classList.toggle('composer__error--blocked', error?.kind === 'blocked');
  }
}
