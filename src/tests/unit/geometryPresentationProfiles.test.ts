import { describe, expect, it } from "vitest";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";

describe("getGeometryPresentationProfile", () => {
  it.each([
    ["Table Tilt", tableTiltScene, "side", "optical-section"],
    ["Shelf Swing", shelfSwingScene, "top", "optical-section"],
    ["Architecture Rise", architectureRiseScene, "side", "optical-section"],
    ["Architecture + Foreground", architectureForegroundScene, "side", "optical-section"],
    ["Interior Corner", interiorCornerScene, "top", "optical-section"],
    ["Oblique Architecture", obliqueArchitectureScene, "top", "optical-section"],
    ["Focus Fundamentals", focusFundamentalsTwoTargets, "side", "optical-section"],
    ["Mirror Shift", mirrorShiftScene, "top", "mirror-shift-teaching"],
    ["Understanding Camera Movements", understandingCameraMovementsScene, "side", "optical-section"],
  ] as const)("resolves %s Geometry presentation semantics", (_label, scene, defaultSubjectView, diagramVariant) => {
    const profile = getGeometryPresentationProfile(scene);

    expect(profile.defaultSubjectView).toBe(defaultSubjectView);
    expect(profile.diagramVariant).toBe(diagramVariant);
  });

  it("uses ordinary Geometry presentation semantics for an unlisted scene", () => {
    const profile = getGeometryPresentationProfile({
      ...architectureRiseScene,
      id: "unlisted-scene",
    });

    expect(profile.defaultSubjectView).toBe("side");
    expect(profile.diagramVariant).toBe("optical-section");
  });

  it("preserves the existing Table Tilt profile settings", () => {
    const profile = getGeometryPresentationProfile(tableTiltScene);

    expect(profile.depthWindow).toEqual({ mode: "fixed", minMm: -250, maxMm: 6800 });
    expect(profile.diagramPaddingPx).toBe(36);
    expect(profile.depthPlaneGeometryViews).toEqual(["side", "scheimpflug"]);
  });
});
