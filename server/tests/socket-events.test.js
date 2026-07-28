import { SOCKET_EVENTS } from "../src/constants/socket-events.js";
describe("Socket Events", () => {
  test("exports required socket event names", () => {
    expect(SOCKET_EVENTS.JOIN_ROOM).toBe("room:join");
  });
});
