import test from "node:test";
import assert from "node:assert";
import { preloadAudio } from "./sound-preloader.js";

test("safely executes sound preloader", () => {
  expect(() => preloadAudio("click.mp3")).not.toThrow();
});
