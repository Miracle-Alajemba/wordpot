import { getRoomCacheKey, getUserCacheKey } from "../src/utils/cache-keys.js";
describe("Cache Keys Generator", () => {
  test("formats redis cache key strings", () => {
    expect(getRoomCacheKey(42)).toBe("wordpot:room:42");
    expect(getUserCacheKey("0xABC")).toBe("wordpot:user:0xabc");
  });
});
