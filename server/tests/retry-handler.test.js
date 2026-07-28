import { retryWithBackoff } from "../src/utils/retry-handler.js";
describe("Retry Handler", () => {
  test("resolves on first successful call", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const res = await retryWithBackoff(fn);
    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
