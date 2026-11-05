export class EventBus {
  #handlers = new Map();

  /**
   * @param {string} type
   * @param {(payload: unknown) => void} handler
   * @returns {() => void} Removes the handler again.
   */
  on(type, handler) {
    if (!this.#handlers.has(type)) {
      this.#handlers.set(type, new Set());
    }
    this.#handlers.get(type).add(handler);
    return () => this.#handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    // Copy first, so a handler that unsubscribes does not affect this round.
    for (const handler of [...(this.#handlers.get(type) ?? [])]) {
      try {
        handler(payload);
      } catch (error) {
        // One failing subscriber must not stop the others.
        console.error(`Handler for "${type}" failed:`, error);
      }
    }
  }
}
