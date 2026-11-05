/*
 * The only way views create DOM (SEC-01/02): elements via createElement, text via textContent
 * and attributes from a whitelist. No HTML strings are ever parsed.
 */

const ALLOWED_ATTRIBUTES = new Set([
  'alt',
  'autocomplete',
  'datetime',
  'disabled',
  'for',
  'height',
  'hidden',
  'id',
  'maxlength',
  'minlength',
  'name',
  'placeholder',
  'required',
  'role',
  'rows',
  'src',
  'tabindex',
  'title',
  'type',
  'width',
]);

const ARIA_ATTRIBUTE = /^aria-[a-z]+$/;

function setAttribute(node, name, value) {
  if (ARIA_ATTRIBUTE.test(name)) {
    if (value !== null && value !== undefined) {
      node.setAttribute(name, String(value));
    }
    return;
  }
  if (!ALLOWED_ATTRIBUTES.has(name)) {
    throw new Error(`Attribute "${name}" is not allowed.`);
  }
  if (value === false || value === null || value === undefined) {
    return;
  }
  node.setAttribute(name, value === true ? '' : String(value));
}

/**
 * @param {string} tag
 * @param {{
 *   className?: string,
 *   text?: string,
 *   attrs?: Record<string, string | number | boolean | null | undefined>,
 *   dataset?: Record<string, string>,
 *   on?: Record<string, EventListener>,
 * }} [options] Boolean attributes: `true` sets them, `false` leaves them out.
 * @param {Array<Node | string>} [children] Strings are added as text nodes.
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
  const { className, text, attrs = {}, dataset = {}, on = {} } = options;
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  for (const [name, value] of Object.entries(attrs)) {
    setAttribute(node, name, value);
  }
  for (const [key, value] of Object.entries(dataset)) {
    node.dataset[key] = String(value);
  }
  for (const [type, handler] of Object.entries(on)) {
    node.addEventListener(type, handler);
  }
  node.append(...children);

  return node;
}

export function clear(node) {
  node.replaceChildren();
}
