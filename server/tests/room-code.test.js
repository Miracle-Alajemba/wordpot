import { generateRoomCode } from "../src/utils/room-code-generator.js";
describe("Room Code Generator", () => {
  test("generates room code of correct length", () => {
    const code = generateRoomCode(6);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]+$/);
  });
});
