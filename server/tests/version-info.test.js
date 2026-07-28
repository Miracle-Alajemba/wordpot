import { APP_VERSION_INFO } from "../src/utils/version-info.js";
describe("Version Info Provider", () => {
  test("exports application version details", () => {
    expect(APP_VERSION_INFO.version).toBe("1.4.0");
    expect(APP_VERSION_INFO.network).toBe("Celo Mainnet");
  });
});
