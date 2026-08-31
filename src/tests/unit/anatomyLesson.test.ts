import { describe, expect, it } from "vitest";
import {
  getLessonZeroStep,
  LESSON_ZERO_ANATOMY,
  LESSON_ZERO_STEPS,
  isLessonZeroStepComplete,
  resolveLessonZeroCameraPresentation,
} from "../../app/anatomyLesson";
import { CAMERA_CONTROL_TEACHING } from "../../app/cameraControlTeaching";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("Lesson 0 anatomy vocabulary", () => {
  it("maps each lesson-facing part to the shared semantic camera anatomy", () => {
    expect(LESSON_ZERO_ANATOMY.lens.semanticTargets).toEqual([
      { kind: "part", part: "lens" },
    ]);
    expect(LESSON_ZERO_ANATOMY["lens-board"].semanticTargets).toEqual([
      { kind: "part", part: "lens-board" },
    ]);
    expect(LESSON_ZERO_ANATOMY["front-standard"].semanticTargets).toEqual([
      { kind: "part", part: "front-standard" },
    ]);
    expect(LESSON_ZERO_ANATOMY.bellows.semanticTargets).toEqual([
      { kind: "part", part: "bellows" },
    ]);
    expect(LESSON_ZERO_ANATOMY["rear-standard"].semanticTargets).toEqual([
      { kind: "part", part: "rear-standard" },
    ]);
    expect(LESSON_ZERO_ANATOMY["ground-glass"].semanticTargets).toEqual([
      { kind: "part", part: "ground-glass-back" },
    ]);
    expect(LESSON_ZERO_ANATOMY["film-holder"].semanticTargets).toEqual([
      { kind: "part", part: "film-holder" },
    ]);
    expect(LESSON_ZERO_ANATOMY["camera-support"].semanticTargets).toEqual([
      { kind: "part", part: "camera-support" },
    ]);
    expect(LESSON_ZERO_ANATOMY.aperture.semanticTargets).toEqual([
      {
        kind: "element",
        name: "lens-aperture-iris",
        parentPart: "lens",
      },
    ]);
  });

  it("keeps the anatomy and control progression deterministic and clamps invalid indexes", () => {
    expect(LESSON_ZERO_STEPS.map((step) => step.id)).toEqual([
      "complete-camera",
      "front-standard",
      "lens-and-board",
      "aperture",
      "bellows",
      "rear-standard",
      "ground-glass",
      "film-holder",
      "camera-support",
      "recap",
      "controls-overview",
      "front-rise-control",
      "front-shift-control",
      "front-tilt-control",
      "front-swing-control",
      "focus-front-control",
      "focus-rear-control",
      "aperture-control",
      "controls-recap",
    ]);
    expect(getLessonZeroStep(-1).id).toBe("complete-camera");
    expect(getLessonZeroStep(999).id).toBe("controls-recap");
  });

  it("keeps rear-back and aperture demonstrations presentation-only", () => {
    const groundGlass = resolveLessonZeroCameraPresentation(getLessonZeroStep(6));
    const filmHolder = resolveLessonZeroCameraPresentation(getLessonZeroStep(7));
    const wide = resolveLessonZeroCameraPresentation(getLessonZeroStep(3));
    const small = resolveLessonZeroCameraPresentation(getLessonZeroStep(3), true);

    expect(groundGlass.rearBackMode).toBe("ground-glass");
    expect(filmHolder.rearBackMode).toBe("film-holder");
    expect(wide.aperture).toBe(5.6);
    expect(small.aperture).toBe(32);
    expect(wide).not.toHaveProperty("visualAperture");
  });

  it("maps interactive steps to the centralized control teaching definitions", () => {
    expect(CAMERA_CONTROL_TEACHING["front-rise"]).toMatchObject({
      kind: "movement",
      movementField: "frontRiseMm",
      movementKind: "rise",
      anatomyTargets: ["front-standard"],
    });
    expect(CAMERA_CONTROL_TEACHING["focus-rear"]).toMatchObject({
      kind: "focus",
      focusStandard: "rear",
      anatomyTargets: ["rear-standard", "bellows"],
    });
    expect(CAMERA_CONTROL_TEACHING.aperture).toMatchObject({
      kind: "aperture",
      anatomyTargets: ["aperture"],
    });
  });

  it("requires a reachable canonical control change before advancing", () => {
    const riseStep = getLessonZeroStep(11);
    const camera = { ...DEFAULT_CAMERA_STATE };

    expect(isLessonZeroStepComplete(riseStep, camera)).toBe(false);
    expect(isLessonZeroStepComplete(riseStep, { ...camera, frontRiseMm: 8 })).toBe(true);
    expect(
      resolveLessonZeroCameraPresentation(getLessonZeroStep(17)).anatomy?.targets,
    ).toEqual([
      { kind: "element", name: "lens-aperture-iris", parentPart: "lens" },
    ]);
  });
});
