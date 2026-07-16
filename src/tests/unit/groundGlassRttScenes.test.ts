import { describe, expect, it } from "vitest";
import {
  getGroundGlassClipRangeWorld,
  isGroundGlassRttScene,
  RTT_SCENES,
} from "../../render/groundGlassRttScenes";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";

describe("Ground Glass RTT scene registration", () => {
  it("includes Shelf Swing in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("shelf-swing");
    expect(isGroundGlassRttScene("shelf-swing")).toBe(true);
  });

  it("derives enough far clipping range for the back station and samples", () => {
    const lensCenter = { x: 0, y: 0, z: 0 };
    const clip = getGroundGlassClipRangeWorld(shelfSwingScene, lensCenter);
    const backDepths = [
      ...geometry.getSubjectWorldBoundsCorners(geometry.backSubject).map((point) => point.z),
      ...geometry.backSubject.focusSamples.map((sample) => sample.worldPosition.z),
    ];
    backDepths.forEach((depthMm) => expect(depthMm * 0.001).toBeLessThan(clip.far));
  });
});
