export const lessonZeroMessageKeys = {
  common: {
    lessonLabel: "lessonZero.common.lessonLabel",
    progressAria: "lessonZero.common.progressAria",
    stepOf: "lessonZero.common.stepOf",
    previous: "lessonZero.common.previous",
    next: "lessonZero.common.next",
    reset: "lessonZero.common.reset",
    lessonComplete: "lessonZero.common.lessonComplete",
    backToScenes: "lessonZero.common.backToScenes",
    showSmallAperture: "lessonZero.common.showSmallAperture",
    showWideAperture: "lessonZero.common.showWideAperture",
    tryControl: "lessonZero.common.tryControl",
    controlComplete: "lessonZero.common.controlComplete",
    controlPending: "lessonZero.common.controlPending",
  },
  scene: {
    title: "scenes.viewCameraAnatomy.title",
    description: "scenes.viewCameraAnatomy.description",
    topics: {
      anatomy: "scenes.viewCameraAnatomy.topics.anatomy",
      focusing: "scenes.viewCameraAnatomy.topics.focusing",
      filmPlane: "scenes.viewCameraAnatomy.topics.filmPlane",
    },
  },
  steps: {
    completeCamera: {
      title: "lessonZero.steps.completeCamera.title",
      body: "lessonZero.steps.completeCamera.body",
      cue: "lessonZero.steps.completeCamera.cue",
    },
    frontStandard: {
      title: "lessonZero.steps.frontStandard.title",
      body: "lessonZero.steps.frontStandard.body",
      cue: "lessonZero.steps.frontStandard.cue",
    },
    lensAndBoard: {
      title: "lessonZero.steps.lensAndBoard.title",
      body: "lessonZero.steps.lensAndBoard.body",
      cue: "lessonZero.steps.lensAndBoard.cue",
    },
    aperture: {
      title: "lessonZero.steps.aperture.title",
      body: "lessonZero.steps.aperture.body",
      cue: "lessonZero.steps.aperture.cue",
    },
    bellows: {
      title: "lessonZero.steps.bellows.title",
      body: "lessonZero.steps.bellows.body",
      cue: "lessonZero.steps.bellows.cue",
    },
    rearStandard: {
      title: "lessonZero.steps.rearStandard.title",
      body: "lessonZero.steps.rearStandard.body",
      cue: "lessonZero.steps.rearStandard.cue",
    },
    groundGlass: {
      title: "lessonZero.steps.groundGlass.title",
      body: "lessonZero.steps.groundGlass.body",
      cue: "lessonZero.steps.groundGlass.cue",
    },
    filmHolder: {
      title: "lessonZero.steps.filmHolder.title",
      body: "lessonZero.steps.filmHolder.body",
      cue: "lessonZero.steps.filmHolder.cue",
    },
    cameraSupport: {
      title: "lessonZero.steps.cameraSupport.title",
      body: "lessonZero.steps.cameraSupport.body",
      cue: "lessonZero.steps.cameraSupport.cue",
    },
    recap: {
      title: "lessonZero.steps.recap.title",
      body: "lessonZero.steps.recap.body",
      cue: "lessonZero.steps.recap.cue",
    },
    controlsOverview: {
      title: "lessonZero.steps.controlsOverview.title",
      body: "lessonZero.steps.controlsOverview.body",
      cue: "lessonZero.steps.controlsOverview.cue",
    },
    frontRiseControl: {
      title: "lessonZero.steps.frontRiseControl.title",
      body: "lessonZero.steps.frontRiseControl.body",
      cue: "lessonZero.steps.frontRiseControl.cue",
    },
    frontShiftControl: {
      title: "lessonZero.steps.frontShiftControl.title",
      body: "lessonZero.steps.frontShiftControl.body",
      cue: "lessonZero.steps.frontShiftControl.cue",
    },
    frontTiltControl: {
      title: "lessonZero.steps.frontTiltControl.title",
      body: "lessonZero.steps.frontTiltControl.body",
      cue: "lessonZero.steps.frontTiltControl.cue",
    },
    frontSwingControl: {
      title: "lessonZero.steps.frontSwingControl.title",
      body: "lessonZero.steps.frontSwingControl.body",
      cue: "lessonZero.steps.frontSwingControl.cue",
    },
    focusFrontControl: {
      title: "lessonZero.steps.focusFrontControl.title",
      body: "lessonZero.steps.focusFrontControl.body",
      cue: "lessonZero.steps.focusFrontControl.cue",
    },
    focusRearControl: {
      title: "lessonZero.steps.focusRearControl.title",
      body: "lessonZero.steps.focusRearControl.body",
      cue: "lessonZero.steps.focusRearControl.cue",
    },
    apertureControl: {
      title: "lessonZero.steps.apertureControl.title",
      body: "lessonZero.steps.apertureControl.body",
      cue: "lessonZero.steps.apertureControl.cue",
    },
    controlsRecap: {
      title: "lessonZero.steps.controlsRecap.title",
      body: "lessonZero.steps.controlsRecap.body",
      cue: "lessonZero.steps.controlsRecap.cue",
    },
  },
} as const;

type MessageKeyValues<T> = T extends Record<string, infer V>
  ? V extends string
    ? V
    : MessageKeyValues<V>
  : never;

export type LessonZeroMessageKey = MessageKeyValues<typeof lessonZeroMessageKeys>;
