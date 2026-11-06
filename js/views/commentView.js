import { MESSAGES } from '../messages.js';
import { el } from '../utils/dom.js';
import { fullDateTime, relativeTime } from '../utils/formatTime.js';

/**
 * One comment: avatar, author, a "You" label on the user's own comments, the time, for deep
 * replies the name it answers, the text, and an actions row (Reply for logged-in users).
 * All stored values are inserted as text only, so a comment can never run code (SEC-01).
 * @param {{ authorId: string, authorName: string, text: string, createdAt: string }} comment
 * @param {{ id: string } | null} currentUser
 * @param {{ onReply: () => void, replyingTo?: string | null, now?: Date }} options
 * @returns {{ element: HTMLElement, actions: HTMLElement, replyButton: HTMLButtonElement | null, time: HTMLTimeElement }}
 */
export function createCommentElement(comment, currentUser, { onReply, replyingTo = null, now }) {
  const isOwn = comment.authorId === currentUser?.id;
  const time = el('time', {
    className: 'comment__time',
    text: relativeTime(comment.createdAt, now),
    attrs: { datetime: comment.createdAt, title: fullDateTime(comment.createdAt) },
  });
  const replyButton = currentUser
    ? el('button', {
        className: 'btn btn--reply',
        text: MESSAGES.comment.reply,
        // Names the author, so the many Reply buttons can be told apart by screen readers.
        attrs: {
          type: 'button',
          'aria-label': MESSAGES.comment.replyTo(comment.authorName),
          'aria-expanded': 'false',
        },
        on: { click: onReply },
      })
    : null;
  const actions = el('div', { className: 'comment__actions' }, replyButton ? [replyButton] : []);

  const element = el('article', { className: 'comment' }, [
    el('header', { className: 'comment__header' }, [
      el('span', {
        className: 'avatar',
        text: comment.authorName.charAt(0).toUpperCase(),
        attrs: { 'aria-hidden': 'true' },
      }),
      el('span', { className: 'comment__author', text: comment.authorName }),
      ...(isOwn ? [el('span', { className: 'comment__badge', text: MESSAGES.comment.you })] : []),
      time,
    ]),
    ...(replyingTo
      ? [
          el('p', { className: 'comment__replying-to' }, [
            el('span', { text: '↳ ', attrs: { 'aria-hidden': 'true' } }),
            MESSAGES.comment.replyingTo(replyingTo),
          ]),
        ]
      : []),
    el('p', { className: 'comment__text', text: comment.text }),
    actions,
  ]);

  return { element, actions, replyButton, time };
}

/** Updates a comment's relative time ("40 min ago") without drawing it again. */
export function refreshTime(time, now) {
  time.textContent = relativeTime(time.dateTime, now);
}
