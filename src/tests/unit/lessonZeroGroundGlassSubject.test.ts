import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createLessonZeroGroundGlassGroup,
} from "../../render/LessonZeroGroundGlassSubjectFactory";
import {
  lessonZeroGroundGlassSubjectBoundsMm,
  lessonZeroGroundGlassSubjectGeometry,
  lessonZeroGroundGlassSubjectFocusDepthMm,
  resolveLessonZeroGroundGlassSubjectGeometry,
  resolveLessonZeroGroundGlassSubjectFocusDepthMm,
} from "../../scenes/lessonZeroGroundGlassSubject";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("Lesson 0 Ground Glass subject", () => {
  it("derives the subject plane from the canonical finite-focus solution", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...viewCameraAnatomyScene.cameraPreset,
      activeSceneId: viewCameraAnatomyScene.id,
    };
    const optics = deriveOpticsState(camera, viewCameraAnatomyScene);

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(resolveLessonZeroGroundGlassSubjectFocusDepthMm()).toBeCloseTo(
      optics.focusPointWorld.z,
      10,
    );
    expect(lessonZeroGroundGlassSubjectFocusDepthMm).toBeGreaterThan(0);
  });

  it("provides deterministic, finite geometry and bounds on the object side", () => {
    const first = resolveLessonZeroGroundGlassSubjectGeometry();
    const second = resolveLessonZeroGroundGlassSubjectGeometry();
    expect(second).toEqual(first);
    expect(first).toEqual(lessonZeroGroundGlassSubjectGeometry);

    for (const box of first.boxes) {
      for (const axis of ["x", "y", "z"] as const) {
        expect(Number.isFinite(box.center[axis])).toBe(true);
        expect(Number.isFinite(box.size[axis])).toBe(true);
        expect(box.size[axis]).toBeGreaterThan(0);
        expect(box.center[axis] - box.size[axis] / 2).toBeGreaterThanOrEqual(first.bounds.min[axis]);
        expect(box.center[axis] + box.size[axis] / 2).toBeLessThanOrEqual(first.bounds.max[axis]);
      }
      expect(box.center.z).toBeGreaterThan(0);
    }
  });

  it("uses the shared subject factory for meaningful RTT geometry", () => {
    const group = createLessonZeroGroundGlassGroup();
    expect(group.name).toBe("view-camera-anatomy-subject");
    expect(group.children).toHaveLength(lessonZeroGroundGlassSubjectGeometry.boxes.length);
    expect(group.getObjectByName("view-camera-anatomy-target-cross-horizontal")).toBeInstanceOf(THREE.Mesh);
    expect(group.getObjectByName("view-camera-anatomy-target-cross-vertical")).toBeInstanceOf(THREE.Mesh);
    expect(group.userData.focusDepthMm).toBe(lessonZeroGroundGlassSubjectFocusDepthMm);
    expect(lessonZeroGroundGlassSubjectBoundsMm.min.z).toBeGreaterThan(0);
    expect(lessonZeroGroundGlassSubjectBoundsMm.max.z).toBeGreaterThan(
      lessonZeroGroundGlassSubjectFocusDepthMm,
    );
  });

  it("keeps the reference depth tied to the current canonical focal length", () => {
    const alternateFocalLengthMm = CAMERA_CONSTANTS.focalLengthMm + 30;
    const alternate = resolveLessonZeroGroundGlassSubjectGeometry({
      focalLengthMm: alternateFocalLengthMm,
    });
    expect(alternate.focusDepthMm).not.toBe(lessonZeroGroundGlassSubjectFocusDepthMm);
    expect(alternate.focusDepthMm).toBe(
      resolveLessonZeroGroundGlassSubjectFocusDepthMm(alternateFocalLengthMm),
    );
  });
});
