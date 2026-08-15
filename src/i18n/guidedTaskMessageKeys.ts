export const guidedTaskMessageKeys = {
  common: {
    guidedTask: "tasks.common.guidedTask",
    allowedControls: "tasks.common.allowedControls",
    viewRequirements: "tasks.common.viewRequirements",
    notStarted: "tasks.common.notStarted",
    waitingForEvaluation: "tasks.common.waitingForEvaluation",
    inProgress: "tasks.common.inProgress",
    completed: "tasks.common.completed",
    score: "tasks.common.score",
    nextAdjustment: "tasks.common.nextAdjustment",
    requirementsMet: "tasks.common.requirementsMet",
    requirementsCompletedAria: "tasks.common.requirementsCompletedAria",
    passed: "tasks.common.passed",
    needsAdjustment: "tasks.common.needsAdjustment",
    taskCompleted: "tasks.common.taskCompleted",
    noAdjustmentNeeded: "tasks.common.noAdjustmentNeeded",
    progress: "tasks.common.progress",
    finalSettings: "tasks.common.finalSettings",
    secondaryFeedback: "tasks.common.secondaryFeedback",
    genericCriterion: "tasks.common.genericCriterion",
    genericPassPrimary: "tasks.common.genericPassPrimary",
    genericFailPrimary: "tasks.common.genericFailPrimary",
    genericSecondary: "tasks.common.genericSecondary",
  },
  controls: {
    rise: "tasks.controls.rise",
    tilt: "tasks.controls.tilt",
    swing: "tasks.controls.swing",
    focusDistance: "tasks.controls.focusDistance",
    aperture: "tasks.controls.aperture",
    geometryView: "tasks.controls.geometryView",
    cameraPosition: "tasks.controls.cameraPosition",
    frontShift: "tasks.controls.frontShift",
  },
  results: {
    focusTargetsSharp: {
      pass: "tasks.results.focusTargetsSharp.pass",
      fail: "tasks.results.focusTargetsSharp.fail",
    },
    movementUsed: {
      rise: {
        pass: "tasks.results.movementUsed.rise.pass",
        fail: "tasks.results.movementUsed.rise.fail",
      },
      tilt: {
        pass: "tasks.results.movementUsed.tilt.pass",
        fail: "tasks.results.movementUsed.tilt.fail",
      },
      swing: {
        pass: "tasks.results.movementUsed.swing.pass",
        fail: "tasks.results.movementUsed.swing.fail",
      },
    },
    movementRange: {
      rise: {
        pass: "tasks.results.movementRange.rise.pass",
        fail: "tasks.results.movementRange.rise.fail",
      },
      tilt: {
        pass: "tasks.results.movementRange.tilt.pass",
        fail: "tasks.results.movementRange.tilt.fail",
      },
      swing: {
        pass: "tasks.results.movementRange.swing.pass",
        fail: "tasks.results.movementRange.swing.fail",
      },
    },
    allowedAperture: {
      pass: "tasks.results.allowedAperture.pass",
      fail: "tasks.results.allowedAperture.fail",
    },
    compositionVisible: {
      pass: "tasks.results.compositionVisible.pass",
      fail: "tasks.results.compositionVisible.fail",
    },
    mirrorReflectionClear: {
      pass: "tasks.results.mirrorReflectionClear.pass",
      fail: "tasks.results.mirrorReflectionClear.fail",
    },
    mirrorFramingRestored: {
      pass: "tasks.results.mirrorFramingRestored.pass",
      fail: "tasks.results.mirrorFramingRestored.fail",
    },
    mirrorViewpointRetained: {
      pass: "tasks.results.mirrorViewpointRetained.pass",
      fail: "tasks.results.mirrorViewpointRetained.fail",
    },
  },
  rise: {
    title: "tasks.rise.title",
    objective: "tasks.rise.objective",
    notes: {
      useRise: "tasks.rise.notes.useRise",
      levelGeometry: "tasks.rise.notes.levelGeometry",
    },
    criteria: {
      buildingTopVisible: "tasks.rise.criteria.buildingTopVisible",
      buildingMainVisible: "tasks.rise.criteria.buildingMainVisible",
      movementUsed: "tasks.rise.criteria.movementUsed",
      movementRange: "tasks.rise.criteria.movementRange",
    },
    feedback: {
      passPrimary: "tasks.rise.feedback.passPrimary",
      defaultFailPrimary: "tasks.rise.feedback.defaultFailPrimary",
      primary: {
        buildingTopVisible: "tasks.rise.feedback.primary.buildingTopVisible",
        buildingMainVisible: "tasks.rise.feedback.primary.buildingMainVisible",
        movementUsed: "tasks.rise.feedback.primary.movementUsed",
        movementRange: "tasks.rise.feedback.primary.movementRange",
      },
      secondary: {
        buildingTopVisible: "tasks.rise.feedback.secondary.buildingTopVisible",
        buildingMainVisible: "tasks.rise.feedback.secondary.buildingMainVisible",
        movementUsed: "tasks.rise.feedback.secondary.movementUsed",
        movementRange: "tasks.rise.feedback.secondary.movementRange",
      },
    },
  },
  tableTilt: {
    title: "tasks.tableTilt.title",
    objective: "tasks.tableTilt.objective",
    notes: {
      focusAndTilt: "tasks.tableTilt.notes.focusAndTilt",
      constraints: "tasks.tableTilt.notes.constraints",
    },
    criteria: {
      allowedAperture: "tasks.tableTilt.criteria.allowedAperture",
      riseZero: "tasks.tableTilt.criteria.riseZero",
      swingZero: "tasks.tableTilt.criteria.swingZero",
      movementRange: "tasks.tableTilt.criteria.movementRange",
      nearSharp: "tasks.tableTilt.criteria.nearSharp",
      midSharp: "tasks.tableTilt.criteria.midSharp",
      farSharp: "tasks.tableTilt.criteria.farSharp",
    },
    feedback: {
      passPrimary: "tasks.tableTilt.feedback.passPrimary",
      defaultFailPrimary: "tasks.tableTilt.feedback.defaultFailPrimary",
      primary: {
        allowedAperture: "tasks.tableTilt.feedback.primary.allowedAperture",
        riseZero: "tasks.tableTilt.feedback.primary.riseZero",
        swingZero: "tasks.tableTilt.feedback.primary.swingZero",
        movementRange: "tasks.tableTilt.feedback.primary.movementRange",
        nearSharp: "tasks.tableTilt.feedback.primary.nearSharp",
        midSharp: "tasks.tableTilt.feedback.primary.midSharp",
        farSharp: "tasks.tableTilt.feedback.primary.farSharp",
      },
      secondary: {
        allowedAperture: "tasks.tableTilt.feedback.secondary.allowedAperture",
        riseZero: "tasks.tableTilt.feedback.secondary.riseZero",
        swingZero: "tasks.tableTilt.feedback.secondary.swingZero",
        movementRange: "tasks.tableTilt.feedback.secondary.movementRange",
        nearSharp: "tasks.tableTilt.feedback.secondary.nearSharp",
        midSharp: "tasks.tableTilt.feedback.secondary.midSharp",
        farSharp: "tasks.tableTilt.feedback.secondary.farSharp",
      },
    },
  },
  shelfSwing: {
    title: "tasks.shelfSwing.title",
    objective: "tasks.shelfSwing.objective",
    notes: {
      focusAndSwing: "tasks.shelfSwing.notes.focusAndSwing",
      constraints: "tasks.shelfSwing.notes.constraints",
    },
    criteria: {
      allowedAperture: "tasks.shelfSwing.criteria.allowedAperture",
      riseZero: "tasks.shelfSwing.criteria.riseZero",
      tiltZero: "tasks.shelfSwing.criteria.tiltZero",
      movementRange: "tasks.shelfSwing.criteria.movementRange",
      frontSharp: "tasks.shelfSwing.criteria.frontSharp",
      middleSharp: "tasks.shelfSwing.criteria.middleSharp",
      backSharp: "tasks.shelfSwing.criteria.backSharp",
    },
    feedback: {
      passPrimary: "tasks.shelfSwing.feedback.passPrimary",
      defaultFailPrimary: "tasks.shelfSwing.feedback.defaultFailPrimary",
      primary: {
        allowedAperture: "tasks.shelfSwing.feedback.primary.allowedAperture",
        riseZero: "tasks.shelfSwing.feedback.primary.riseZero",
        tiltZero: "tasks.shelfSwing.feedback.primary.tiltZero",
        movementRange: "tasks.shelfSwing.feedback.primary.movementRange",
        frontSharp: "tasks.shelfSwing.feedback.primary.frontSharp",
        middleSharp: "tasks.shelfSwing.feedback.primary.middleSharp",
        backSharp: "tasks.shelfSwing.feedback.primary.backSharp",
      },
      secondary: {
        allowedAperture: "tasks.shelfSwing.feedback.secondary.allowedAperture",
        riseZero: "tasks.shelfSwing.feedback.secondary.riseZero",
        tiltZero: "tasks.shelfSwing.feedback.secondary.tiltZero",
        movementRange: "tasks.shelfSwing.feedback.secondary.movementRange",
        frontSharp: "tasks.shelfSwing.feedback.secondary.frontSharp",
        middleSharp: "tasks.shelfSwing.feedback.secondary.middleSharp",
        backSharp: "tasks.shelfSwing.feedback.secondary.backSharp",
      },
    },
  },
  mirrorShift: {
    title: "tasks.mirrorShift.title",
    objective: "tasks.mirrorShift.objective",
    notes: {
      clearReflection: "tasks.mirrorShift.notes.clearReflection",
      restoreFraming: "tasks.mirrorShift.notes.restoreFraming",
      retainViewpoint: "tasks.mirrorShift.notes.retainViewpoint",
    },
    criteria: {
      reflectionClear: "tasks.mirrorShift.criteria.reflectionClear",
      framingRestored: "tasks.mirrorShift.criteria.framingRestored",
      viewpointRetained: "tasks.mirrorShift.criteria.viewpointRetained",
    },
    feedback: {
      passPrimary: "tasks.mirrorShift.feedback.passPrimary",
      passSecondary: "tasks.mirrorShift.feedback.passSecondary",
      defaultFailPrimary: "tasks.mirrorShift.feedback.defaultFailPrimary",
      primary: {
        reflectionClear: "tasks.mirrorShift.feedback.primary.reflectionClear",
        framingRestored: "tasks.mirrorShift.feedback.primary.framingRestored",
        viewpointRetained: "tasks.mirrorShift.feedback.primary.viewpointRetained",
      },
      secondary: {
        reflectionClear: "tasks.mirrorShift.feedback.secondary.reflectionClear",
        framingRestored: "tasks.mirrorShift.feedback.secondary.framingRestored",
        viewpointRetained: "tasks.mirrorShift.feedback.secondary.viewpointRetained",
      },
    },
  },
} as const;

type StringLeaves<T> = T extends string
  ? T
  : T extends object
    ? StringLeaves<T[keyof T]>
    : never;

export type GuidedTaskMessageKey = StringLeaves<typeof guidedTaskMessageKeys>;
