import { ERROR_CODES } from "../src/constants/errors.js";
describe("Error Constants", () => {
  test("defines required error codes", () => {
    expect(ERROR_CODES.INVALID_ROOM).toBe("INVALID_ROOM");
    expect(ERROR_CODES.INVALID_WORD).toBe("INVALID_WORD");
  });
});
