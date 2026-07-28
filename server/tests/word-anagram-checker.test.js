import { isAnagram } from "../src/utils/word-anagram-checker.js";
describe("Anagram Checker", () => {
  test("verifies anagram pairs", () => {
    expect(isAnagram("listen", "silent")).toBe(true);
    expect(isAnagram("apple", "banana")).toBe(false);
  });
});
