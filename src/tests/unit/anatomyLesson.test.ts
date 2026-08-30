import { describe, expect, it } from "vitest";
import {
  getLessonZeroStep,
  LESSON_ZERO_ANATOMY,
  LESSON_ZERO_STEPS,
  resolveLessonZeroCameraPresentation,
} from "../../app/anatomyLesson";

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

  it("keeps the ten-step progression deterministic and clamps invalid indexes", () => {
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
    ]);
    expect(getLessonZeroStep(-1).id).toBe("complete-camera");
    expect(getLessonZeroStep(999).id).toBe("recap");
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
});
