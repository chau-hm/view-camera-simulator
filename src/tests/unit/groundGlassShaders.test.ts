import { describe, test, expect } from "vitest";
import { groundGlassSharedGlsl, groundGlassUniformDecls } from "../../render/groundGlassDofShaders";
import {
  groundGlassApertureGatherFragmentShader,
  groundGlassCompositeFragmentShader,
  groundGlassPhysicalCocFragmentShader,
  groundGlassVertexShader,
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

function extractFunctionBody(source: string, name: string) {
  const signatureIndex = source.indexOf(name);
  if (signatureIndex === -1) return "";
  const braceOpen = source.indexOf("{", signatureIndex);
  if (braceOpen === -1) return "";
  let depth = 0;
  for (let i = braceOpen; i < source.length; ++i) {
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
    expect(groundGlassUniformDecls).toContain("maximumCoCRadiusPx");
    expect(groundGlassUniformDecls).toContain("sampleCount");
    expect(groundGlassUniformDecls).toContain("filmWidthMm");
    expect(groundGlassUniformDecls).toContain("cocStorageEncoded");
    expect(groundGlassUniformDecls).toContain("cocStorageMaxMm");
  });

  test("shared GLSL helpers do not contain GLSL Infinity hacks or old formula", () => {
    expect(groundGlassSharedGlsl).not.toContain("1.0 / 0.0");
    expect(groundGlassSharedGlsl).not.toContain("normalizedDef * maxCoC");
  });

  test("shared GLSL helpers contain physical CoC and wedge mapping helpers", () => {
    expect(groundGlassSharedGlsl).toContain("calculateSignedPhysicalCoCDiameterMmFromDepth");
    expect(groundGlassSharedGlsl).toContain("calculatePhysicalCoCDiameterMmFromDepth");
    expect(groundGlassSharedGlsl).toContain("calculateSignedCoCDiameterMmAtFragment");
    expect(groundGlassSharedGlsl).toContain("calculateCoCDiameterMmAtFragment");
    expect(groundGlassSharedGlsl).toContain("calculateSignedWedgeCoCDiameterMmFromWorldPosition");
    expect(groundGlassSharedGlsl).toContain("calculateWedgeCoCDiameterMmFromWorldPosition");
    expect(groundGlassSharedGlsl).toContain("calculateNormalizedWedgeDefocus");
    expect(groundGlassSharedGlsl).toContain("safeUnresolvedWedgeCoCDiameterMm");
    expect(groundGlassSharedGlsl).toContain("tFocus <= 0.0");
    expect(groundGlassSharedGlsl).toContain("cocDiameterMmToGatherRadiusPx");
    expect(groundGlassSharedGlsl).toContain("encodeSignedPhysicalCoCDiameterMm");
    expect(groundGlassSharedGlsl).toContain("decodeStoredSignedCoCDiameterMm");
    expect(groundGlassSharedGlsl).toContain("calculateFarSampleWeight");
    expect(groundGlassSharedGlsl).toContain("calculateNearSampleWeight");
    expect(groundGlassSharedGlsl).not.toContain(
      "float focusDist = tFocus > 0.0 ? tFocus : targetDist",
    );
  });

  test("runtime shader sources are present and contain main", () => {
    expect(groundGlassVertexShader && groundGlassVertexShader.length).toBeGreaterThan(0);
    for (const shader of [
      groundGlassPhysicalCocFragmentShader,
      groundGlassApertureGatherFragmentShader,
      groundGlassCompositeFragmentShader,
    ]) {
      expect(shader.length).toBeGreaterThan(0);
      expect(shader).toContain("void main()");
    }
  });

  test("CoC stage writes a physical millimetre signal", () => {
    expect(groundGlassPhysicalCocFragmentShader).toContain("calculateSignedCoCDiameterMmAtFragment");
    expect(groundGlassPhysicalCocFragmentShader).toContain("float signedCocMm");
    expect(groundGlassPhysicalCocFragmentShader).toContain(
      "encodeSignedPhysicalCoCDiameterMm(signedCocMm)",
    );
    expect(countDeclarationOccurrences(extractMainBody(groundGlassPhysicalCocFragmentShader), "depth")).toBe(1);
  });

  test("aperture stage uses a configurable circular gather with a sharp early-out", () => {
    expect(groundGlassApertureGatherFragmentShader).toContain("uniform sampler2D tCoC");
    expect(groundGlassApertureGatherFragmentShader).toContain("goldenAngle");
    expect(groundGlassApertureGatherFragmentShader).toContain("sampleCount");
    expect(groundGlassApertureGatherFragmentShader).toContain("cocDiameterMmToGatherRadiusPx");
    expect(groundGlassApertureGatherFragmentShader).toContain("decodeStoredSignedCoCDiameterMm");
    expect(groundGlassApertureGatherFragmentShader).toContain("gatherLayer");
    expect(groundGlassApertureGatherFragmentShader).toContain("calculateFarSampleWeight");
    expect(groundGlassApertureGatherFragmentShader).toContain("calculateNearSampleWeight");
    expect(groundGlassApertureGatherFragmentShader).toContain("sampleRadiusPx");
    expect(groundGlassApertureGatherFragmentShader).toContain("coverage");
    expect(groundGlassApertureGatherFragmentShader).toContain("texture2D(tColor, uv)");
    expect(groundGlassApertureGatherFragmentShader).not.toContain("sigma");
    expect(groundGlassApertureGatherFragmentShader).not.toContain("exp(-0.5");
    expect(groundGlassApertureGatherFragmentShader).toContain("0.125");
  });

  test("near/far visibility policy keeps occlusion asymmetric", () => {
    const farPolicy = extractFunctionBody(groundGlassSharedGlsl, "calculateFarSampleWeight");
    const nearPolicy = extractFunctionBody(groundGlassSharedGlsl, "calculateNearSampleWeight");

    expect(farPolicy).toContain("sampleSignedCocMm < -0.00001");
    expect(farPolicy).toContain("sampleUmm < centerUmm - toleranceMm");
    expect(nearPolicy).toContain("sampleSignedCocMm >= -0.00001");
    expect(nearPolicy).toContain("sampleUmm > centerUmm + toleranceMm");
    expect(groundGlassApertureGatherFragmentShader).toContain(
      "smoothstep(sampleRadiusPx, sampleRadiusPx + 1.0, sampleDistancePx)",
    );
    expect(groundGlassCompositeFragmentShader).toContain(
      "mix(gathered.rgb, nearLayer.rgb, clamp(nearLayer.a, 0.0, 1.0))",
    );
  });

  test("composite stage owns orientation and focus-ring display policy", () => {
    expect(groundGlassCompositeFragmentShader).toContain("displayUpright");
    expect(groundGlassCompositeFragmentShader).toContain("applyFocusRing");
    expect(groundGlassCompositeFragmentShader).toContain("uniform sampler2D tGather");
    expect(groundGlassCompositeFragmentShader).toContain("uniform sampler2D tNearGather");
    expect(groundGlassCompositeFragmentShader).toContain("useNearGather");
    expect(groundGlassCompositeFragmentShader).not.toContain("sigma");
  });
});
