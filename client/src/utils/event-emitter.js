/**
 * Lightweight Client Event Bus Utility for WordPot
 */

class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribes to an event.
   * @param {string} event
   * @param {function} listener
   * @returns {function} Unsubscribe callback
   */
  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(listener);

    return () => this.off(event, listener);
  }

  /**
   * Unsubscribes a listener from an event.
   * @param {string} event
   * @param {function} listener
   */
  off(event, listener) {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emits an event with payload.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }
}

export const eventBus = new EventEmitter();
export { EventEmitter };
