import { RATE_LIMIT_CONFIG } from "../src/utils/rate-limits.js";
describe("Rate Limit Config", () => {
  test("defines rate limit thresholds", () => {
    expect(RATE_LIMIT_CONFIG.MAX_JOIN_ATTEMPTS).toBeGreaterThan(0);
  });
});
