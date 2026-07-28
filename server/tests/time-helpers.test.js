import { formatCountdown } from "../src/utils/time-helpers.js";
describe("Time Helpers", () => {
  test("formats seconds into MM:SS string", () => {
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(0)).toBe("00:00");
  });
});
