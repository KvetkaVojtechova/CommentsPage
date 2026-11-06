/** A minimal stand-in for window.localStorage that can act as full. */
export class FakeStorage {
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
