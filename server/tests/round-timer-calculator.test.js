import { calculateRemainingSeconds } from "../src/utils/round-timer-calculator.js";
describe("Round Timer Calculator", () => {
  test("calculates remaining round seconds", () => {
    const now = new Date().toISOString();
    expect(calculateRemainingSeconds(now, 60)).toBe(60);
  });
});
