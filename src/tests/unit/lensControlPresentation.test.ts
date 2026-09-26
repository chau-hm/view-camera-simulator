import { describe, expect, it } from "vitest";
import { resolveLensControlOptionPresentation } from "../../components/controls/lensControlPresentation";

describe("Lens control catalog presentation", () => {
  it.each([
    [90, 100.8982256313],
    [105, 92.1318668688],
    [120, 84.4900859515],
    [150, 72],
  ])("presents the %i mm published simulator profile as finite angular coverage", (focalLengthMm, angleDeg) => {
    const semanticLabel = focalLengthMm === 90 ? "wide" : focalLengthMm === 150 ? "standard" : undefined;
    expect(resolveLensControlOptionPresentation(focalLengthMm, semanticLabel)).toEqual({
      focalLengthMm,
      semanticLabel: semanticLabel ?? null,
      lensId: `simulator-parametric-${focalLengthMm}mm`,
      coveragePresentation: { kind: "finite-angular", fullCoverageAngleDeg: angleDeg },
    });
  });

  it("keeps unknown positive focal lengths unmodelled without duplicating catalog data", () => {
    expect(resolveLensControlOptionPresentation(210)).toEqual({
      focalLengthMm: 210,
      semanticLabel: null,
      lensId: "simulator-ideal-210mm",
      coveragePresentation: { kind: "not-modelled" },
    });
  });
});
