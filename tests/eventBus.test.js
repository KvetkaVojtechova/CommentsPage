import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../js/core/eventBus.js';

describe('EventBus', () => {
  it('passes the payload to every handler of that type', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('ping', (payload) => received.push(['a', payload]));
    bus.on('ping', (payload) => received.push(['b', payload]));
    bus.on('other', () => received.push(['other']));

    bus.emit('ping', 42);

    assert.deepEqual(received, [
      ['a', 42],
      ['b', 42],
    ]);
  });

  it('stops calling a handler after unsubscribe', () => {
    const bus = new EventBus();
    let calls = 0;
    const off = bus.on('ping', () => calls++);

    bus.emit('ping');
    off();
    bus.emit('ping');

    assert.equal(calls, 1);
  });

  it('does nothing when a type has no handlers', () => {
    assert.doesNotThrow(() => new EventBus().emit('nobody-listens'));
  });

  it('keeps calling other handlers when one throws', (t) => {
    const consoleError = t.mock.method(console, 'error', () => {});
    const bus = new EventBus();
    let reached = false;
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', () => {
      reached = true;
    });

    bus.emit('ping');

    assert.equal(reached, true);
    assert.equal(consoleError.mock.callCount(), 1);
  });
});
