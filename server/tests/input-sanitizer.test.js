import { sanitizeUsername } from "../src/utils/input-sanitizer.js";
describe("Input Sanitizer", () => {
  test("strips illegal characters and truncates username", () => {
    expect(sanitizeUsername("<b>Player1</b>")).toBe("Player1");
    expect(sanitizeUsername("a".repeat(30))).toHaveLength(20);
  });
});
