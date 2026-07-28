import { calculateStreak } from "../src/utils/streak-calculator.js";
describe("Streak Calculator", () => {
  test("increments streak when played next day", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(calculateStreak(yesterday, 3)).toBe(4);
  });
});
