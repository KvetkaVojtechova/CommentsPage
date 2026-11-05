import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageAdapter, WebStorageAdapter } from '../js/data/storageAdapter.js';
import { StorageError } from '../js/core/errors.js';

/** A minimal stand-in for window.localStorage. */
class FakeStorage {
  items = new Map();
  failWrites = false;

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

describe('WebStorageAdapter', () => {
  it('writes values as JSON and reads them back', () => {
    const storage = new FakeStorage();
    const adapter = new WebStorageAdapter(storage);

    adapter.write('key', { a: [1, 2] });

    assert.equal(storage.getItem('key'), '{"a":[1,2]}');
    assert.deepEqual(adapter.read('key'), { a: [1, 2] });
  });

  it('returns null for a missing key', () => {
    assert.equal(new WebStorageAdapter(new FakeStorage()).read('missing'), null);
  });

  it('returns null and warns for invalid JSON', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const storage = new FakeStorage();
    storage.setItem('key', '{not json');

    assert.equal(new WebStorageAdapter(storage).read('key'), null);
    assert.equal(warn.mock.callCount(), 1);
  });

  it('turns a full storage into a StorageError', () => {
    const storage = new FakeStorage();
    storage.failWrites = true;

    assert.throws(() => new WebStorageAdapter(storage).write('key', 1), StorageError);
  });

  it('removes a key', () => {
    const adapter = new WebStorageAdapter(new FakeStorage());
    adapter.write('key', 1);
    adapter.remove('key');

    assert.equal(adapter.read('key'), null);
  });
});

describe('MemoryStorageAdapter', () => {
  it('returns a copy, not the stored object', () => {
    const adapter = new MemoryStorageAdapter();
    const value = { list: [1] };
    adapter.write('key', value);
    value.list.push(2);

    assert.deepEqual(adapter.read('key'), { list: [1] });
  });
});
