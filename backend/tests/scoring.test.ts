import { describe, expect, it } from "vitest";
import { combineScores } from "../src/engine/scoring.js";

describe("combineScores", () => {
  it("returns weighted score with defaults", () => {
    const score = combineScores(80, 60, 70);
    expect(score).toBe(72);
  });

  it("clamps values to 0..100", () => {
    const score = combineScores(1000, 1000, 1000);
    expect(score).toBe(100);
  });
});
