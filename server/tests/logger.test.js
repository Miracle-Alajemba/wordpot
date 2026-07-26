import test, { describe, it } from "node:test";
import assert from "node:assert";
import { formatLogMessage } from "../src/utils/logger.js";

describe("Structured Logger Module", () => {
  it("should format JSON log message with timestamp and level", () => {
    const formatted = formatLogMessage("info", "Test log message", { roomId: "r123" });
    const parsed = JSON.parse(formatted);
    assert.strictEqual(parsed.level, "INFO");
    assert.strictEqual(parsed.message, "Test log message");
    assert.strictEqual(parsed.roomId, "r123");
    assert.ok(parsed.timestamp);
  });
});
