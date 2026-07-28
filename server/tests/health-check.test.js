import { getSystemHealthStatus } from "../src/utils/health-check.js";
describe("Health Check Generator", () => {
  test("returns health metrics object", () => {
    const health = getSystemHealthStatus();
    expect(health.status).toBe("ok");
    expect(health.uptime).toBeGreaterThanOrEqual(0);
  });
});
