import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { guidedTaskMessageKeys, type GuidedTaskMessageKey } from "../../i18n/guidedTaskMessageKeys";
import type { MessageRef, MessageValues, TaskDefinition, TaskSuccessCriterion } from "../../types/task";

export type GuidedTaskMessageRef = MessageRef<GuidedTaskMessageKey>;

type GuidedTaskFeedbackKeyMap = {
  passPrimary: GuidedTaskMessageKey;
  passSecondary?: GuidedTaskMessageKey;
  defaultFailPrimary: GuidedTaskMessageKey;
  primary: Record<string, GuidedTaskMessageKey>;
  secondary: Record<string, GuidedTaskMessageKey>;
};

type GuidedTaskCopyKeyMap = {
  title: GuidedTaskMessageKey;
  objective: GuidedTaskMessageKey;
  notes: readonly GuidedTaskMessageKey[];
  criteria: Record<string, GuidedTaskMessageKey>;
  feedback: GuidedTaskFeedbackKeyMap;
};

export type GuidedTaskCopy = {
  title: GuidedTaskMessageRef;
  objective: GuidedTaskMessageRef;
  notes: GuidedTaskMessageRef[];
  criteria: Record<string, GuidedTaskMessageRef>;
  feedback: {
    passPrimary: GuidedTaskMessageRef;
    passSecondary?: GuidedTaskMessageRef;
    defaultFailPrimary: GuidedTaskMessageRef;
    primary: Record<string, GuidedTaskMessageRef>;
    secondary: Record<string, GuidedTaskMessageRef>;
  };
};

const k = guidedTaskMessageKeys;

export const guidedTaskCopyKeyMap: Record<string, GuidedTaskCopyKeyMap> = {
  "rise-01": {
    title: k.rise.title,
    objective: k.rise.objective,
    notes: [k.rise.notes.useRise, k.rise.notes.levelGeometry],
    criteria: {
      "rise-building-top-visible": k.rise.criteria.buildingTopVisible,
      "rise-building-main-visible": k.rise.criteria.buildingMainVisible,
      "rise-movement-used": k.rise.criteria.movementUsed,
      "rise-movement-range": k.rise.criteria.movementRange,
    },
    feedback: {
      passPrimary: k.rise.feedback.passPrimary,
      defaultFailPrimary: k.rise.feedback.defaultFailPrimary,
      primary: {
        "rise-building-top-visible": k.rise.feedback.primary.buildingTopVisible,
        "rise-building-main-visible": k.rise.feedback.primary.buildingMainVisible,
        "rise-movement-used": k.rise.feedback.primary.movementUsed,
        "rise-movement-range": k.rise.feedback.primary.movementRange,
      },
      secondary: {
        "rise-building-top-visible": k.rise.feedback.secondary.buildingTopVisible,
        "rise-building-main-visible": k.rise.feedback.secondary.buildingMainVisible,
        "rise-movement-used": k.rise.feedback.secondary.movementUsed,
        "rise-movement-range": k.rise.feedback.secondary.movementRange,
      },
    },
  },
  "oblique-rise-01": {
    title: k.obliqueRise.title,
    objective: k.obliqueRise.objective,
    notes: [k.obliqueRise.notes.useRise, k.obliqueRise.notes.keepBase, k.obliqueRise.notes.depth],
    criteria: {
      "oblique-rise-building-top-visible": k.obliqueRise.criteria.buildingTopVisible,
      "oblique-rise-building-base-visible": k.obliqueRise.criteria.buildingBaseVisible,
      "oblique-rise-camera-level": k.obliqueRise.criteria.cameraLevel,
      "oblique-rise-movement-used": k.obliqueRise.criteria.movementUsed,
    },
    feedback: {
      passPrimary: k.obliqueRise.feedback.passPrimary,
      defaultFailPrimary: k.obliqueRise.feedback.defaultFailPrimary,
      primary: {
        "oblique-rise-building-top-visible": k.obliqueRise.feedback.primary.buildingTopVisible,
        "oblique-rise-building-base-visible": k.obliqueRise.feedback.primary.buildingBaseVisible,
        "oblique-rise-camera-level": k.obliqueRise.feedback.primary.cameraLevel,
        "oblique-rise-movement-used": k.obliqueRise.feedback.primary.movementUsed,
      },
      secondary: {
        "oblique-rise-building-top-visible": k.obliqueRise.feedback.secondary.buildingTopVisible,
        "oblique-rise-building-base-visible": k.obliqueRise.feedback.secondary.buildingBaseVisible,
        "oblique-rise-camera-level": k.obliqueRise.feedback.secondary.cameraLevel,
        "oblique-rise-movement-used": k.obliqueRise.feedback.secondary.movementUsed,
      },
    },
  },
  "architecture-foreground-rise-01": {
    title: k.architectureForegroundRise.title,
    objective: k.architectureForegroundRise.objective,
    notes: [
      k.architectureForegroundRise.notes.useRise,
      k.architectureForegroundRise.notes.keepBase,
      k.architectureForegroundRise.notes.foreground,
    ],
    criteria: {
      "architecture-foreground-rise-building-top-visible":
        k.architectureForegroundRise.criteria.buildingTopVisible,
      "architecture-foreground-rise-building-base-visible":
        k.architectureForegroundRise.criteria.buildingBaseVisible,
      "architecture-foreground-rise-camera-level": k.architectureForegroundRise.criteria.cameraLevel,
      "architecture-foreground-rise-movement-used": k.architectureForegroundRise.criteria.movementUsed,
    },
    feedback: {
      passPrimary: k.architectureForegroundRise.feedback.passPrimary,
      defaultFailPrimary: k.architectureForegroundRise.feedback.defaultFailPrimary,
      primary: {
        "architecture-foreground-rise-building-top-visible":
          k.architectureForegroundRise.feedback.primary.buildingTopVisible,
        "architecture-foreground-rise-building-base-visible":
          k.architectureForegroundRise.feedback.primary.buildingBaseVisible,
        "architecture-foreground-rise-camera-level":
          k.architectureForegroundRise.feedback.primary.cameraLevel,
        "architecture-foreground-rise-movement-used":
          k.architectureForegroundRise.feedback.primary.movementUsed,
      },
      secondary: {
        "architecture-foreground-rise-building-top-visible":
          k.architectureForegroundRise.feedback.secondary.buildingTopVisible,
        "architecture-foreground-rise-building-base-visible":
          k.architectureForegroundRise.feedback.secondary.buildingBaseVisible,
        "architecture-foreground-rise-camera-level":
          k.architectureForegroundRise.feedback.secondary.cameraLevel,
        "architecture-foreground-rise-movement-used":
          k.architectureForegroundRise.feedback.secondary.movementUsed,
      },
    },
  },
  "architecture-foreground-tilt-focus-01": {
    title: k.architectureForegroundTiltFocus.title,
    objective: k.architectureForegroundTiltFocus.objective,
    notes: [
      k.architectureForegroundTiltFocus.notes.composition,
      k.architectureForegroundTiltFocus.notes.tilt,
      k.architectureForegroundTiltFocus.notes.focus,
      k.architectureForegroundTiltFocus.notes.depthOfField,
    ],
    criteria: {
      "architecture-foreground-tilt-focus-building-top-visible":
        k.architectureForegroundTiltFocus.criteria.buildingTopVisible,
      "architecture-foreground-tilt-focus-building-base-visible":
        k.architectureForegroundTiltFocus.criteria.buildingBaseVisible,
      "architecture-foreground-tilt-focus-camera-level":
        k.architectureForegroundTiltFocus.criteria.cameraLevel,
      "architecture-foreground-tilt-focus-tilt-used":
        k.architectureForegroundTiltFocus.criteria.tiltUsed,
      "architecture-foreground-tilt-focus-tilt-range":
        k.architectureForegroundTiltFocus.criteria.tiltRange,
      "architecture-foreground-tilt-focus-focus-used":
        k.architectureForegroundTiltFocus.criteria.focusUsed,
      "architecture-foreground-tilt-focus-near-sharp":
        k.architectureForegroundTiltFocus.criteria.nearSharp,
      "architecture-foreground-tilt-focus-building-sharp":
        k.architectureForegroundTiltFocus.criteria.buildingSharp,
    },
    feedback: {
      passPrimary: k.architectureForegroundTiltFocus.feedback.passPrimary,
      defaultFailPrimary: k.architectureForegroundTiltFocus.feedback.defaultFailPrimary,
      primary: {
        "architecture-foreground-tilt-focus-building-top-visible":
          k.architectureForegroundTiltFocus.feedback.primary.buildingTopVisible,
        "architecture-foreground-tilt-focus-building-base-visible":
          k.architectureForegroundTiltFocus.feedback.primary.buildingBaseVisible,
        "architecture-foreground-tilt-focus-camera-level":
          k.architectureForegroundTiltFocus.feedback.primary.cameraLevel,
        "architecture-foreground-tilt-focus-tilt-used":
          k.architectureForegroundTiltFocus.feedback.primary.tiltUsed,
        "architecture-foreground-tilt-focus-tilt-range":
          k.architectureForegroundTiltFocus.feedback.primary.tiltRange,
        "architecture-foreground-tilt-focus-focus-used":
          k.architectureForegroundTiltFocus.feedback.primary.focusUsed,
        "architecture-foreground-tilt-focus-near-sharp":
          k.architectureForegroundTiltFocus.feedback.primary.nearSharp,
        "architecture-foreground-tilt-focus-building-sharp":
          k.architectureForegroundTiltFocus.feedback.primary.buildingSharp,
      },
      secondary: {
        "architecture-foreground-tilt-focus-building-top-visible":
          k.architectureForegroundTiltFocus.feedback.secondary.buildingTopVisible,
        "architecture-foreground-tilt-focus-building-base-visible":
          k.architectureForegroundTiltFocus.feedback.secondary.buildingBaseVisible,
        "architecture-foreground-tilt-focus-camera-level":
          k.architectureForegroundTiltFocus.feedback.secondary.cameraLevel,
        "architecture-foreground-tilt-focus-tilt-used":
          k.architectureForegroundTiltFocus.feedback.secondary.tiltUsed,
        "architecture-foreground-tilt-focus-tilt-range":
          k.architectureForegroundTiltFocus.feedback.secondary.tiltRange,
        "architecture-foreground-tilt-focus-focus-used":
          k.architectureForegroundTiltFocus.feedback.secondary.focusUsed,
        "architecture-foreground-tilt-focus-near-sharp":
          k.architectureForegroundTiltFocus.feedback.secondary.nearSharp,
        "architecture-foreground-tilt-focus-building-sharp":
          k.architectureForegroundTiltFocus.feedback.secondary.buildingSharp,
      },
    },
  },
  "architecture-foreground-dof-01": {
    title: k.architectureForegroundDof.title,
    objective: k.architectureForegroundDof.objective,
    notes: [
      k.architectureForegroundDof.notes.composition,
      k.architectureForegroundDof.notes.focusPlane,
      k.architectureForegroundDof.notes.aperture,
      k.architectureForegroundDof.notes.depthOfField,
    ],
    criteria: {
      "architecture-foreground-dof-building-top-visible":
        k.architectureForegroundDof.criteria.buildingTopVisible,
      "architecture-foreground-dof-building-base-visible":
        k.architectureForegroundDof.criteria.buildingBaseVisible,
      "architecture-foreground-dof-camera-level": k.architectureForegroundDof.criteria.cameraLevel,
      "architecture-foreground-dof-aperture": k.architectureForegroundDof.criteria.aperture,
      "architecture-foreground-dof-focus-targets": k.architectureForegroundDof.criteria.focusTargets,
    },
    feedback: {
      passPrimary: k.architectureForegroundDof.feedback.passPrimary,
      defaultFailPrimary: k.architectureForegroundDof.feedback.defaultFailPrimary,
      primary: {
        "architecture-foreground-dof-building-top-visible":
          k.architectureForegroundDof.feedback.primary.buildingTopVisible,
        "architecture-foreground-dof-building-base-visible":
          k.architectureForegroundDof.feedback.primary.buildingBaseVisible,
        "architecture-foreground-dof-camera-level":
          k.architectureForegroundDof.feedback.primary.cameraLevel,
        "architecture-foreground-dof-aperture": k.architectureForegroundDof.feedback.primary.aperture,
        "architecture-foreground-dof-focus-targets":
          k.architectureForegroundDof.feedback.primary.focusTargets,
      },
      secondary: {
        "architecture-foreground-dof-building-top-visible":
          k.architectureForegroundDof.feedback.secondary.buildingTopVisible,
        "architecture-foreground-dof-building-base-visible":
          k.architectureForegroundDof.feedback.secondary.buildingBaseVisible,
        "architecture-foreground-dof-camera-level":
          k.architectureForegroundDof.feedback.secondary.cameraLevel,
        "architecture-foreground-dof-aperture": k.architectureForegroundDof.feedback.secondary.aperture,
        "architecture-foreground-dof-focus-targets":
          k.architectureForegroundDof.feedback.secondary.focusTargets,
      },
    },
  },
  "architecture-foreground-compound-01": {
    title: k.architectureForegroundCompound.title,
    objective: k.architectureForegroundCompound.objective,
    notes: [
      k.architectureForegroundCompound.notes.composition,
      k.architectureForegroundCompound.notes.tilt,
      k.architectureForegroundCompound.notes.focus,
      k.architectureForegroundCompound.notes.aperture,
    ],
    criteria: {
      "architecture-foreground-compound-building-top-visible":
        k.architectureForegroundCompound.criteria.buildingTopVisible,
      "architecture-foreground-compound-building-base-visible":
        k.architectureForegroundCompound.criteria.buildingBaseVisible,
      "architecture-foreground-compound-camera-level":
        k.architectureForegroundCompound.criteria.cameraLevel,
      "architecture-foreground-compound-tilt-used":
        k.architectureForegroundTiltFocus.criteria.tiltUsed,
      "architecture-foreground-compound-tilt-range":
        k.architectureForegroundTiltFocus.criteria.tiltRange,
      "architecture-foreground-compound-focus-used":
        k.architectureForegroundTiltFocus.criteria.focusUsed,
      "architecture-foreground-compound-focus-targets":
        k.architectureForegroundCompound.criteria.focusTargets,
    },
    feedback: {
      passPrimary: k.architectureForegroundCompound.feedback.passPrimary,
      defaultFailPrimary: k.architectureForegroundCompound.feedback.defaultFailPrimary,
      primary: {
        "architecture-foreground-compound-building-top-visible":
          k.architectureForegroundCompound.feedback.primary.buildingTopVisible,
        "architecture-foreground-compound-building-base-visible":
          k.architectureForegroundCompound.feedback.primary.buildingBaseVisible,
        "architecture-foreground-compound-camera-level":
          k.architectureForegroundCompound.feedback.primary.cameraLevel,
        "architecture-foreground-compound-tilt-used":
          k.architectureForegroundTiltFocus.feedback.primary.tiltUsed,
        "architecture-foreground-compound-tilt-range":
          k.architectureForegroundTiltFocus.feedback.primary.tiltRange,
        "architecture-foreground-compound-focus-used":
          k.architectureForegroundTiltFocus.feedback.primary.focusUsed,
        "architecture-foreground-compound-focus-targets":
          k.architectureForegroundCompound.feedback.primary.focusTargets,
      },
      secondary: {
        "architecture-foreground-compound-building-top-visible":
          k.architectureForegroundCompound.feedback.secondary.buildingTopVisible,
        "architecture-foreground-compound-building-base-visible":
          k.architectureForegroundCompound.feedback.secondary.buildingBaseVisible,
        "architecture-foreground-compound-camera-level":
          k.architectureForegroundCompound.feedback.secondary.cameraLevel,
        "architecture-foreground-compound-tilt-used":
          k.architectureForegroundTiltFocus.feedback.secondary.tiltUsed,
        "architecture-foreground-compound-tilt-range":
          k.architectureForegroundTiltFocus.feedback.secondary.tiltRange,
        "architecture-foreground-compound-focus-used":
          k.architectureForegroundTiltFocus.feedback.secondary.focusUsed,
        "architecture-foreground-compound-focus-targets":
          k.architectureForegroundCompound.feedback.secondary.focusTargets,
      },
    },
  },
  "oblique-swing-focus-01": {
    title: k.obliqueSwingFocus.title,
    objective: k.obliqueSwingFocus.objective,
    notes: [
      k.obliqueSwingFocus.notes.composition,
      k.obliqueSwingFocus.notes.swing,
      k.obliqueSwingFocus.notes.focus,
      k.obliqueSwingFocus.notes.level,
    ],
    criteria: {
      "oblique-swing-focus-building-top-visible": k.obliqueSwingFocus.criteria.buildingTopVisible,
      "oblique-swing-focus-building-base-visible": k.obliqueSwingFocus.criteria.buildingBaseVisible,
      "oblique-swing-focus-camera-level": k.obliqueSwingFocus.criteria.cameraLevel,
      "oblique-swing-focus-near-sharp": k.obliqueSwingFocus.criteria.nearSharp,
      "oblique-swing-focus-middle-sharp": k.obliqueSwingFocus.criteria.middleSharp,
      "oblique-swing-focus-far-sharp": k.obliqueSwingFocus.criteria.farSharp,
    },
    feedback: {
      passPrimary: k.obliqueSwingFocus.feedback.passPrimary,
      defaultFailPrimary: k.obliqueSwingFocus.feedback.defaultFailPrimary,
      primary: {
        "oblique-swing-focus-building-top-visible": k.obliqueSwingFocus.feedback.primary.buildingTopVisible,
        "oblique-swing-focus-building-base-visible": k.obliqueSwingFocus.feedback.primary.buildingBaseVisible,
        "oblique-swing-focus-camera-level": k.obliqueSwingFocus.feedback.primary.cameraLevel,
        "oblique-swing-focus-near-sharp": k.obliqueSwingFocus.feedback.primary.nearSharp,
        "oblique-swing-focus-middle-sharp": k.obliqueSwingFocus.feedback.primary.middleSharp,
        "oblique-swing-focus-far-sharp": k.obliqueSwingFocus.feedback.primary.farSharp,
      },
      secondary: {
        "oblique-swing-focus-building-top-visible": k.obliqueSwingFocus.feedback.secondary.buildingTopVisible,
        "oblique-swing-focus-building-base-visible": k.obliqueSwingFocus.feedback.secondary.buildingBaseVisible,
        "oblique-swing-focus-camera-level": k.obliqueSwingFocus.feedback.secondary.cameraLevel,
        "oblique-swing-focus-near-sharp": k.obliqueSwingFocus.feedback.secondary.nearSharp,
        "oblique-swing-focus-middle-sharp": k.obliqueSwingFocus.feedback.secondary.middleSharp,
        "oblique-swing-focus-far-sharp": k.obliqueSwingFocus.feedback.secondary.farSharp,
      },
    },
  },
  "oblique-compound-01": {
    title: k.obliqueCompound.title,
    objective: k.obliqueCompound.objective,
    notes: [
      k.obliqueCompound.notes.composition,
      k.obliqueCompound.notes.swing,
      k.obliqueCompound.notes.focus,
      k.obliqueCompound.notes.level,
    ],
    criteria: {
      "oblique-compound-building-top-visible": k.obliqueCompound.criteria.buildingTopVisible,
      "oblique-compound-building-base-visible": k.obliqueCompound.criteria.buildingBaseVisible,
      "oblique-compound-camera-level": k.obliqueCompound.criteria.cameraLevel,
      "oblique-compound-near-sharp": k.obliqueCompound.criteria.nearSharp,
      "oblique-compound-middle-sharp": k.obliqueCompound.criteria.middleSharp,
      "oblique-compound-far-sharp": k.obliqueCompound.criteria.farSharp,
    },
    feedback: {
      passPrimary: k.obliqueCompound.feedback.passPrimary,
      defaultFailPrimary: k.obliqueCompound.feedback.defaultFailPrimary,
      primary: {
        "oblique-compound-building-top-visible": k.obliqueCompound.feedback.primary.buildingTopVisible,
        "oblique-compound-building-base-visible": k.obliqueCompound.feedback.primary.buildingBaseVisible,
        "oblique-compound-camera-level": k.obliqueCompound.feedback.primary.cameraLevel,
        "oblique-compound-near-sharp": k.obliqueCompound.feedback.primary.nearSharp,
        "oblique-compound-middle-sharp": k.obliqueCompound.feedback.primary.middleSharp,
        "oblique-compound-far-sharp": k.obliqueCompound.feedback.primary.farSharp,
      },
      secondary: {
        "oblique-compound-building-top-visible": k.obliqueCompound.feedback.secondary.buildingTopVisible,
        "oblique-compound-building-base-visible": k.obliqueCompound.feedback.secondary.buildingBaseVisible,
        "oblique-compound-camera-level": k.obliqueCompound.feedback.secondary.cameraLevel,
        "oblique-compound-near-sharp": k.obliqueCompound.feedback.secondary.nearSharp,
        "oblique-compound-middle-sharp": k.obliqueCompound.feedback.secondary.middleSharp,
        "oblique-compound-far-sharp": k.obliqueCompound.feedback.secondary.farSharp,
      },
    },
  },
  "oblique-tabletop-focus-01": {
    title: k.obliqueTabletopFocus.title,
    objective: k.obliqueTabletopFocus.objective,
    notes: [k.obliqueTabletopFocus.notes.focus, k.obliqueTabletopFocus.notes.constraints],
    criteria: {
      "oblique-tabletop-focus-allowed-aperture": k.obliqueTabletopFocus.criteria.allowedAperture,
      "oblique-tabletop-focus-rise-zero": k.obliqueTabletopFocus.criteria.riseZero,
      "oblique-tabletop-focus-tilt-zero": k.obliqueTabletopFocus.criteria.tiltZero,
      "oblique-tabletop-focus-swing-zero": k.obliqueTabletopFocus.criteria.swingZero,
      "oblique-tabletop-focus-used": k.obliqueTabletopFocus.criteria.focusUsed,
      "oblique-tabletop-focus-middle-sharp": k.obliqueTabletopFocus.criteria.middleSharp,
    },
    feedback: {
      passPrimary: k.obliqueTabletopFocus.feedback.passPrimary,
      defaultFailPrimary: k.obliqueTabletopFocus.feedback.defaultFailPrimary,
      primary: {
        "oblique-tabletop-focus-allowed-aperture": k.obliqueTabletopFocus.feedback.primary.allowedAperture,
        "oblique-tabletop-focus-rise-zero": k.obliqueTabletopFocus.feedback.primary.riseZero,
        "oblique-tabletop-focus-tilt-zero": k.obliqueTabletopFocus.feedback.primary.tiltZero,
        "oblique-tabletop-focus-swing-zero": k.obliqueTabletopFocus.feedback.primary.swingZero,
        "oblique-tabletop-focus-used": k.obliqueTabletopFocus.feedback.primary.focusUsed,
        "oblique-tabletop-focus-middle-sharp": k.obliqueTabletopFocus.feedback.primary.middleSharp,
      },
      secondary: {
        "oblique-tabletop-focus-allowed-aperture": k.obliqueTabletopFocus.feedback.secondary.allowedAperture,
        "oblique-tabletop-focus-rise-zero": k.obliqueTabletopFocus.feedback.secondary.riseZero,
        "oblique-tabletop-focus-tilt-zero": k.obliqueTabletopFocus.feedback.secondary.tiltZero,
        "oblique-tabletop-focus-swing-zero": k.obliqueTabletopFocus.feedback.secondary.swingZero,
        "oblique-tabletop-focus-used": k.obliqueTabletopFocus.feedback.secondary.focusUsed,
        "oblique-tabletop-focus-middle-sharp": k.obliqueTabletopFocus.feedback.secondary.middleSharp,
      },
    },
  },
  "oblique-tabletop-tilt-01": {
    title: k.obliqueTabletopTilt.title,
    objective: k.obliqueTabletopTilt.objective,
    notes: [k.obliqueTabletopTilt.notes.tilt, k.obliqueTabletopTilt.notes.constraints],
    criteria: {
      "oblique-tabletop-tilt-allowed-aperture": k.obliqueTabletopTilt.criteria.allowedAperture,
      "oblique-tabletop-tilt-rise-zero": k.obliqueTabletopTilt.criteria.riseZero,
      "oblique-tabletop-tilt-swing-zero": k.obliqueTabletopTilt.criteria.swingZero,
      "oblique-tabletop-tilt-movement-range": k.obliqueTabletopTilt.criteria.movementRange,
      "oblique-tabletop-tilt-near-sharp": k.obliqueTabletopTilt.criteria.nearSharp,
      "oblique-tabletop-tilt-middle-sharp": k.obliqueTabletopTilt.criteria.middleSharp,
      "oblique-tabletop-tilt-far-sharp": k.obliqueTabletopTilt.criteria.farSharp,
    },
    feedback: {
      passPrimary: k.obliqueTabletopTilt.feedback.passPrimary,
      defaultFailPrimary: k.obliqueTabletopTilt.feedback.defaultFailPrimary,
      primary: {
        "oblique-tabletop-tilt-allowed-aperture": k.obliqueTabletopTilt.feedback.primary.allowedAperture,
        "oblique-tabletop-tilt-rise-zero": k.obliqueTabletopTilt.feedback.primary.riseZero,
        "oblique-tabletop-tilt-swing-zero": k.obliqueTabletopTilt.feedback.primary.swingZero,
        "oblique-tabletop-tilt-movement-range": k.obliqueTabletopTilt.feedback.primary.movementRange,
        "oblique-tabletop-tilt-near-sharp": k.obliqueTabletopTilt.feedback.primary.nearSharp,
        "oblique-tabletop-tilt-middle-sharp": k.obliqueTabletopTilt.feedback.primary.middleSharp,
        "oblique-tabletop-tilt-far-sharp": k.obliqueTabletopTilt.feedback.primary.farSharp,
      },
      secondary: {
        "oblique-tabletop-tilt-allowed-aperture": k.obliqueTabletopTilt.feedback.secondary.allowedAperture,
        "oblique-tabletop-tilt-rise-zero": k.obliqueTabletopTilt.feedback.secondary.riseZero,
        "oblique-tabletop-tilt-swing-zero": k.obliqueTabletopTilt.feedback.secondary.swingZero,
        "oblique-tabletop-tilt-movement-range": k.obliqueTabletopTilt.feedback.secondary.movementRange,
        "oblique-tabletop-tilt-near-sharp": k.obliqueTabletopTilt.feedback.secondary.nearSharp,
        "oblique-tabletop-tilt-middle-sharp": k.obliqueTabletopTilt.feedback.secondary.middleSharp,
        "oblique-tabletop-tilt-far-sharp": k.obliqueTabletopTilt.feedback.secondary.farSharp,
      },
    },
  },
  "oblique-tabletop-swing-01": {
    title: k.obliqueTabletopSwing.title,
    objective: k.obliqueTabletopSwing.objective,
    notes: [k.obliqueTabletopSwing.notes.swing, k.obliqueTabletopSwing.notes.constraints],
    criteria: {
      "oblique-tabletop-swing-allowed-aperture": k.obliqueTabletopSwing.criteria.allowedAperture,
      "oblique-tabletop-swing-rise-zero": k.obliqueTabletopSwing.criteria.riseZero,
      "oblique-tabletop-swing-tilt-range": k.obliqueTabletopSwing.criteria.tiltRange,
      "oblique-tabletop-swing-movement-range": k.obliqueTabletopSwing.criteria.movementRange,
      "oblique-tabletop-swing-focus-used": k.obliqueTabletopSwing.criteria.focusUsed,
      "oblique-tabletop-swing-lateral-sharp": k.obliqueTabletopSwing.criteria.lateralSharp,
    },
    feedback: {
      passPrimary: k.obliqueTabletopSwing.feedback.passPrimary,
      defaultFailPrimary: k.obliqueTabletopSwing.feedback.defaultFailPrimary,
      primary: {
        "oblique-tabletop-swing-allowed-aperture": k.obliqueTabletopSwing.feedback.primary.allowedAperture,
        "oblique-tabletop-swing-rise-zero": k.obliqueTabletopSwing.feedback.primary.riseZero,
        "oblique-tabletop-swing-tilt-range": k.obliqueTabletopSwing.feedback.primary.tiltRange,
        "oblique-tabletop-swing-movement-range": k.obliqueTabletopSwing.feedback.primary.movementRange,
        "oblique-tabletop-swing-focus-used": k.obliqueTabletopSwing.feedback.primary.focusUsed,
        "oblique-tabletop-swing-lateral-sharp": k.obliqueTabletopSwing.feedback.primary.lateralSharp,
      },
      secondary: {
        "oblique-tabletop-swing-allowed-aperture": k.obliqueTabletopSwing.feedback.secondary.allowedAperture,
        "oblique-tabletop-swing-rise-zero": k.obliqueTabletopSwing.feedback.secondary.riseZero,
        "oblique-tabletop-swing-tilt-range": k.obliqueTabletopSwing.feedback.secondary.tiltRange,
        "oblique-tabletop-swing-movement-range": k.obliqueTabletopSwing.feedback.secondary.movementRange,
        "oblique-tabletop-swing-focus-used": k.obliqueTabletopSwing.feedback.secondary.focusUsed,
        "oblique-tabletop-swing-lateral-sharp": k.obliqueTabletopSwing.feedback.secondary.lateralSharp,
      },
    },
  },
  "oblique-tabletop-refine-01": {
    title: k.obliqueTabletopRefine.title,
    objective: k.obliqueTabletopRefine.objective,
    notes: [k.obliqueTabletopRefine.notes.focus, k.obliqueTabletopRefine.notes.constraints],
    criteria: {
      "oblique-tabletop-refine-allowed-aperture": k.obliqueTabletopRefine.criteria.allowedAperture,
      "oblique-tabletop-refine-rise-zero": k.obliqueTabletopRefine.criteria.riseZero,
      "oblique-tabletop-refine-tilt-range": k.obliqueTabletopRefine.criteria.tiltRange,
      "oblique-tabletop-refine-swing-range": k.obliqueTabletopRefine.criteria.swingRange,
      "oblique-tabletop-refine-focus-used": k.obliqueTabletopRefine.criteria.focusUsed,
      "oblique-tabletop-refine-all-targets-sharp": k.obliqueTabletopRefine.criteria.allTargetsSharp,
    },
    feedback: {
      passPrimary: k.obliqueTabletopRefine.feedback.passPrimary,
      defaultFailPrimary: k.obliqueTabletopRefine.feedback.defaultFailPrimary,
      primary: {
        "oblique-tabletop-refine-allowed-aperture": k.obliqueTabletopRefine.feedback.primary.allowedAperture,
        "oblique-tabletop-refine-rise-zero": k.obliqueTabletopRefine.feedback.primary.riseZero,
        "oblique-tabletop-refine-tilt-range": k.obliqueTabletopRefine.feedback.primary.tiltRange,
        "oblique-tabletop-refine-swing-range": k.obliqueTabletopRefine.feedback.primary.swingRange,
        "oblique-tabletop-refine-focus-used": k.obliqueTabletopRefine.feedback.primary.focusUsed,
        "oblique-tabletop-refine-all-targets-sharp": k.obliqueTabletopRefine.feedback.primary.allTargetsSharp,
      },
      secondary: {
        "oblique-tabletop-refine-allowed-aperture": k.obliqueTabletopRefine.feedback.secondary.allowedAperture,
        "oblique-tabletop-refine-rise-zero": k.obliqueTabletopRefine.feedback.secondary.riseZero,
        "oblique-tabletop-refine-tilt-range": k.obliqueTabletopRefine.feedback.secondary.tiltRange,
        "oblique-tabletop-refine-swing-range": k.obliqueTabletopRefine.feedback.secondary.swingRange,
        "oblique-tabletop-refine-focus-used": k.obliqueTabletopRefine.feedback.secondary.focusUsed,
        "oblique-tabletop-refine-all-targets-sharp": k.obliqueTabletopRefine.feedback.secondary.allTargetsSharp,
      },
    },
  },
  "oblique-tabletop-aperture-01": {
    title: k.obliqueTabletopAperture.title,
    objective: k.obliqueTabletopAperture.objective,
    notes: [k.obliqueTabletopAperture.notes.aperture, k.obliqueTabletopAperture.notes.constraints],
    criteria: {
      "oblique-tabletop-aperture-allowed-aperture": k.obliqueTabletopAperture.criteria.allowedAperture,
      "oblique-tabletop-aperture-rise-zero": k.obliqueTabletopAperture.criteria.riseZero,
      "oblique-tabletop-aperture-tilt-range": k.obliqueTabletopAperture.criteria.tiltRange,
      "oblique-tabletop-aperture-swing-range": k.obliqueTabletopAperture.criteria.swingRange,
      "oblique-tabletop-aperture-all-targets-sharp": k.obliqueTabletopAperture.criteria.allTargetsSharp,
    },
    feedback: {
      passPrimary: k.obliqueTabletopAperture.feedback.passPrimary,
      defaultFailPrimary: k.obliqueTabletopAperture.feedback.defaultFailPrimary,
      primary: {
        "oblique-tabletop-aperture-allowed-aperture": k.obliqueTabletopAperture.feedback.primary.allowedAperture,
        "oblique-tabletop-aperture-rise-zero": k.obliqueTabletopAperture.feedback.primary.riseZero,
        "oblique-tabletop-aperture-tilt-range": k.obliqueTabletopAperture.feedback.primary.tiltRange,
        "oblique-tabletop-aperture-swing-range": k.obliqueTabletopAperture.feedback.primary.swingRange,
        "oblique-tabletop-aperture-all-targets-sharp": k.obliqueTabletopAperture.feedback.primary.allTargetsSharp,
      },
      secondary: {
        "oblique-tabletop-aperture-allowed-aperture": k.obliqueTabletopAperture.feedback.secondary.allowedAperture,
        "oblique-tabletop-aperture-rise-zero": k.obliqueTabletopAperture.feedback.secondary.riseZero,
        "oblique-tabletop-aperture-tilt-range": k.obliqueTabletopAperture.feedback.secondary.tiltRange,
        "oblique-tabletop-aperture-swing-range": k.obliqueTabletopAperture.feedback.secondary.swingRange,
        "oblique-tabletop-aperture-all-targets-sharp": k.obliqueTabletopAperture.feedback.secondary.allTargetsSharp,
      },
    },
  },
  "tilt-01": {
    title: k.tableTilt.title,
    objective: k.tableTilt.objective,
    notes: [k.tableTilt.notes.focusAndTilt, k.tableTilt.notes.constraints],
    criteria: {
      "tilt-allowed-aperture": k.tableTilt.criteria.allowedAperture,
      "tilt-rise-zero": k.tableTilt.criteria.riseZero,
      "tilt-swing-zero": k.tableTilt.criteria.swingZero,
      "tilt-movement-range": k.tableTilt.criteria.movementRange,
      "tilt-near-sharp": k.tableTilt.criteria.nearSharp,
      "tilt-mid-sharp": k.tableTilt.criteria.midSharp,
      "tilt-far-sharp": k.tableTilt.criteria.farSharp,
    },
    feedback: {
      passPrimary: k.tableTilt.feedback.passPrimary,
      defaultFailPrimary: k.tableTilt.feedback.defaultFailPrimary,
      primary: {
        "tilt-allowed-aperture": k.tableTilt.feedback.primary.allowedAperture,
        "tilt-rise-zero": k.tableTilt.feedback.primary.riseZero,
        "tilt-swing-zero": k.tableTilt.feedback.primary.swingZero,
        "tilt-movement-range": k.tableTilt.feedback.primary.movementRange,
        "tilt-near-sharp": k.tableTilt.feedback.primary.nearSharp,
        "tilt-mid-sharp": k.tableTilt.feedback.primary.midSharp,
        "tilt-far-sharp": k.tableTilt.feedback.primary.farSharp,
      },
      secondary: {
        "tilt-allowed-aperture": k.tableTilt.feedback.secondary.allowedAperture,
        "tilt-rise-zero": k.tableTilt.feedback.secondary.riseZero,
        "tilt-swing-zero": k.tableTilt.feedback.secondary.swingZero,
        "tilt-movement-range": k.tableTilt.feedback.secondary.movementRange,
        "tilt-near-sharp": k.tableTilt.feedback.secondary.nearSharp,
        "tilt-mid-sharp": k.tableTilt.feedback.secondary.midSharp,
        "tilt-far-sharp": k.tableTilt.feedback.secondary.farSharp,
      },
    },
  },
  "swing-01": {
    title: k.shelfSwing.title,
    objective: k.shelfSwing.objective,
    notes: [k.shelfSwing.notes.focusAndSwing, k.shelfSwing.notes.constraints],
    criteria: {
      "swing-allowed-aperture": k.shelfSwing.criteria.allowedAperture,
      "swing-rise-zero": k.shelfSwing.criteria.riseZero,
      "swing-tilt-zero": k.shelfSwing.criteria.tiltZero,
      "swing-movement-range": k.shelfSwing.criteria.movementRange,
      "swing-front-sharp": k.shelfSwing.criteria.frontSharp,
      "swing-middle-sharp": k.shelfSwing.criteria.middleSharp,
      "swing-back-sharp": k.shelfSwing.criteria.backSharp,
    },
    feedback: {
      passPrimary: k.shelfSwing.feedback.passPrimary,
      defaultFailPrimary: k.shelfSwing.feedback.defaultFailPrimary,
      primary: {
        "swing-allowed-aperture": k.shelfSwing.feedback.primary.allowedAperture,
        "swing-rise-zero": k.shelfSwing.feedback.primary.riseZero,
        "swing-tilt-zero": k.shelfSwing.feedback.primary.tiltZero,
        "swing-movement-range": k.shelfSwing.feedback.primary.movementRange,
        "swing-front-sharp": k.shelfSwing.feedback.primary.frontSharp,
        "swing-middle-sharp": k.shelfSwing.feedback.primary.middleSharp,
        "swing-back-sharp": k.shelfSwing.feedback.primary.backSharp,
      },
      secondary: {
        "swing-allowed-aperture": k.shelfSwing.feedback.secondary.allowedAperture,
        "swing-rise-zero": k.shelfSwing.feedback.secondary.riseZero,
        "swing-tilt-zero": k.shelfSwing.feedback.secondary.tiltZero,
        "swing-movement-range": k.shelfSwing.feedback.secondary.movementRange,
        "swing-front-sharp": k.shelfSwing.feedback.secondary.frontSharp,
        "swing-middle-sharp": k.shelfSwing.feedback.secondary.middleSharp,
        "swing-back-sharp": k.shelfSwing.feedback.secondary.backSharp,
      },
    },
  },
  "mirror-shift-01": {
    title: k.mirrorShift.title,
    objective: k.mirrorShift.objective,
    notes: [
      k.mirrorShift.notes.clearReflection,
      k.mirrorShift.notes.restoreFraming,
      k.mirrorShift.notes.retainViewpoint,
    ],
    criteria: {
      "mirror-reflection-clear": k.mirrorShift.criteria.reflectionClear,
      "mirror-framing-restored": k.mirrorShift.criteria.framingRestored,
      "mirror-viewpoint-retained": k.mirrorShift.criteria.viewpointRetained,
    },
    feedback: {
      passPrimary: k.mirrorShift.feedback.passPrimary,
      passSecondary: k.mirrorShift.feedback.passSecondary,
      defaultFailPrimary: k.mirrorShift.feedback.defaultFailPrimary,
      primary: {
        "mirror-reflection-clear": k.mirrorShift.feedback.primary.reflectionClear,
        "mirror-framing-restored": k.mirrorShift.feedback.primary.framingRestored,
        "mirror-viewpoint-retained": k.mirrorShift.feedback.primary.viewpointRetained,
      },
      secondary: {
        "mirror-reflection-clear": k.mirrorShift.feedback.secondary.reflectionClear,
        "mirror-framing-restored": k.mirrorShift.feedback.secondary.framingRestored,
        "mirror-viewpoint-retained": k.mirrorShift.feedback.secondary.viewpointRetained,
      },
    },
  },
  "interior-corner-compose-01": {
    title: k.interiorCornerCompose.title,
    objective: k.interiorCornerCompose.objective,
    notes: [k.interiorCornerCompose.notes.level, k.interiorCornerCompose.notes.rise],
    criteria: {
      "interior-corner-compose-composition": k.interiorCornerCompose.criteria.composition,
      "interior-corner-compose-camera-level": k.interiorCornerCompose.criteria.cameraLevel,
    },
    feedback: {
      passPrimary: k.interiorCornerCompose.feedback.passPrimary,
      defaultFailPrimary: k.interiorCornerCompose.feedback.defaultFailPrimary,
      primary: {
        "interior-corner-compose-composition": k.interiorCornerCompose.feedback.primary.composition,
        "interior-corner-compose-camera-level": k.interiorCornerCompose.feedback.primary.cameraLevel,
      },
      secondary: {
        "interior-corner-compose-composition": k.interiorCornerCompose.feedback.secondary.composition,
        "interior-corner-compose-camera-level": k.interiorCornerCompose.feedback.secondary.cameraLevel,
      },
    },
  },
  "interior-corner-align-focus-01": {
    title: k.interiorCornerAlignFocus.title,
    objective: k.interiorCornerAlignFocus.objective,
    notes: [
      k.interiorCornerAlignFocus.notes.composition,
      k.interiorCornerAlignFocus.notes.swing,
      k.interiorCornerAlignFocus.notes.focus,
      k.interiorCornerAlignFocus.notes.wall,
    ],
    criteria: {
      "interior-corner-align-focus-aperture": k.interiorCornerAlignFocus.criteria.aperture,
      "interior-corner-align-focus-orientation": k.interiorCornerAlignFocus.criteria.orientation,
      "interior-corner-align-focus-wall": k.interiorCornerAlignFocus.criteria.wall,
      "interior-corner-align-focus-camera-level": k.interiorCornerAlignFocus.criteria.cameraLevel,
    },
    feedback: {
      passPrimary: k.interiorCornerAlignFocus.feedback.passPrimary,
      defaultFailPrimary: k.interiorCornerAlignFocus.feedback.defaultFailPrimary,
      primary: {
        "interior-corner-align-focus-aperture": k.interiorCornerAlignFocus.feedback.primary.aperture,
        "interior-corner-align-focus-orientation": k.interiorCornerAlignFocus.feedback.primary.orientation,
        "interior-corner-align-focus-wall": k.interiorCornerAlignFocus.feedback.primary.wall,
        "interior-corner-align-focus-camera-level": k.interiorCornerAlignFocus.feedback.primary.cameraLevel,
      },
      secondary: {
        "interior-corner-align-focus-aperture": k.interiorCornerAlignFocus.feedback.secondary.aperture,
        "interior-corner-align-focus-orientation": k.interiorCornerAlignFocus.feedback.secondary.orientation,
        "interior-corner-align-focus-wall": k.interiorCornerAlignFocus.feedback.secondary.wall,
        "interior-corner-align-focus-camera-level": k.interiorCornerAlignFocus.feedback.secondary.cameraLevel,
      },
    },
  },
  "interior-corner-depth-of-field-01": {
    title: k.interiorCornerDepthOfField.title,
    objective: k.interiorCornerDepthOfField.objective,
    notes: [
      k.interiorCornerDepthOfField.notes.composition,
      k.interiorCornerDepthOfField.notes.focus,
      k.interiorCornerDepthOfField.notes.aperture,
      k.interiorCornerDepthOfField.notes.wall,
    ],
    criteria: {
      "interior-corner-depth-composition": k.interiorCornerDepthOfField.criteria.composition,
      "interior-corner-depth-focus-preserved": k.interiorCornerDepthOfField.criteria.focus,
      "interior-corner-depth-aperture": k.interiorCornerDepthOfField.criteria.aperture,
      "interior-corner-depth-camera-level": k.interiorCornerDepthOfField.criteria.cameraLevel,
    },
    feedback: {
      passPrimary: k.interiorCornerDepthOfField.feedback.passPrimary,
      defaultFailPrimary: k.interiorCornerDepthOfField.feedback.defaultFailPrimary,
      primary: {
        "interior-corner-depth-composition": k.interiorCornerDepthOfField.feedback.primary.composition,
        "interior-corner-depth-focus-preserved": k.interiorCornerDepthOfField.feedback.primary.focus,
        "interior-corner-depth-aperture": k.interiorCornerDepthOfField.feedback.primary.aperture,
        "interior-corner-depth-camera-level": k.interiorCornerDepthOfField.feedback.primary.cameraLevel,
      },
      secondary: {
        "interior-corner-depth-composition": k.interiorCornerDepthOfField.feedback.secondary.composition,
        "interior-corner-depth-focus-preserved": k.interiorCornerDepthOfField.feedback.secondary.focus,
        "interior-corner-depth-aperture": k.interiorCornerDepthOfField.feedback.secondary.aperture,
        "interior-corner-depth-camera-level": k.interiorCornerDepthOfField.feedback.secondary.cameraLevel,
      },
    },
  },
};

const genericCopyKeyMap: GuidedTaskCopyKeyMap = {
  title: k.common.guidedTask,
  objective: k.common.waitingForEvaluation,
  notes: [],
  criteria: {},
  feedback: {
    passPrimary: k.common.genericPassPrimary,
    defaultFailPrimary: k.common.genericFailPrimary,
    primary: {},
    secondary: {},
  },
};

const ref = (key: GuidedTaskMessageKey, values?: MessageValues): GuidedTaskMessageRef =>
  values ? { key, values } : { key };

const criterionValues = (criterion: TaskSuccessCriterion): MessageValues | undefined => {
  switch (criterion.type) {
    case "composition-visible":
      return { coverage: Math.round(criterion.minimumCoverage * 100) };
    case "movement-range":
      return { min: criterion.min, max: criterion.max };
    default:
      return undefined;
  }
};

const feedbackValues = (task: TaskDefinition, criterionId: string): MessageValues | undefined => {
  const criterion = task.criteria.find((entry) => entry.id === criterionId);
  if (criterionId === "tilt-movement-range") {
    return { tiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg };
  }
  if (criterionId === "swing-movement-range") {
    return { swingDeg: shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg.toFixed(1) };
  }
  if (criterion?.type === "movement-range" && criterionId.endsWith("movement-range")) {
    return { min: criterion.min, max: criterion.max };
  }
  return undefined;
};

const refsFor = (
  task: TaskDefinition,
  values: Record<string, GuidedTaskMessageKey>,
): Record<string, GuidedTaskMessageRef> =>
  Object.fromEntries(
    Object.entries(values).map(([criterionId, key]) => [
      criterionId,
      ref(key, feedbackValues(task, criterionId)),
    ]),
  );

export const getGuidedTaskCopy = (task: TaskDefinition): GuidedTaskCopy => {
  const copyKeys = guidedTaskCopyKeyMap[task.id] ?? genericCopyKeyMap;
  const criteria = Object.fromEntries(
    task.criteria.map((criterion) => [
      criterion.id,
      ref(copyKeys.criteria[criterion.id] ?? k.common.genericCriterion, criterionValues(criterion)),
    ]),
  );
  const primary = refsFor(task, copyKeys.feedback.primary);
  const secondary = refsFor(task, copyKeys.feedback.secondary);
  if (!guidedTaskCopyKeyMap[task.id]) {
    task.criteria.forEach((criterion) => {
      primary[criterion.id] = getCriterionResultMessageRef(criterion, false);
      secondary[criterion.id] = ref(k.common.genericSecondary);
    });
  }
  return {
    title: ref(copyKeys.title),
    objective: ref(copyKeys.objective),
    notes: copyKeys.notes.map((key) => ref(key)),
    criteria,
    feedback: {
      passPrimary: ref(copyKeys.feedback.passPrimary),
      passSecondary: copyKeys.feedback.passSecondary
        ? ref(copyKeys.feedback.passSecondary)
        : undefined,
      defaultFailPrimary: ref(copyKeys.feedback.defaultFailPrimary),
      primary,
      secondary,
    },
  };
};

export const getCriterionResultMessageRef = (
  criterion: TaskSuccessCriterion,
  passed: boolean,
): GuidedTaskMessageRef => {
  const variant = passed ? "pass" : "fail";
  switch (criterion.type) {
    case "focus-targets-sharp":
      return ref(k.results.focusTargetsSharp[variant]);
    case "movement-used":
      return ref(k.results.movementUsed[criterion.movement][variant]);
    case "focus-used":
      return ref(k.results.focusUsed[variant]);
    case "movement-range":
      return ref(k.results.movementRange[criterion.movement][variant]);
    case "allowed-aperture":
      return ref(k.results.allowedAperture[variant]);
    case "composition-visible":
      return ref(k.results.compositionVisible[variant]);
    case "camera-level":
      return ref(k.results.cameraLevel[variant]);
    case "interior-corner-rise-composition":
      return ref(k.results.interiorCornerRiseComposition[variant]);
    case "interior-corner-swing-orientation":
      return ref(k.results.interiorCornerSwingOrientation[variant]);
    case "interior-corner-wall-focus":
      return ref(k.results.interiorCornerWallFocus[variant]);
    case "interior-corner-focus-preserved":
      return ref(k.results.interiorCornerFocusPreserved[variant]);
    case "mirror-reflection-clear":
      return ref(k.results.mirrorReflectionClear[variant]);
    case "mirror-framing-restored":
      return ref(k.results.mirrorFramingRestored[variant]);
    case "mirror-viewpoint-retained":
      return ref(k.results.mirrorViewpointRetained[variant]);
  }
};

export type GuidedControlId = TaskDefinition["enabledControls"][number];

export const getGuidedControlMessageKey = (controlId: GuidedControlId): GuidedTaskMessageKey =>
  guidedTaskMessageKeys.controls[controlId];
