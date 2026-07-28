import { getLengthMultiplier } from "../src/utils/score-multiplier.js";
describe("Score Multiplier", () => {
  test("returns score multiplier based on length", () => {
    expect(getLengthMultiplier(8)).toBe(2.5);
    expect(getLengthMultiplier(3)).toBe(1.0);
  });
});
