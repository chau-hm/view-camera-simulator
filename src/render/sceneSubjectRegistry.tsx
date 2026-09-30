/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from "react";
import * as THREE from "three";
import type { Bounds3, Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import architectureRiseGeometry from "../scenes/architectureRiseGeometry";
import tableTiltGeometry from "../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../scenes/shelfSwingGeometry";
import {
  ArchitectureRiseSubject,
  ObliqueArchitectureSubject,
  ArchitectureForegroundSubject,
  FocusFundamentalsSubject,
  InteriorCornerSubject,
  ObliqueTabletopSubject,
  MirrorShiftSubject,
  MacroSpecimenSubject,
  MacroDepthOfFieldSubject,
  MacroObliquePlaneSubject,
  MacroCompoundMovementsSubject,
  ShelfSwingSubject,
  TableTiltSubject,
  ViewCameraAnatomySubject,
} from "./SceneAssetSubjects";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  MIRROR_SHIFT_ASSET_KEY,
  MACRO_BELLOWS_EXTENSION_ASSET_KEY,
  MACRO_DEPTH_OF_FIELD_ASSET_KEY,
  MACRO_OBLIQUE_PLANE_ASSET_KEY,
  MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
  type SceneAssetRequestMap,
} from "./assets/sceneAssetRegistry";
import {
  ARCHITECTURE_RISE_PRESENTATION,
} from "../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../scenes/presentation/tableTilt";
import { SHELF_SWING_PRESENTATION } from "../scenes/presentation/shelfSwing";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../scenes/presentation/obliqueTabletop";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../scenes/presentation/viewCameraAnatomy";
import { MIRROR_SHIFT_PRESENTATION } from "../scenes/presentation/mirrorShift";
import { MACRO_BELLOWS_EXTENSION_PRESENTATION } from "../scenes/presentation/macroBellowsExtension";
import { MACRO_DEPTH_OF_FIELD_PRESENTATION } from "../scenes/presentation/macroDepthOfField";
import { MACRO_OBLIQUE_PLANE_PRESENTATION } from "../scenes/presentation/macroObliquePlane";
import { MACRO_COMPOUND_MOVEMENTS_PRESENTATION } from "../scenes/presentation/macroCompoundMovements";
import { CameraMovementsSubject } from "./CameraMovementsSubjectFactory";
import {
  createCameraMovementLatticeAsset,
  disposeCameraMovementLatticeAsset,
} from "./cameraMovementLatticeAssetConsumer";
import {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  cameraMovementsGroupOptionsFromPresentation,
} from "./assets/CameraMovementLatticeAsset";
import {
  CAMERA_MOVEMENT_BASELINE_PRESENTATION,
  type CameraMovementLatticePresentation,
} from "../scenes/presentation/understandingCameraMovements";
import { toWorld } from "./rttUtils";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementPresentationRegion,
} from "../scenes/cameraMovementSceneCalibration";
import { CAMERA_MOVEMENT_LATTICE } from "../scenes/cameraMovementLatticeGeometry";
import obliqueArchitectureGeometry from "../scenes/obliqueArchitectureGeometry";
import architectureForegroundGeometry from "../scenes/architectureForegroundGeometry";
import obliqueTabletopGeometry from "../scenes/obliqueTabletopGeometry";
import interiorCornerGeometry from "../scenes/interiorCornerGeometry";
import { resolveMirrorShiftLighting } from "./mirrorShiftLighting";

export type RegisteredSceneSubjectProps = {
  scene: SceneDefinition;
};

export type SceneSubjectRttLighting = {
  targetMm: Vec3;
  keyOffsetWorld: Vec3;
  fillOffsetWorld: Vec3;
};

type SceneSubjectRegistrationBase = {
  SceneSubject: ComponentType<RegisteredSceneSubjectProps>;
  createRttGroup: (options?: SceneSubjectRttOptions) => THREE.Group;
  /** Optional subject bounds used for RTT clipping, independent of inspection bounds. */
  rttBounds?: Bounds3;
  /** Optional lighting for the physical inspection subject when RTT is virtualized. */
  viewportLighting?: SceneSubjectRttLighting;
  rttLighting?: SceneSubjectRttLighting;
  resolveRttLighting?: (options?: SceneSubjectRttOptions) => SceneSubjectRttLighting;
  showReferenceCamera?: boolean;
  resolveShowReferenceCamera?: (options?: SceneSubjectRttOptions) => boolean;
  canonicalLattice?: {
    geometryId: string;
    edgeCount: number;
  };
  resolveCanonicalLattice?: (options?: SceneSubjectRttOptions) => {
    geometryId: string;
    geometryKey: string;
    presentationKey: string;
    edgeCount: number;
    bounds: CameraMovementLatticePresentation["subjectBoundsWorldMm"];
  };
};

/** Scene-level integration delegates asset cleanup to the asset registry. */
export type SceneSubjectRegistration = SceneSubjectRegistrationBase & {
  disposeRttGroup: (group: THREE.Group) => void;
};

export type SceneSubjectRttOptions = {
  presentationRegion?: CameraMovementPresentationRegion;
  cameraMovementPresentation?: CameraMovementLatticePresentation;
};

export const ArchitectureRiseRegisteredSubject = ({
  scene,
}: RegisteredSceneSubjectProps) => (
  <>
    <ArchitectureRiseSubject />
    {scene.focusTargets.map((target) => (
      <mesh
        key={target.id}
        name={`architecture-focus-target-${target.id}`}
        position={[
          toWorld(target.worldPosition.x),
          toWorld(target.worldPosition.y),
          toWorld(target.worldPosition.z),
        ]}
      >
        <sphereGeometry args={[toWorld(50), 16, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    ))}
  </>
);

export const ObliqueArchitectureRegisteredSubject = () => (
  <ObliqueArchitectureSubject />
);

export const ArchitectureForegroundRegisteredSubject = ({
  scene,
}: RegisteredSceneSubjectProps) => (
  <>
    <ArchitectureForegroundSubject />
    {scene.focusTargets.map((target) => (
      <mesh
        key={target.id}
        name={`architecture-foreground-focus-target-${target.id}`}
        position={[
          toWorld(target.worldPosition.x),
          toWorld(target.worldPosition.y),
          toWorld(target.worldPosition.z),
        ]}
      >
        <sphereGeometry args={[toWorld(42), 12, 12]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    ))}
  </>
);

const architectureLightingTargetMm = {
  x: architectureRiseGeometry.building.center.x,
  y: architectureRiseGeometry.building.center.y,
  z: architectureRiseGeometry.facade.frontFacadeZ,
} as const;

const tableTiltLightingTargetMm = {
  x: tableTiltGeometry.tabletop.center.x,
  y: tableTiltGeometry.tabletopTopSurfacePlane.point.y,
  z: tableTiltGeometry.tabletop.center.z,
} as const;

const cameraMovementsLightingTargetMm = {
  ...CAMERA_MOVEMENT_BASELINE_PRESENTATION.lightingTargetWorldMm,
} as const;

const shelfSwingLightingTargetMm = {
  ...shelfSwingGeometry.middleSubject.focusDetailProbeWorld,
};

const obliqueArchitectureLightingTargetMm = {
  ...(obliqueArchitectureGeometry.focusTargets[1]?.worldPosition ??
    obliqueArchitectureGeometry.focusTargets[0].worldPosition),
} as const;

const architectureForegroundLightingTargetMm = {
  x: architectureForegroundGeometry.building.center.x,
  y: architectureForegroundGeometry.building.center.y,
  z: architectureForegroundGeometry.facade.frontFacadeZ,
} as const;

const obliqueTabletopLightingTargetMm = {
  ...obliqueTabletopGeometry.middleBoardMarker.worldPosition,
} as const;

const interiorCornerLightingTargetMm = {
  ...interiorCornerGeometry.focusTargets[1].worldPosition,
} as const;

const {
  viewport: mirrorShiftViewportLighting,
  rtt: mirrorShiftRttLighting,
} = resolveMirrorShiftLighting();

const macroBellowsExtensionRttAssetRequest: SceneAssetRequestMap[
  typeof MACRO_BELLOWS_EXTENSION_ASSET_KEY
] = Object.freeze({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
const macroDepthOfFieldRttAssetRequest: SceneAssetRequestMap[
  typeof MACRO_DEPTH_OF_FIELD_ASSET_KEY
] = Object.freeze({ presentation: MACRO_DEPTH_OF_FIELD_PRESENTATION });
const macroObliquePlaneRttAssetRequest: SceneAssetRequestMap[
  typeof MACRO_OBLIQUE_PLANE_ASSET_KEY
] = Object.freeze({ presentation: MACRO_OBLIQUE_PLANE_PRESENTATION });
const macroCompoundMovementsRttAssetRequest: SceneAssetRequestMap[
  typeof MACRO_COMPOUND_MOVEMENTS_ASSET_KEY
] = Object.freeze({ presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION });

const mirrorShiftRttAssetRequest: SceneAssetRequestMap[
  typeof MIRROR_SHIFT_ASSET_KEY
] = Object.freeze({
  presentation: MIRROR_SHIFT_PRESENTATION,
  representation: "rtt",
});

export const sceneSubjectRegistry = {
  "macro-bellows-extension": {
    SceneSubject: MacroSpecimenSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(
        MACRO_BELLOWS_EXTENSION_ASSET_KEY,
        macroBellowsExtensionRttAssetRequest,
      ),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(MACRO_BELLOWS_EXTENSION_ASSET_KEY, group),
    rttBounds: MACRO_BELLOWS_EXTENSION_PRESENTATION.geometry.macroSpecimenBoundsMm,
    rttLighting: {
      targetMm: MACRO_BELLOWS_EXTENSION_PRESENTATION.geometry.MACRO_SPECIMEN.faceCenterMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "macro-depth-of-field": {
    SceneSubject: MacroDepthOfFieldSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(
        MACRO_DEPTH_OF_FIELD_ASSET_KEY,
        macroDepthOfFieldRttAssetRequest,
      ),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(MACRO_DEPTH_OF_FIELD_ASSET_KEY, group),
    rttBounds: MACRO_DEPTH_OF_FIELD_PRESENTATION.geometry.macroDepthOfFieldSubjectBoundsMm,
    rttLighting: {
      targetMm: MACRO_DEPTH_OF_FIELD_PRESENTATION.geometry.MACRO_DEPTH_SPECIMEN_CENTER_MM,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "macro-oblique-plane": {
    SceneSubject: MacroObliquePlaneSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(
        MACRO_OBLIQUE_PLANE_ASSET_KEY,
        macroObliquePlaneRttAssetRequest,
      ),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(MACRO_OBLIQUE_PLANE_ASSET_KEY, group),
    rttBounds: MACRO_OBLIQUE_PLANE_PRESENTATION.geometry.macroObliquePlaneSubjectBoundsMm,
    rttLighting: {
      targetMm: MACRO_OBLIQUE_PLANE_PRESENTATION.geometry.MACRO_OBLIQUE_PLATE_CENTER_MM,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "macro-compound-movements": {
    SceneSubject: MacroCompoundMovementsSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(
        MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
        macroCompoundMovementsRttAssetRequest,
      ),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(MACRO_COMPOUND_MOVEMENTS_ASSET_KEY, group),
    rttBounds: MACRO_COMPOUND_MOVEMENTS_PRESENTATION.geometry.macroCompoundMovementsSubjectBoundsMm,
    rttLighting: {
      targetMm: MACRO_COMPOUND_MOVEMENTS_PRESENTATION.geometry.macroCompoundMovementsLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "view-camera-anatomy": {
    SceneSubject: ViewCameraAnatomySubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(VIEW_CAMERA_ANATOMY_ASSET_KEY, {
        presentation: VIEW_CAMERA_ANATOMY_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(VIEW_CAMERA_ANATOMY_ASSET_KEY, group),
    rttBounds: VIEW_CAMERA_ANATOMY_PRESENTATION.geometry.bounds,
    rttLighting: {
      targetMm: VIEW_CAMERA_ANATOMY_PRESENTATION.centerMm,
      keyOffsetWorld: { x: -1.8, y: 2.5, z: -2.2 },
      fillOffsetWorld: { x: 1.8, y: 1.25, z: -2.4 },
    },
  },
  "understanding-camera-movements": {
    SceneSubject: CameraMovementsSubject,
    createRttGroup: (options) => {
      const presentation =
        options?.cameraMovementPresentation ??
        CAMERA_MOVEMENT_BASELINE_PRESENTATION;
      return createCameraMovementLatticeAsset(
        cameraMovementsGroupOptionsFromPresentation(
          presentation,
          options?.presentationRegion,
        ),
      );
    },
    disposeRttGroup: disposeCameraMovementLatticeAsset,
    showReferenceCamera:
      CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera,
    resolveShowReferenceCamera: (options) =>
      (
        options?.cameraMovementPresentation ??
        CAMERA_MOVEMENT_BASELINE_PRESENTATION
      ).showReferenceCamera,
    canonicalLattice: {
      geometryId: CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
      edgeCount: CAMERA_MOVEMENT_LATTICE.edges.length,
    },
    resolveCanonicalLattice: (options) => {
      const presentation =
        options?.cameraMovementPresentation ??
        CAMERA_MOVEMENT_BASELINE_PRESENTATION;
      return {
        geometryId: presentation.geometryId,
        geometryKey: presentation.geometryKey,
        presentationKey: presentation.presentationKey,
        edgeCount: presentation.lattice.edges.length,
        bounds: presentation.subjectBoundsWorldMm,
      };
    },
    rttLighting: {
      targetMm: cameraMovementsLightingTargetMm,
      keyOffsetWorld: { x: -2, y: 2.5, z: -2 },
      fillOffsetWorld: { x: 1.5, y: 1, z: -2.5 },
    },
    resolveRttLighting: (options) => ({
      targetMm: {
        ...(
          options?.cameraMovementPresentation ??
          CAMERA_MOVEMENT_BASELINE_PRESENTATION
        ).lightingTargetWorldMm,
      },
      keyOffsetWorld: { x: -2, y: 2.5, z: -2 },
      fillOffsetWorld: { x: 1.5, y: 1, z: -2.5 },
    }),
  },
  "focus-fundamentals-two-targets": {
    SceneSubject: FocusFundamentalsSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(FOCUS_FUNDAMENTALS_ASSET_KEY, {
        presentation: FOCUS_FUNDAMENTALS_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(FOCUS_FUNDAMENTALS_ASSET_KEY, group),
    rttLighting: {
      targetMm: FOCUS_FUNDAMENTALS_PRESENTATION.geometry.objectCenterMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2 },
      fillOffsetWorld: { x: 2, y: 1.5, z: -2.5 },
    },
  },
  "architecture-rise": {
    SceneSubject: ArchitectureRiseRegisteredSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, {
        presentation: ARCHITECTURE_RISE_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, group),
    rttLighting: {
      targetMm: architectureLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2 },
      fillOffsetWorld: { x: 2, y: 1.5, z: -3 },
    },
  },
  "architecture-foreground": {
    SceneSubject: ArchitectureForegroundRegisteredSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(ARCHITECTURE_FOREGROUND_ASSET_KEY, {
        presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(ARCHITECTURE_FOREGROUND_ASSET_KEY, group),
    rttLighting: {
      targetMm: architectureForegroundLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "oblique-architecture": {
    SceneSubject: ObliqueArchitectureRegisteredSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, {
        presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(OBLIQUE_ARCHITECTURE_ASSET_KEY, group),
    rttLighting: {
      targetMm: obliqueArchitectureLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "table-tilt": {
    SceneSubject: TableTiltSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, {
        presentation: TABLE_TILT_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(TABLE_TILT_ASSET_KEY, group),
    rttLighting: {
      targetMm: tableTiltLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "shelf-swing": {
    SceneSubject: ShelfSwingSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(SHELF_SWING_ASSET_KEY, {
        presentation: SHELF_SWING_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(SHELF_SWING_ASSET_KEY, group),
    rttLighting: {
      targetMm: shelfSwingLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "oblique-tabletop": {
    SceneSubject: ObliqueTabletopSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(OBLIQUE_TABLETOP_ASSET_KEY, {
        presentation: OBLIQUE_TABLETOP_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(OBLIQUE_TABLETOP_ASSET_KEY, group),
    rttLighting: {
      targetMm: obliqueTabletopLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "mirror-shift": {
    SceneSubject: MirrorShiftSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(
        MIRROR_SHIFT_ASSET_KEY,
        mirrorShiftRttAssetRequest,
      ),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(MIRROR_SHIFT_ASSET_KEY, group),
    viewportLighting: mirrorShiftViewportLighting,
    rttLighting: mirrorShiftRttLighting,
  },
  "interior-corner": {
    SceneSubject: InteriorCornerSubject,
    createRttGroup: () =>
      createRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, {
        presentation: INTERIOR_CORNER_PRESENTATION,
      }),
    disposeRttGroup: (group) =>
      disposeRegisteredSceneAsset(INTERIOR_CORNER_ASSET_KEY, group),
    rttLighting: {
      targetMm: interiorCornerLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
} as const satisfies Record<string, SceneSubjectRegistration>;

export const getSceneSubjectRegistration = (
  sceneId: string,
): SceneSubjectRegistration | undefined =>
  sceneSubjectRegistry[sceneId as keyof typeof sceneSubjectRegistry];

export const getRegisteredSceneSubject = (sceneId: string) =>
  getSceneSubjectRegistration(sceneId)?.SceneSubject;

export const createRegisteredRttSubject = (
  sceneId: string,
  options?: SceneSubjectRttOptions,
): THREE.Group | null =>
  getSceneSubjectRegistration(sceneId)?.createRttGroup(options) ?? null;

export const disposeRegisteredRttSubject = (
  sceneId: string,
  group: THREE.Group,
): void => {
  getSceneSubjectRegistration(sceneId)?.disposeRttGroup(group);
};
