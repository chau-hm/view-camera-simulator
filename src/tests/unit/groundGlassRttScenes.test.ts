import { describe, expect, it } from "vitest";
import {
  getGroundGlassClipRangeWorld,
  isGroundGlassRttScene,
  RTT_SCENES,
} from "../../render/groundGlassRttScenes";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import { lessonZeroGroundGlassSubjectBoundsMm } from "../../scenes/lessonZeroGroundGlassSubject";

describe("Ground Glass RTT scene registration", () => {
  it("includes Lesson 0 in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("view-camera-anatomy");
    expect(isGroundGlassRttScene("view-camera-anatomy")).toBe(true);

    const clip = getGroundGlassClipRangeWorld(
      { ...viewCameraAnatomyScene, bounds: lessonZeroGroundGlassSubjectBoundsMm },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    expect(clip.far).toBeGreaterThan(lessonZeroGroundGlassSubjectBoundsMm.max.z * 0.001);
  });

  it("includes Shelf Swing in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("shelf-swing");
    expect(isGroundGlassRttScene("shelf-swing")).toBe(true);
  });

  it("includes Mirror Shift in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("mirror-shift");
    expect(isGroundGlassRttScene("mirror-shift")).toBe(true);
    const clip = getGroundGlassClipRangeWorld(
      mirrorShiftScene,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    expect(clip.far).toBeGreaterThan(9);
  });

  it("includes Oblique Architecture in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("oblique-architecture");
    expect(isGroundGlassRttScene("oblique-architecture")).toBe(true);
  });

  it("includes Architecture + Foreground in the centralized RTT scene set", () => {
    expect(RTT_SCENES).toContain("architecture-foreground");
    expect(isGroundGlassRttScene("architecture-foreground")).toBe(true);
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

  it("projects scene bounds along the configured camera forward vector", () => {
    const lensCenter = { x: 0, y: 0, z: 0 };
    const forward = { x: 0, y: -Math.sin(Math.PI / 6), z: Math.cos(Math.PI / 6) };
    const clip = getGroundGlassClipRangeWorld(shelfSwingScene, lensCenter, forward);
    const expectedMaximumDepth = Math.max(
      ...[shelfSwingScene.bounds.min.x, shelfSwingScene.bounds.max.x].flatMap((x) =>
        [shelfSwingScene.bounds.min.y, shelfSwingScene.bounds.max.y].flatMap((y) =>
          [shelfSwingScene.bounds.min.z, shelfSwingScene.bounds.max.z].map(
            (z) => x * forward.x + y * forward.y + z * forward.z,
          ),
        ),
      ),
    );
    expect(clip.far).toBeCloseTo(
      Math.max(4, expectedMaximumDepth * 0.001 + 1),
      10,
    );
  });
});
