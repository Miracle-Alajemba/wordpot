import test, { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "./event-emitter.js";

describe("EventEmitter Utility Module", () => {
  it("should subscribe to and receive emitted events", () => {
    const bus = new EventEmitter();
    let received = null;
    bus.on("score_update", (data) => {
      received = data;
    });

    bus.emit("score_update", { score: 100 });
    assert.deepStrictEqual(received, { score: 100 });
  });

  it("should unsubscribe listener correctly", () => {
    const bus = new EventEmitter();
    let count = 0;
    const unsub = bus.on("tick", () => count++);
    bus.emit("tick");
    assert.strictEqual(count, 1);
    unsub();
    bus.emit("tick");
    assert.strictEqual(count, 1);
  });
});
