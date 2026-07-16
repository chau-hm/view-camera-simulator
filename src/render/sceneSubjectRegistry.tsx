/* eslint-disable react-refresh/only-export-components */
import type { ComponentType } from "react";
import * as THREE from "three";
import type { Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import architectureRiseGeometry from "../scenes/architectureRiseGeometry";
import tableTiltGeometry from "../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../scenes/shelfSwingGeometry";
import {
  ArchitectureRiseSubject,
  createArchitectureRiseGroup,
} from "./ArchitectureRiseSubjectFactory";
import {
  FocusFundamentalsSubject,
  createFocusFundamentalsGroup,
} from "./FocusFundamentalsSubjectFactory";
import {
  TableTiltSubject,
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "./TableTiltSubjectFactory";
import {
  ShelfSwingSubject,
  createShelfSwingGroup,
  disposeShelfSwingGroup,
} from "./ShelfSwingSubjectFactory";
import { toWorld } from "./rttUtils";

export type RegisteredSceneSubjectProps = {
  scene: SceneDefinition;
};

export type SceneSubjectRttLighting = {
  targetMm: Vec3;
  keyOffsetWorld: Vec3;
  fillOffsetWorld: Vec3;
};

export type SceneSubjectRegistration = {
  SceneSubject: ComponentType<RegisteredSceneSubjectProps>;
  createRttGroup: () => THREE.Group;
  disposeRttGroup?: (group: THREE.Group) => void;
  rttLighting?: SceneSubjectRttLighting;
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

const shelfSwingLightingTargetMm = {
  ...shelfSwingGeometry.middleSubject.focusDetailProbeWorld,
};

export const sceneSubjectRegistry = {
  "focus-fundamentals-two-targets": {
    SceneSubject: FocusFundamentalsSubject,
    createRttGroup: createFocusFundamentalsGroup,
  },
  "architecture-rise": {
    SceneSubject: ArchitectureRiseRegisteredSubject,
    createRttGroup: createArchitectureRiseGroup,
    rttLighting: {
      targetMm: architectureLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2 },
      fillOffsetWorld: { x: 2, y: 1.5, z: -3 },
    },
  },
  "table-tilt": {
    SceneSubject: TableTiltSubject,
    createRttGroup: createTableTiltGroup,
    disposeRttGroup: disposeTableTiltGroup,
    rttLighting: {
      targetMm: tableTiltLightingTargetMm,
      keyOffsetWorld: { x: -2.5, y: 3.5, z: -2.5 },
      fillOffsetWorld: { x: 2.5, y: 1.5, z: -1.5 },
    },
  },
  "shelf-swing": {
    SceneSubject: ShelfSwingSubject,
    createRttGroup: createShelfSwingGroup,
    disposeRttGroup: disposeShelfSwingGroup,
    rttLighting: {
      targetMm: shelfSwingLightingTargetMm,
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

export const createRegisteredRttSubject = (sceneId: string): THREE.Group | null =>
  getSceneSubjectRegistration(sceneId)?.createRttGroup() ?? null;

export const disposeRegisteredRttSubject = (
  sceneId: string,
  group: THREE.Group,
): void => {
  getSceneSubjectRegistration(sceneId)?.disposeRttGroup?.(group);
};
