import { validateRequiredEnvVars } from "../src/utils/env-validator.js";
describe("Env Validator", () => {
  test("identifies missing environment variables", () => {
    const res = validateRequiredEnvVars(["NON_EXISTENT_VAR_123"]);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain("NON_EXISTENT_VAR_123");
  });
});
