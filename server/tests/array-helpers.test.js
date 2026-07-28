import { shuffleArray } from "../src/utils/array-helpers.js";
describe("Array Helpers", () => {
  test("returns shuffled array with same length", () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort()).toEqual(original.sort());
  });
});
