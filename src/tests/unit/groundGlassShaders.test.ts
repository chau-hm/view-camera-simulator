import { describe, test, expect } from "vitest";
import { groundGlassSharedGlsl, groundGlassUniformDecls } from "../../render/groundGlassDofShaders";
import {
  groundGlassVertexShader,
  groundGlassHorizontalFragmentShader,
  groundGlassVerticalFragmentShader,
} from "../../render/groundGlassDofShaderSources";

function countDeclarationOccurrences(source: string, name: string) {
  // simple textual count for the pattern: float <name> =
  const re = new RegExp("\\bfloat\\s+" + name + "\\s*=", "g");
  const matches = source.match(re);
  return matches ? matches.length : 0;
}

function extractMainBody(source: string) {
  // crude main() body extractor: finds first 'void main()' and returns contents between the first '{' after it and its matching '}' at same nesting
  const mainIndex = source.indexOf("void main()");
  if (mainIndex === -1) return "";
  const braceOpen = source.indexOf("{", mainIndex);
  if (braceOpen === -1) return "";
  let depth = 0;
  let i = braceOpen;
  for (; i < source.length; ++i) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(braceOpen + 1, i);
    }
  }
  return "";
}

describe("GroundGlass DOF shader source", () => {
  test("shared uniform decls include required uniforms", () => {
    expect(groundGlassUniformDecls).toContain("displayBlurScale");
    expect(groundGlassUniformDecls).toContain("maximumBlurRadiusPx");
    expect(groundGlassUniformDecls).toContain("filmWidthMm");
  });

  test("shared GLSL helpers do not contain GLSL Infinity hacks or old formula", () => {
    expect(groundGlassSharedGlsl).not.toContain("1.0 / 0.0");
    expect(groundGlassSharedGlsl).not.toContain("normalizedDef * maxCoC");
  });

  test("shared GLSL helpers contain wedge blur mapping helper", () => {
    expect(groundGlassSharedGlsl).toContain("calculateWedgeBlurRadiusPxFromWorldPosition");
    expect(groundGlassSharedGlsl).toContain("calculateNormalizedWedgeDefocus");
  });

  test("runtime shader sources are present and contain main", () => {
    expect(groundGlassVertexShader && groundGlassVertexShader.length).toBeGreaterThan(0);
    expect(groundGlassHorizontalFragmentShader && groundGlassHorizontalFragmentShader.length).toBeGreaterThan(0);
    expect(groundGlassVerticalFragmentShader && groundGlassVerticalFragmentShader.length).toBeGreaterThan(0);

    expect(groundGlassHorizontalFragmentShader).toContain("void main()");
    expect(groundGlassVerticalFragmentShader).toContain("void main()");
  });

  test("fragment shaders declare centerDepth exactly once in main scope", () => {
    const hMain = extractMainBody(groundGlassHorizontalFragmentShader);
    const vMain = extractMainBody(groundGlassVerticalFragmentShader);

    expect(countDeclarationOccurrences(hMain, "centerDepth")).toBe(1);
    expect(countDeclarationOccurrences(vMain, "centerDepth")).toBe(1);

    // defensive: ensure vertical shader does not contain more than one in full source either
    expect(countDeclarationOccurrences(groundGlassVerticalFragmentShader, "centerDepth")).toBe(1);
  });

  test("fragment shaders include required runtime helpers and omit obsolete items", () => {
    const requiredHelpers = [
      "calculateDepthSampleWeight",
      "calculateParallelBlurRadiusPxFromDepth",
      "calculateWedgeBlurRadiusPxFromWorldPosition",
      "cocDiameterMmToBlurRadiusPx",
    ];
    for (const h of requiredHelpers) {
      expect(groundGlassHorizontalFragmentShader).toContain(h);
      expect(groundGlassVerticalFragmentShader).toContain(h);
    }

    const forbidden = ["maxCoC", "boundaryBlurRadiusPx", "sensorWidthMm"];
    for (const f of forbidden) {
      expect(groundGlassHorizontalFragmentShader).not.toContain(f);
      expect(groundGlassVerticalFragmentShader).not.toContain(f);
    }

    // ensure obsolete calculateWedgeBlurRadiusPx( is not present (but allow the FromWorldPosition name)
    expect(groundGlassHorizontalFragmentShader).not.toContain("calculateWedgeBlurRadiusPx(");
    expect(groundGlassVerticalFragmentShader).not.toContain("calculateWedgeBlurRadiusPx(");
  });
});
