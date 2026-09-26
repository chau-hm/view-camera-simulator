export const readoutMessageKeys = {
  macroFocus: {
    title: "readouts.macroFocus.title",
    extension: "readouts.macroFocus.extension",
    magnification: "readouts.macroFocus.magnification",
    reproductionRatio: "readouts.macroFocus.reproductionRatio",
    selectedFocusPlaneMagnification: "readouts.macroFocus.selectedFocusPlaneMagnification",
    selectedFocusPlaneRatio: "readouts.macroFocus.selectedFocusPlaneRatio",
    factor: "readouts.macroFocus.factor",
    exposure: "readouts.macroFocus.exposure",
    imageCircle: "readouts.macroFocus.imageCircle",
    imageCircleValue: "readouts.macroFocus.imageCircleValue",
    stops: "readouts.macroFocus.stops",
    requiredExtension: "readouts.macroFocus.requiredExtension",
    availableTravel: "readouts.macroFocus.availableTravel",
    travelWarning: "readouts.macroFocus.travelWarning",
    lifeSize: "readouts.macroFocus.lifeSize",
    note: "readouts.macroFocus.note",
  },
  controls: {
    frontRise: "readouts.controls.frontRise",
    rearRise: "readouts.controls.rearRise",
    frontTilt: "readouts.controls.frontTilt",
    rearTilt: "readouts.controls.rearTilt",
    frontSwing: "readouts.controls.frontSwing",
    rearSwing: "readouts.controls.rearSwing",
    frontShift: "readouts.controls.frontShift",
    rearShift: "readouts.controls.rearShift",
  },
  teaching: {
    neutralViewpoint: "readouts.teaching.neutralViewpoint",
    higherViewpoint: "readouts.teaching.higherViewpoint",
    lowerViewpoint: "readouts.teaching.lowerViewpoint",
    frontTilt: "readouts.teaching.frontTilt",
    rearTilt: "readouts.teaching.rearTilt",
    frontRise: "readouts.teaching.frontRise",
    rearRise: "readouts.teaching.rearRise",
    frontFall: "readouts.teaching.frontFall",
    rearFall: "readouts.teaching.rearFall",
    bodyPitch: "readouts.teaching.bodyPitch",
  },
  focusTargets: {
    title: "readouts.focusTargets.title",
    ariaLabel: "readouts.focusTargets.ariaLabel",
    pointFocus: "readouts.focusTargets.pointFocus",
    patchCoverage: "readouts.focusTargets.patchCoverage",
    focus: "readouts.focusTargets.focus",
    sharp: "readouts.focusTargets.sharp",
    acceptable: "readouts.focusTargets.acceptable",
    soft: "readouts.focusTargets.soft",
    closestPoint: "readouts.focusTargets.closestPoint",
    sharpnessAria: "readouts.focusTargets.sharpnessAria",
  },
  focusDistribution: {
    title: "readouts.focusDistribution.title",
    ariaLabel: "readouts.focusDistribution.ariaLabel",
    raw: "readouts.focusDistribution.raw",
    upright: "readouts.focusDistribution.upright",
    orientationAria: "readouts.focusDistribution.orientationAria",
    targetAria: "readouts.focusDistribution.targetAria",
    unplacedHeading: "readouts.focusDistribution.unplacedHeading",
    unplacedTargetsAria: "readouts.focusDistribution.unplacedTargetsAria",
    unplacedTarget: "readouts.focusDistribution.unplacedTarget",
    positions: {
      upperLeft: "readouts.focusDistribution.positions.upperLeft",
      upperCentre: "readouts.focusDistribution.positions.upperCentre",
      upperRight: "readouts.focusDistribution.positions.upperRight",
      middleLeft: "readouts.focusDistribution.positions.middleLeft",
      middleRight: "readouts.focusDistribution.positions.middleRight",
      centre: "readouts.focusDistribution.positions.centre",
      lowerLeft: "readouts.focusDistribution.positions.lowerLeft",
      lowerCentre: "readouts.focusDistribution.positions.lowerCentre",
      lowerRight: "readouts.focusDistribution.positions.lowerRight",
    },
  },
} as const;

type StringLeaves<T> = T extends string
  ? T
  : T extends object
    ? StringLeaves<T[keyof T]>
    : never;

export type ReadoutMessageKey = StringLeaves<typeof readoutMessageKeys>;
