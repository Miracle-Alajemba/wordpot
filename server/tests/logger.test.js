import { formatLogMessage } from "../src/utils/logger.js";
describe("Logger Formatter", () => {
  test("formats log message into valid JSON", () => {
    const log = formatLogMessage("info", "test event", { roomId: 123 });
    const parsed = JSON.parse(log);
    expect(parsed.level).toBe("info");
    expect(parsed.roomId).toBe(123);
  });
});
