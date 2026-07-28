import { sortLeaderboard } from "../src/utils/leaderboard-sorter.js";
describe("Leaderboard Sorter", () => {
  test("sorts players by score descending", () => {
    const players = [{ name: "A", score: 10 }, { name: "B", score: 50 }];
    const sorted = sortLeaderboard(players);
    expect(sorted[0].name).toBe("B");
  });
});
