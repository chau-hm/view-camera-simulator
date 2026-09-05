export const guidedLessonMessages = {
  common: {
    title: "Guided Lesson",
    progressAria: "Guided lesson progress",
    stepOf: "Step {{current}} of {{total}}",
    previous: "Previous",
    continue: "Continue",
    lessonComplete: "Lesson complete",
    finalChallengePending: "Complete the final challenge to finish the lesson.",
    lastStagePending: "Complete this stage to finish the lesson.",
    backToScenes: "Back to Scenes",
    restartLesson: "Restart lesson",
  },
  stages: {
    observe: "Observe",
    focus: "Focus",
    tilt: "Front Tilt",
    swing: "Front Swing",
    refine: "Refine Focus",
    aperture: "Aperture",
    compose: "Compose",
    alignFocus: "Align Focus",
    depthOfField: "Depth of Field",
    finalChallenge: "Final Challenge",
  },
  lessons: {
    obliqueArchitecture: {
      lessonName: "Oblique Architecture Guided Lesson",
      observeTitle: "Observe the Problem",
      observeBody:
        "Before changing the camera, inspect the Ground Glass. The roof is cropped, while the receding façade cannot be kept sharp from near to far with Focus alone.",
      completionBody:
        "You framed the building, preserved parallel verticals, and aligned the plane of sharp focus with the receding façade.",
    },
    architectureForeground: {
      lessonName: "Architecture + Foreground Guided Lesson",
      observeTitle: "Observe the Problem",
      observeBody:
        "Inspect the Ground Glass before changing the camera. The roof is cropped and the near foreground is soft while the camera remains level and the building verticals stay parallel.",
      completionBody:
        "You corrected the framing with Rise, aligned and placed the focus plane with Tilt and Focus, then used Aperture to extend usable depth from the foreground through the building.",
    },
    interiorCorner: {
      lessonName: "Interior Corner — Rise + Swing Guided Lesson",
      observeTitle: "Observe the Problem",
      observeBody:
        "Inspect the Ground Glass before changing the camera. The upper architecture is tight in the frame, while details on one receding wall span several focus distances. The opposite wall is context, not a second sharpness target.",
      completionBody:
        "You corrected the framing with Rise, aligned the focus plane through the receding wall with Swing and Focus, then used Aperture to add finishing depth.",
    },
    obliqueTabletop: {
      lessonName: "Oblique Tabletop Guided Lesson",
      observeTitle: "Observe the Problem",
      observeBody:
        "Before changing the camera, compare the visible tabletop regions in the Ground Glass. Focus can move the sharp region, but the oblique surface varies in depth and direction.",
      completionBody:
        "You used Tilt and Swing to orient one three-dimensional focus plane, Focus to place it on the tabletop, and Aperture to add depth around that aligned plane.",
    },
  },
} as const;
