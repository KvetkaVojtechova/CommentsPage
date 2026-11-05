import { LIMITS } from '../config.js';
import { COMPOSER_ERROR_KEY } from '../controllers/commentController.js';
import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { el } from '../utils/dom.js';
import { normaliseCommentText } from '../utils/validators.js';

const INPUT_ID = 'comment-text';

/** The comment box, shown only to logged-in users (FR-11). */
export class ComposerView {
  #root;
  #store;
  #handlers;
  #busy = false;

  #form;
  #input;
  #counter;
  #submit;
  #error;

  /**
   * @param {HTMLElement} root
   * @param {import('../core/store.js').Store} store
   * @param {{ submit: (text: string) => Promise<boolean>, clearError: () => void }} handlers
   */
  constructor(root, store, handlers) {
    this.#root = root;
    this.#store = store;
    this.#handlers = handlers;
    this.#build();

    store.on(STORE_EVENTS.userChanged, () => this.render());
    store.on(STORE_EVENTS.commentsLoaded, () => this.#renderPlaceholder());
    store.on(STORE_EVENTS.commentAdded, () => this.#renderPlaceholder());
    store.on(STORE_EVENTS.uiChanged, () => this.#renderError());
  }

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

  #build() {
    this.#input = el('textarea', {
      className: 'composer__input',
      attrs: {
        id: INPUT_ID,
        name: 'text',
        rows: 3,
        maxlength: LIMITS.comment.max,
        'aria-describedby': `${INPUT_ID}-counter ${INPUT_ID}-error`,
      },
      dataset: { commentInput: '' },
      on: { input: () => this.#onInput() },
    });
    this.#counter = el('span', {
      className: 'composer__counter',
      attrs: { id: `${INPUT_ID}-counter` },
    });
    this.#submit = el('button', {
      className: 'btn btn--add',
      text: MESSAGES.composer.submit,
      attrs: { type: 'submit' },
    });
    this.#error = el('p', {
      className: 'composer__error',
      attrs: { id: `${INPUT_ID}-error`, role: 'alert', hidden: true },
    });

    this.#form = el(
      'form',
      {
        className: 'composer__form',
        attrs: { novalidate: true },
        on: { submit: (event) => this.#onSubmit(event) },
      },
      [
        el('label', {
          className: 'visually-hidden',
          text: MESSAGES.composer.label,
          attrs: { for: INPUT_ID },
        }),
        this.#input,
        this.#error,
        el('div', { className: 'composer__footer' }, [this.#counter, this.#submit]),
      ],
    );
    this.#renderState();
    this.#renderPlaceholder();
  }

  #onInput() {
    this.#renderState();
    if (!this.#error.hidden) {
      this.#handlers.clearError();
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
      if (await this.#handlers.submit(text)) {
        this.#input.value = '';
      }
    } finally {
      this.#busy = false;
      this.#renderState();
      this.#input.focus();
    }
  }

  // Add Comment stays disabled while the text is empty or only whitespace (FR-25).
  #renderState() {
    this.#counter.textContent = MESSAGES.composer.counter(this.#input.value.length);
    this.#submit.disabled = this.#busy || normaliseCommentText(this.#input.value) === '';
  }

  #renderPlaceholder() {
    const isFirst = this.#store.state.comments.length === 0;
    this.#input.placeholder = isFirst
      ? MESSAGES.composer.placeholderFirst
      : MESSAGES.composer.placeholder;
  }

  #renderError() {
    const message = this.#store.state.ui.errors.get(COMPOSER_ERROR_KEY);
    this.#error.textContent = message ?? '';
    this.#error.hidden = !message;
  }
}
