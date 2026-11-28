import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
// @ts-expect-error Test-only Node module.
import { deriveSample, evaluatePixelProvenance, makePixelProvenance } from "../../../scripts/ground-glass-a1/pixel-provenance.mjs";

describe("A1 current target pixel provenance", () => {
  const current = Buffer.from(Array.from({ length: 64 * 64 * 4 }, (_, i) => (i * 7 + Math.floor(i / 256)) % 256));
  it("rederives the declared sample and rejects stale pixels despite current transaction identity", () => {
    const { sample, evidence } = makePixelProvenance(current, 64, 64, "frame-2");
    expect(evaluatePixelProvenance(current, sample, evidence, "frame-2")).toEqual([]);
    const earlier = Buffer.from(current); earlier.fill(23);
    const stale = deriveSample(earlier, 64, 64);
    expect(evaluatePixelProvenance(current, stale, evidence, "frame-2")).toContain("pixel-provenance-mismatch");
    expect(evaluatePixelProvenance(current, sample, evidence, "frame-3")).toContain("capture-transaction-mismatch");
    expect(evaluatePixelProvenance(current, sample, { ...evidence, sourceWidth: 63 }, "frame-2")).toContain("invalid-source-description");
    expect(evaluatePixelProvenance(current, sample, { ...evidence, format: "float" }, "frame-2")).toContain("invalid-source-description");
    const changed = Buffer.from(sample); changed[0] ^= 1;
    expect(evaluatePixelProvenance(current, changed, evidence, "frame-2")).toContain("pixel-provenance-mismatch");
    const changedDigest = createHash("sha256").update(changed).digest("hex");
    expect(evaluatePixelProvenance(current, changed, { ...evidence, sampleSha256: changedDigest }, "frame-2"))
      .toContain("pixel-provenance-mismatch");
  });
});
