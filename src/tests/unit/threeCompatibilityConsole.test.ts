import { describe, expect, it } from "vitest";
import { isKnownFiberClockDeprecation } from "../e2e/helpers/threeCompatibility";

const clockWarning = "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";

describe("known Fiber Clock deprecation", () => {
  it("allows only the exact upstream warning and never errors or other renderer warnings", () => {
    const message = (text: string, type: "warning" | "error" = "warning") => ({ text: () => text, type: () => type });
    expect(isKnownFiberClockDeprecation(message(clockWarning))).toBe(true);
    for (const text of [
      "THREE.WebGLProgram: Shader Error",
      "THREE.WebGLRenderer: Context Lost.",
      "THREE.Clock: unexpected timing failure",
      `${clockWarning} Additional renderer failure`,
    ]) {
      expect(isKnownFiberClockDeprecation(message(text))).toBe(false);
    }
    expect(isKnownFiberClockDeprecation(message(clockWarning, "error"))).toBe(false);
  });
});
