import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { injectUnique, instrumentRenderer, requireReviewedRenderer } from "../../../scripts/ground-glass-a1/source-injection.mjs";

describe("A1 test-only renderer instrumentation", () => {
  it("accepts only the reviewed renderer source", () => {
    const source = readFileSync("src/render/GroundGlassRTT.tsx");
    expect(() => requireReviewedRenderer(source)).not.toThrow();
    expect(() => requireReviewedRenderer(Buffer.from(source.toString() + " "))).toThrow();
  });

  it("fails closed when a source anchor is missing or duplicated", () => {
    expect(injectUnique("before target after", "target", "replacement")).toBe("before replacement after");
    expect(() => injectUnique("before after", "target", "replacement")).toThrow();
    expect(() => injectUnique("target target", "target", "replacement")).toThrow();
  });

  it("instruments every reviewed pass and completion boundary, and rejects anchor drift", () => {
    const source = readFileSync("src/render/GroundGlassRTT.tsx", "utf8");
    const tap = readFileSync("scripts/ground-glass-a1/rtt-tap.txt", "utf8");
    const transformed = instrumentRenderer(source, tap);
    for (const pass of ["sceneRender", "cocFootprint", "farGather", "nearGather", "composite", "display"]) {
      expect(transformed).toContain('auditPasses.push("' + pass + '")');
    }
    expect(transformed).toContain("onFrameResultRef.current?.(auditCompletion)");
    expect(transformed).toContain("globalThis.__a0Pending");
    expect(() => instrumentRenderer(source.replace('measurePass("nearGather", () => {', ""), tap)).toThrow();
    expect(() => instrumentRenderer(source + '\nmeasurePass("nearGather", () => {', tap)).toThrow();
  });

  it("pins the reviewed capture, assessment and tap and wires the validated transform", () => {
    const expected: Record<string, string> = {
      "pixel-provenance.mjs": "5b8dc09d3a74c4fbb9feca4e046f329a2074ddc46501e3cba316998010746d78",
      "capture.mjs": "b1ea7fabdea548652cc183ab372a0c9011b22063a4e5b27c6ae3fc9e9715b764",
      "assess.mjs": "8c281f87590b7bb9064b3118c7bedee87cff805aa62c02109bbe77f0e6c4866f",
      "rtt-tap.txt": "f84eff912eb816af8a99ca50ae22d637779a46ccb5f3e0d8bb8ab55fa5bbbf1b",
    };
    for (const [file, digest] of Object.entries(expected)) {
      const data = readFileSync("scripts/ground-glass-a1/" + file);
      expect(createHash("sha256").update(data).digest("hex")).toBe(digest);
    }
    expect(readFileSync("scripts/ground-glass-a1/capture.mjs", "utf8"))
      .toContain("code = instrumentRenderer(code, tap)");
  });

  it("keeps the observation tap out of the normal production entrypoint", () => {
    const packageScripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;
    expect(packageScripts.build).not.toContain("ground-glass-a1");
    expect(readFileSync("vite.config.ts", "utf8")).not.toContain("ground-glass-a1");
  });
});
