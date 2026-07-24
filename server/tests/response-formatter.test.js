import test from "node:test";
import assert from "node:assert/strict";
import { successResponse, errorResponse } from "../src/utils/response-formatter.js";

test("successResponse wraps data in standard envelope", () => {
  const res = successResponse({ score: 120 }, "Score fetched");
  assert.equal(res.ok, true);
  assert.equal(res.message, "Score fetched");
  assert.deepEqual(res.data, { score: 120 });
});

test("errorResponse wraps error message and code in standard envelope", () => {
  const res = errorResponse("Unauthorized wallet", 401);
  assert.equal(res.ok, false);
  assert.equal(res.error, "Unauthorized wallet");
  assert.equal(res.code, 401);
});
