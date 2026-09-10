export const readoutMessageKeys = {
  container: {
    ariaLabel: "readouts.container.ariaLabel",
  },
  currentSettings: {
    title: "readouts.currentSettings.title",
    ariaLabel: "readouts.currentSettings.ariaLabel",
  },
  groups: {
    movement: "readouts.groups.movement",
    movementRelationship: "readouts.groups.movementRelationship",
    exposureFocus: "readouts.groups.exposureFocus",
    focusMethod: "readouts.groups.focusMethod",
    viewpointFraming: "readouts.groups.viewpointFraming",
  },
  controls: {
    frontRise: "readouts.controls.frontRise",
    rearRise: "readouts.controls.rearRise",
    frontTilt: "readouts.controls.frontTilt",
    rearTilt: "readouts.controls.rearTilt",
    frontSwing: "readouts.controls.frontSwing",
    rearSwing: "readouts.controls.rearSwing",
    focus: "readouts.controls.focus",
    aperture: "readouts.controls.aperture",
    cameraPosition: "readouts.controls.cameraPosition",
    frontShift: "readouts.controls.frontShift",
    rearShift: "readouts.controls.rearShift",
  },
  focusMethod: {
    frontStandard: "readouts.focusMethod.frontStandard",
    rearStandard: "readouts.focusMethod.rearStandard",
    movement: "readouts.focusMethod.movement",
    frontRelationship: "readouts.focusMethod.frontRelationship",
    rearRelationship: "readouts.focusMethod.rearRelationship",
  },
  teaching: {
    neutralViewpoint: "readouts.teaching.neutralViewpoint",
    higherViewpoint: "readouts.teaching.higherViewpoint",
    lowerViewpoint: "readouts.teaching.lowerViewpoint",
    towardHigherViewpoint: "readouts.teaching.towardHigherViewpoint",
    towardLowerViewpoint: "readouts.teaching.towardLowerViewpoint",
    frontTilt: "readouts.teaching.frontTilt",
    rearTilt: "readouts.teaching.rearTilt",
    frontRise: "readouts.teaching.frontRise",
    rearRise: "readouts.teaching.rearRise",
    frontFall: "readouts.teaching.frontFall",
    rearFall: "readouts.teaching.rearFall",
    bodyPitch: "readouts.teaching.bodyPitch",
    frontStandard: "readouts.teaching.frontStandard",
    rearStandard: "readouts.teaching.rearStandard",
    frontVerticalFraming: "readouts.teaching.frontVerticalFraming",
    rearVerticalFraming: "readouts.teaching.rearVerticalFraming",
    upperFraming: "readouts.teaching.upperFraming",
    middleFraming: "readouts.teaching.middleFraming",
    lowerFraming: "readouts.teaching.lowerFraming",
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
    additionalTargetsAria: "readouts.focusDistribution.additionalTargetsAria",
    unplacedTarget: "readouts.focusDistribution.unplacedTarget",
    positions: {
      nearLeft: "readouts.focusDistribution.positions.nearLeft",
      nearCentre: "readouts.focusDistribution.positions.nearCentre",
      nearRight: "readouts.focusDistribution.positions.nearRight",
      middle: "readouts.focusDistribution.positions.middle",
      farLeft: "readouts.focusDistribution.positions.farLeft",
      farCentre: "readouts.focusDistribution.positions.farCentre",
      farRight: "readouts.focusDistribution.positions.farRight",
    },
  },
} as const;

type StringLeaves<T> = T extends string
  ? T
  : T extends object
    ? StringLeaves<T[keyof T]>
    : never;

export type ReadoutMessageKey = StringLeaves<typeof readoutMessageKeys>;
