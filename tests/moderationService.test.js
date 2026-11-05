import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModerationError } from '../js/core/errors.js';
import { ModerationService } from '../js/services/moderationService.js';

/** Stands in for a Web Worker: records what it receives and lets a test answer. */
class FakeWorker {
  listeners = {};
  sent = [];
  terminated = false;

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  postMessage(message) {
    this.sent.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) {
      listener(event);
    }
  }

  reply(data) {
    this.emit('message', { data });
  }

  get requestId() {
    return this.sent[0].requestId;
  }
}

describe('ModerationService', () => {
  let workers;
  let service;

  beforeEach((t) => {
    t.mock.method(console, 'error', () => {});
    workers = [];
    service = new ModerationService({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      timeoutMs: 5000,
    });
  });

  const failed = { name: 'ModerationError', reason: 'failed' };

  it('starts a new worker for every check and always stops it', async () => {
    const first = service.check('one');
    workers[0].reply({
      type: 'result',
      requestId: workers[0].requestId,
      blocked: false,
      words: [],
    });
    const second = service.check('two');
    workers[1].reply({
      type: 'result',
      requestId: workers[1].requestId,
      blocked: true,
      words: ['War'],
    });

    assert.deepEqual(await first, { blocked: false, words: [] });
    assert.deepEqual(await second, { blocked: true, words: ['War'] });
    assert.equal(workers.length, 2);
    assert.deepEqual(
      workers.map((worker) => worker.terminated),
      [true, true],
    );
  });

  it('sends the text in the fixed message shape', async () => {
    const result = service.check('Hello');

    assert.deepEqual(workers[0].sent, [
      { type: 'check', requestId: workers[0].requestId, text: 'Hello' },
    ]);
    workers[0].reply({
      type: 'result',
      requestId: workers[0].requestId,
      blocked: false,
      words: [],
    });
    await result;
  });

  it('ignores messages for other requests', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const result = service.check('Hello');
    workers[0].reply({ type: 'result', requestId: 'someone-else', blocked: true, words: ['War'] });
    workers[0].reply('noise');
    workers[0].reply({
      type: 'result',
      requestId: workers[0].requestId,
      blocked: false,
      words: [],
    });

    assert.deepEqual(await result, { blocked: false, words: [] });
  });

  it('fails closed when the worker reports an error', async () => {
    const result = service.check('Hello');
    workers[0].reply({ type: 'error', requestId: workers[0].requestId, reason: 'HTTP 404' });

    await assert.rejects(result, failed);
    assert.equal(workers[0].terminated, true);
  });

  it('fails closed when the worker crashes or sends an unreadable message', async () => {
    const crashed = service.check('one');
    workers[0].emit('error', { message: 'Script error' });
    const unreadable = service.check('two');
    workers[1].emit('messageerror');

    await assert.rejects(crashed, failed);
    await assert.rejects(unreadable, failed);
    assert.equal(
      workers.every((worker) => worker.terminated),
      true,
    );
  });

  it('fails closed on a reply in the wrong shape', async () => {
    const malformed = [
      { blocked: 'yes', words: [] },
      { blocked: true, words: [] },
      { blocked: false, words: ['War'] },
      { blocked: true, words: [42] },
    ];
    for (const [index, reply] of malformed.entries()) {
      const result = service.check('Hello');
      workers[index].reply({ type: 'result', requestId: workers[index].requestId, ...reply });
      await assert.rejects(result, failed);
    }
  });

  it('fails closed after 5 seconds without an answer', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const result = service.check('Hello');

    t.mock.timers.tick(4999);
    assert.equal(workers[0].terminated, false);
    t.mock.timers.tick(1);

    await assert.rejects(result, ModerationError);
    assert.equal(workers[0].terminated, true);
  });

  it('fails closed when no worker can be started', async () => {
    const broken = new ModerationService({
      createWorker: () => {
        throw new Error('Workers are not available');
      },
    });

    await assert.rejects(broken.check('Hello'), failed);
  });
});
