import { describe, expect, it } from "vitest";
import { resolveLensControlOptionPresentation } from "../../components/controls/lensControlPresentation";

describe("Lens control catalog presentation", () => {
  it("presents the 90 mm simulator profile as finite coverage not modelled", () => {
    expect(resolveLensControlOptionPresentation(90, "wide")).toEqual({
      focalLengthMm: 90,
      semanticLabel: "wide",
      lensId: "simulator-ideal-90mm",
      coveragePresentation: { kind: "not-modelled" },
    });
  });

  it("presents the 150 mm simulator profile as finite 72 degree coverage", () => {
    expect(resolveLensControlOptionPresentation(150, "standard")).toEqual({
      focalLengthMm: 150,
      semanticLabel: "standard",
      lensId: "simulator-parametric-150mm",
      coveragePresentation: {
        kind: "finite-angular",
        fullCoverageAngleDeg: 72,
      },
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
