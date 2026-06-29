import { describe, expect, it } from "vitest";
import { selectDerivedOpticsState } from "../../state/selectors";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("state selectors", () => {
  it("reuses the same derived optics instance for unchanged camera state", () => {
    const first = selectDerivedOpticsState(DEFAULT_CAMERA_STATE);
    const second = selectDerivedOpticsState(DEFAULT_CAMERA_STATE);
    expect(second).toBe(first);
  });

  it("creates a new derived optics instance when relevant camera fields change", () => {
    const first = selectDerivedOpticsState(DEFAULT_CAMERA_STATE);
    const changedCamera = { ...DEFAULT_CAMERA_STATE, frontTiltDeg: DEFAULT_CAMERA_STATE.frontTiltDeg + 1 };
    const second = selectDerivedOpticsState(changedCamera);
    expect(second).not.toBe(first);
  });
});
