import { describe, test, expect } from "vitest";
import { groundGlassSharedGlsl, groundGlassUniformDecls } from "../../render/groundGlassDofShaders";

describe("GroundGlass DOF shader source", () => {
  test("shared uniform decls include required uniforms", () => {
    expect(groundGlassUniformDecls).toContain("boundaryBlurRadiusPx");
    expect(groundGlassUniformDecls).toContain("displayBlurScale");
    expect(groundGlassUniformDecls).toContain("maximumBlurRadiusPx");
  });

  test("shared GLSL helpers do not contain GLSL Infinity hacks or old formula", () => {
    expect(groundGlassSharedGlsl).not.toContain("1.0 / 0.0");
    // ensure old formula 'normalizedDef * maxCoC' is not present in shared code
    expect(groundGlassSharedGlsl).not.toContain("normalizedDef * maxCoC");
  });

  test("shared GLSL helpers contain wedge blur mapping helper", () => {
    expect(groundGlassSharedGlsl).toContain("calculateWedgeBlurRadiusPx");
    expect(groundGlassSharedGlsl).toContain("calculateNormalizedWedgeDefocus");
  });
});
