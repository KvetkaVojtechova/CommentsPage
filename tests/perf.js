import { EventBus } from '../js/core/eventBus.js';
import { Store } from '../js/core/store.js';
import { CommentTreeView } from '../js/views/commentTreeView.js';
import { generateComments } from './fixtures/generateComments.js';

// Spec, Performance: 1 000 comments draw in under 200 ms on a normal laptop.
const COUNT = 1_000;
const TARGET_MS = 200;

const result = document.querySelector('[data-result]');
const root = document.querySelector('[data-comments]');
const store = new Store(new EventBus());
new CommentTreeView(root, store, {});
const comments = generateComments(COUNT);

const start = performance.now();
store.setComments(comments);
// Reading a size forces style and layout, so they are part of the time.
root.getBoundingClientRect();
const elapsed = performance.now() - start;

const drawn = root.querySelectorAll('.comment').length;
const passed = drawn === COUNT && elapsed < TARGET_MS;
result.textContent =
  `${drawn} of ${COUNT} comments drawn in ${Math.round(elapsed)} ms ` +
  `(target under ${TARGET_MS} ms): ${passed ? 'PASS' : 'FAIL'}`;
result.dataset.ms = String(elapsed);
