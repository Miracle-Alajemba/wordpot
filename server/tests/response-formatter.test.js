import { successResponse, errorResponse } from "../src/utils/response-formatter.js";
describe("Response Formatter", () => {
  test("formats success and error responses", () => {
    expect(successResponse({ id: 1 })).toEqual({ success: true, message: "Success", data: { id: 1 } });
    expect(errorResponse("Invalid", 404)).toEqual({ success: false, error: "Invalid", code: 404 });
  });
});
