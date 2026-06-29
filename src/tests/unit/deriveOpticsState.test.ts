import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("deriveOpticsState", () => {
  it("returns computed optics state for valid inputs", () => {
    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    expect(result.diagnostics.fallbackApplied).toBe(false);
  });

  it("falls back safely on invalid focus distance", () => {
    const result = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        focusDistanceMm: -1,
      },
      architectureRiseScene,
    );
    expect(result.diagnostics.fallbackApplied).toBe(true);
    expect(result.diagnostics.errorMessage).toBe("Invalid focus distance");
  });
});
