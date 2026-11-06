import { MODERATION } from '../config.js';
import { ModerationError } from '../core/errors.js';

function isValidReply(reply) {
  if (reply.type === 'result') {
    return (
      Array.isArray(reply.words) &&
      reply.words.every((word) => typeof word === 'string') &&
      reply.blocked === reply.words.length > 0
    );
  }
  return reply.type === 'error';
}

/**
 * Checks a comment for banned words in a Web Worker. Every check starts a new worker
 * and always stops it afterwards. Anything that goes wrong fails closed: the check throws
 * and the comment is not saved.
 */
export class ModerationService {
  #createWorker;
  #timeoutMs;
  #requestCount = 0;

  /**
   * @param {{ createWorker: () => Worker, timeoutMs?: number }} options `createWorker` is
   *   injected so the service can be tested without a browser.
   */
  constructor({ createWorker, timeoutMs = MODERATION.timeoutMs }) {
    this.#createWorker = createWorker;
    this.#timeoutMs = timeoutMs;
  }

  /**
   * @param {string} text
   * @returns {Promise<{ blocked: boolean, words: string[] }>} `words` lists every banned word found.
   * @throws {ModerationError} With reason "failed" when the check could not be completed.
   */
  async check(text) {
    const requestId = `check-${++this.#requestCount}`;
    let worker = null;
    try {
      worker = this.#createWorker();
      const reply = await this.#ask(worker, { type: 'check', requestId, text });
      if (reply.type === 'error') {
        throw new Error(reply.reason);
      }
      return { blocked: reply.blocked, words: reply.words };
    } catch (error) {
      console.error('The comment could not be checked:', error);
      throw new ModerationError('failed', null, { cause: error });
    } finally {
      worker?.terminate();
    }
  }

  /** Resolves with the first valid reply to this request, or rejects on an error or the timeout. */
  #ask(worker, request) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No answer within ${this.#timeoutMs} ms.`)),
        this.#timeoutMs,
      );
      const finish = (settle, value) => {
        clearTimeout(timer);
        settle(value);
      };

      worker.addEventListener('message', ({ data }) => {
        // Messages for other requests are ignored.
        if (data?.requestId !== request.requestId) {
          return;
        }
        if (isValidReply(data)) {
          finish(resolve, data);
        } else {
          finish(reject, new Error('The worker sent a reply in an unknown shape.'));
        }
      });
      worker.addEventListener('error', (event) => {
        event.preventDefault?.();
        finish(reject, new Error(event.message || 'The worker could not run.'));
      });
      worker.addEventListener('messageerror', () => {
        finish(reject, new Error('The worker sent a message that could not be read.'));
      });

      worker.postMessage(request);
    });
  }
}
