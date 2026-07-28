import { calculateWordScore } from "../src/utils/score-calculator.js";
describe("Score Calculator", () => {
  test("calculates score based on length", () => {
    expect(calculateWordScore("cat")).toBe(10);
    expect(calculateWordScore("apple")).toBe(25);
    expect(calculateWordScore("potatoes")).toBe(100);
  });
});
