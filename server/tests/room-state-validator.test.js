import { isRoomJoinable } from "../src/utils/room-state-validator.js";
describe("Room State Validator", () => {
  test("validates whether room accepts new players", () => {
    expect(isRoomJoinable({ settled: false, cancelled: false, playerCount: 1, maxPlayers: 4 })).toBe(true);
    expect(isRoomJoinable({ settled: true })).toBe(false);
  });
});
