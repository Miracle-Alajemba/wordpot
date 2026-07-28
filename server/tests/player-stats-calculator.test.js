import { calculatePlayerWinRate } from "../src/utils/player-stats-calculator.js";
describe("Player Stats Calculator", () => {
  test("calculates win rate percentage", () => {
    expect(calculatePlayerWinRate(5, 10)).toBe(50);
    expect(calculatePlayerWinRate(0, 0)).toBe(0);
  });
});
