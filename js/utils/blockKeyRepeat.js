/*
 * Holding down a key in a comment box types it only once (FR-40 to FR-43). Editing and
 * navigation keys (Backspace, Delete, arrows, Home, End, Page Up/Down) still repeat, and
 * shortcuts with Ctrl, Cmd or Alt, pasting and the login fields are not affected.
 */

/** A held-down printable key or Enter; never while an input method is composing text. */
function isBlockedRepeat(event) {
  return (
    event.repeat &&
    !event.isComposing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    (event.key.length === 1 || event.key === 'Enter')
  );
}

/**
 * Adds one delegated listener, so reply boxes created later are covered as well.
 * @param {HTMLElement} root
 * @param {string} selector The comment text fields, e.g. "textarea[data-comment-input]".
 */
export function attachKeyRepeatGuard(root, selector) {
  root.addEventListener('keydown', (event) => {
    if (event.target.matches(selector) && isBlockedRepeat(event)) {
      event.preventDefault();
    }
  });
}
