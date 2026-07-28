import { cleanWordInput } from "../src/utils/word-cleaner.js";
describe("Word Cleaner", () => {
  test("normalizes word to uppercase letters only", () => {
    expect(cleanWordInput("  apple! ")).toBe("APPLE");
  });
});
