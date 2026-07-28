import { hashPayload } from "../src/utils/crypto-hash.js";
describe("Crypto Hashing", () => {
  test("generates consistent sha256 hash", () => {
    const hash1 = hashPayload({ a: 1 });
    const hash2 = hashPayload({ a: 1 });
    expect(hash1).toBe(hash2);
  });
});
