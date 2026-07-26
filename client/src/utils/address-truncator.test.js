import test, { describe, it } from "node:test";
import assert from "node:assert";
import { truncateAddress, isValidEvmAddress } from "./address-truncator.js";

describe("Address Truncator Utility", () => {
  it("should truncate long EVM wallet addresses", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    assert.strictEqual(truncateAddress(addr, 6, 4), "0x1234...5678");
  });

  it("should validate EVM wallet address formats", () => {
    assert.strictEqual(isValidEvmAddress("0x1234567890abcdef1234567890abcdef12345678"), true);
    assert.strictEqual(isValidEvmAddress("invalid-address"), false);
  });
});
