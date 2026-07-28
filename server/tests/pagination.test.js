import { paginate } from "../src/utils/pagination.js";
describe("Pagination Utility", () => {
  test("paginates array items correctly", () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);
    const result = paginate(items, 2, 10);
    expect(result.data).toHaveLength(10);
    expect(result.totalPages).toBe(3);
  });
});
