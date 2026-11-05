import { authErrorKey } from '../controllers/authController.js';
import { STORE_EVENTS } from '../core/store.js';
import { MESSAGES } from '../messages.js';
import { LIMITS } from '../config.js';
import { el } from '../utils/dom.js';

const MODE_TEXT = Object.freeze({
  login: {
    title: MESSAGES.auth.loginTitle,
    submit: MESSAGES.auth.loginSubmit,
    busy: MESSAGES.auth.loginBusy,
    switchPrompt: MESSAGES.auth.toRegisterPrompt,
    switchAction: MESSAGES.auth.toRegisterAction,
    switchTo: 'register',
    passwordAutocomplete: 'current-password',
  },
  register: {
    title: MESSAGES.auth.registerTitle,
    submit: MESSAGES.auth.registerSubmit,
    busy: MESSAGES.auth.registerBusy,
    switchPrompt: MESSAGES.auth.toLoginPrompt,
    switchAction: MESSAGES.auth.toLoginAction,
    switchTo: 'login',
    passwordAutocomplete: 'new-password',
  },
});

function createField(name, label, inputAttrs) {
  const inputId = `auth-${name}`;
  const errorId = `${inputId}-error`;
  const input = el('input', {
    className: 'field__input',
    attrs: { id: inputId, name, required: true, 'aria-describedby': errorId, ...inputAttrs },
  });
  const error = el('p', { className: 'field__error', attrs: { id: errorId, hidden: true } });
  const wrapper = el('div', { className: 'field' }, [
    el('label', { className: 'field__label', text: label, attrs: { for: inputId } }),
    input,
    error,
  ]);
  return { wrapper, input, error };
}

function showError(target, message) {
  target.textContent = message ?? '';
  target.hidden = !message;
}

/**
 * The login / registration modal: a native <dialog>, which traps focus and closes on Escape.
 * It also closes with × or a click on the backdrop, and returns focus to the button that opened it.
 */
export class AuthModalView {
  #store;
  #handlers;
  #mode = null;
  #busy = false;
  #opener = null;
  #pointerDownOnBackdrop = false;

  #dialog;
  #title;
  #form;
  #formError;
  #fields;
  #submit;
  #switchPrompt;
  #switchButton;

  /**
   * @param {HTMLElement} root Where the dialog element is attached.
   * @param {import('../core/store.js').Store} store
   * @param {{
   *   openAuth: (mode: 'login' | 'register') => void,
   *   closeAuth: () => void,
   *   submitLogin: (values: { username: string, password: string }) => Promise<void>,
   *   submitRegister: (values: { username: string, password: string, confirmation: string }) => Promise<void>,
   * }} handlers
   */
  constructor(root, store, handlers) {
    this.#store = store;
    this.#handlers = handlers;
    this.#build();
    root.append(this.#dialog);
    store.on(STORE_EVENTS.uiChanged, () => this.render());
  }

  render() {
    const { modal, errors } = this.#store.state.ui;
    if (!modal) {
      if (this.#dialog.open) {
        this.#dialog.close();
      }
      return;
    }

    const modeChanged = modal !== this.#mode;
    this.#mode = modal;
    if (modeChanged) {
      this.#applyMode();
    }
    this.#renderErrors(errors);

    if (!this.#dialog.open) {
      this.#opener = document.activeElement;
      this.#dialog.showModal();
      this.#fields.username.input.focus();
    } else if (modeChanged) {
      this.#fields.username.input.focus();
    }
  }

  #build() {
    this.#title = el('h2', { className: 'modal__title', attrs: { id: 'auth-title' } });
    this.#formError = el('p', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    this.#fields = {
      username: createField('username', MESSAGES.auth.username, {
        type: 'text',
        autocomplete: 'username',
        autocapitalize: 'none',
        spellcheck: 'false',
        maxlength: LIMITS.username.max,
      }),
      password: createField('password', MESSAGES.auth.password, {
        type: 'password',
        maxlength: LIMITS.password.max,
      }),
      confirmation: createField('confirmation', MESSAGES.auth.confirmation, {
        type: 'password',
        autocomplete: 'new-password',
        maxlength: LIMITS.password.max,
      }),
    };
    this.#submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } });
    this.#switchPrompt = el('span');
    this.#switchButton = el('button', {
      className: 'btn btn--link',
      attrs: { type: 'button' },
      on: { click: () => this.#handlers.openAuth(MODE_TEXT[this.#mode].switchTo) },
    });

    this.#form = el(
      'form',
      {
        className: 'auth-form',
        attrs: { novalidate: true },
        on: { submit: (event) => this.#onSubmit(event) },
      },
      [
        this.#formError,
        this.#fields.username.wrapper,
        this.#fields.password.wrapper,
        this.#fields.confirmation.wrapper,
        this.#submit,
      ],
    );

    this.#dialog = el(
      'dialog',
      {
        className: 'modal',
        attrs: { 'aria-labelledby': 'auth-title' },
        on: {
          pointerdown: (event) => {
            this.#pointerDownOnBackdrop = event.target === this.#dialog;
          },
          click: (event) => this.#onClick(event),
          close: () => this.#onClose(),
        },
      },
      [
        el('div', { className: 'modal__panel' }, [
          el('div', { className: 'modal__header' }, [
            this.#title,
            el('button', {
              className: 'modal__close',
              text: '×',
              attrs: { type: 'button', 'aria-label': MESSAGES.auth.close },
              on: { click: () => this.#handlers.closeAuth() },
            }),
          ]),
          this.#form,
          el('p', { className: 'modal__switch' }, [this.#switchPrompt, ' ', this.#switchButton]),
        ]),
      ],
    );
  }

  #applyMode() {
    const text = MODE_TEXT[this.#mode];
    const isRegister = this.#mode === 'register';
    const { password, confirmation } = this.#fields;

    this.#title.textContent = text.title;
    this.#submit.textContent = this.#busy ? text.busy : text.submit;
    this.#switchPrompt.textContent = text.switchPrompt;
    this.#switchButton.textContent = text.switchAction;
    password.input.setAttribute('autocomplete', text.passwordAutocomplete);
    confirmation.wrapper.hidden = !isRegister;
    confirmation.input.disabled = !isRegister;
    this.#clearPasswords();
  }

  #renderErrors(errors) {
    for (const [name, field] of Object.entries(this.#fields)) {
      const message = errors.get(authErrorKey(name))?.message;
      showError(field.error, message);
      if (message) {
        field.input.setAttribute('aria-invalid', 'true');
      } else {
        field.input.removeAttribute('aria-invalid');
      }
    }
    showError(this.#formError, errors.get(authErrorKey('form'))?.message);
  }

  async #onSubmit(event) {
    event.preventDefault();
    if (this.#busy) {
      return;
    }
    const { username, password, confirmation } = this.#fields;
    const values = {
      username: username.input.value,
      password: password.input.value,
      confirmation: confirmation.input.value,
    };

    this.#setBusy(true);
    try {
      if (this.#mode === 'register') {
        await this.#handlers.submitRegister(values);
      } else {
        await this.#handlers.submitLogin(values);
      }
    } finally {
      this.#clearPasswords();
      this.#setBusy(false);
      this.#focusAfterError();
    }
  }

  #setBusy(busy) {
    this.#busy = busy;
    this.#submit.disabled = busy;
    this.#form.setAttribute('aria-busy', String(busy));
    if (this.#mode) {
      this.#submit.textContent = busy ? MODE_TEXT[this.#mode].busy : MODE_TEXT[this.#mode].submit;
    }
  }

  #focusAfterError() {
    if (!this.#dialog.open) {
      return;
    }
    const invalid = Object.values(this.#fields).find((field) =>
      field.input.hasAttribute('aria-invalid'),
    );
    if (invalid) {
      invalid.input.focus();
    } else if (!this.#formError.hidden) {
      this.#fields.password.input.focus();
    }
  }

  #onClick(event) {
    // A click on the backdrop targets the dialog itself; the panel covers everything else.
    if (event.target === this.#dialog && this.#pointerDownOnBackdrop) {
      this.#handlers.closeAuth();
    }
  }

  // Runs for every way of closing, including Escape, which the browser handles itself.
  // The event is dispatched later, so it is ignored if the dialog was opened again meanwhile.
  #onClose() {
    if (this.#dialog.open) {
      return;
    }
    this.#mode = null;
    this.#form.reset();
    if (this.#store.state.ui.modal) {
      this.#handlers.closeAuth();
    }
    if (this.#opener?.isConnected) {
      this.#opener.focus();
    }
    this.#opener = null;
  }

  #clearPasswords() {
    this.#fields.password.input.value = '';
    this.#fields.confirmation.input.value = '';
  }
}
