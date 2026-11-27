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
      "capture.mjs": "633cfa6536c19514a414ffb257d66cab6d41d2061a81c80aabe46090c3a83558",
      "assess.mjs": "ff56ffe4f6e7d33edd07d4edbafcba1259b49343ee1bb2eaf96a41c636f665fd",
      "rtt-tap.txt": "4b3c46a62737d5cf658a4d95838eafc0f5ec14eb6a934edeff6a6ff5a90b10a5",
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
