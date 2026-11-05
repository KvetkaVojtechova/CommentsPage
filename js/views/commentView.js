import { UI } from '../config.js';
import { MESSAGES } from '../messages.js';
import { el } from '../utils/dom.js';

const dateTimeFormat = new Intl.DateTimeFormat(UI.locale, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * One comment: avatar, author, a "You" label on the user's own comments, time and text.
 * All stored values are inserted as text only, so a comment can never run code (SEC-01).
 * @param {{ authorId: string, authorName: string, text: string, createdAt: string }} comment
 * @param {{ id: string } | null} currentUser
 */
export function createCommentElement(comment, currentUser) {
  const isOwn = comment.authorId === currentUser?.id;

  return el('article', { className: 'comment' }, [
    el('header', { className: 'comment__header' }, [
      el('span', {
        className: 'avatar',
        text: comment.authorName.charAt(0).toUpperCase(),
        attrs: { 'aria-hidden': 'true' },
      }),
      el('span', { className: 'comment__author', text: comment.authorName }),
      ...(isOwn ? [el('span', { className: 'comment__badge', text: MESSAGES.comment.you })] : []),
      el('time', {
        className: 'comment__time',
        text: dateTimeFormat.format(new Date(comment.createdAt)),
        attrs: { datetime: comment.createdAt },
      }),
    ]),
    el('p', { className: 'comment__text', text: comment.text }),
  ]);
}
