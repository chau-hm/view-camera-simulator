/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { DoubleSide, Quaternion, Vector3 } from "three";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import { transformRigLocalPointToWorld } from "../core/optics/applyCameraBodyPitch";
import type {
  CameraBodyLocalGeometry,
  CameraRigTransform,
  DerivedOpticsState,
  StandardFrame,
  Vec3,
} from "../types/optics";
import type { FocusStandard } from "../types/camera";
import { CAMERA_CONSTANTS } from "../utils/constants";
import {
  resolveCameraRigRenderTransform,
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "./planeOrientation";
import { resolveFocusStandardVisualState } from "./focusStandardPresentation";
import { WORLD_SCALE } from "./rttUtils";

/** Stable semantic part IDs reserved for future camera-anatomy inspection. */
export const CONCEPTUAL_CAMERA_ANATOMY_PARTS = [
  "lens",
  "lens-board",
  "front-standard",
  "bellows",
  "rear-standard",
  "ground-glass-back",
  "camera-support",
] as const;

export type ConceptualCameraAnatomyPart =
  (typeof CONCEPTUAL_CAMERA_ANATOMY_PARTS)[number];

export type ConceptualCameraVariant = "current" | "ghost";
export type ConceptualCameraCoordinateSpace = "world" | "rig-local";

export type ConceptualCameraRail = {
  centerRigLocal: Vec3;
  dimensionsMm: Vec3;
};

const CONCEPTUAL_CAMERA_SUPPORT_RAIL_OVERHANG_MM = 60;
const CONCEPTUAL_CAMERA_SUPPORT_RAIL_CLEARANCE_MM = 34;
const conceptualSupportImageDistanceMm = imageDistanceMm(
  CAMERA_CONSTANTS.focalLengthMm,
  CAMERA_CONSTANTS.defaultFocusDistanceMm,
);

/**
 * Fixed generic rig-local support datum for scenes without a calibrated rail.
 * Standard movements never participate in this value; whole-camera transforms
 * are applied separately when the datum is rendered in world space.
 */
export const CONCEPTUAL_CAMERA_SUPPORT_RAIL: ConceptualCameraRail = {
  centerRigLocal: {
    x: 0,
    y: -(
      CAMERA_CONSTANTS.frontStandardHeightMm / 2 +
      CONCEPTUAL_CAMERA_SUPPORT_RAIL_CLEARANCE_MM
    ),
    z: -conceptualSupportImageDistanceMm / 2,
  },
  dimensionsMm: {
    x: 36,
    y: 24,
    z: conceptualSupportImageDistanceMm +
      CONCEPTUAL_CAMERA_SUPPORT_RAIL_OVERHANG_MM * 2,
  },
};

export type ConceptualViewCameraProps = {
  opticsState: DerivedOpticsState;
  variant?: ConceptualCameraVariant;
  /**
   * The calibrated body-pitch scene renders its local geometry below the
   * canonical rig transform. Other scenes consume the already-resolved world
   * frame directly.
   */
  coordinateSpace?: ConceptualCameraCoordinateSpace;
  showBellows?: boolean;
  activeStandard?: FocusStandard | null;
  /** Existing canonical support rail for the calibrated rig scene. */
  rigRail?: ConceptualCameraRail;
};

type CanonicalCameraGeometry = {
  lensCenter: Vec3;
  lensNormal: Vec3;
  filmCenter: Vec3;
  rearStandardFrame: StandardFrame;
};

type AnatomyPartGroupProps = {
  part: ConceptualCameraAnatomyPart;
  children?: ReactNode;
  position?: [number, number, number];
  quaternion?: Quaternion;
  renderOrder?: number;
};

const toWorld = (millimetres: number): number => millimetres * WORLD_SCALE;
const vecToWorld = (value: Vec3): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

const anatomyPartName = (part: ConceptualCameraAnatomyPart): string =>
  `camera-anatomy-${part}`;

const AnatomyPartGroup = ({
  part,
  children,
  position,
  quaternion,
  renderOrder,
}: AnatomyPartGroupProps) => (
  <group
    name={anatomyPartName(part)}
    userData={{ anatomyPart: part }}
    position={position}
    quaternion={quaternion}
    renderOrder={renderOrder}
  >
    {children}
  </group>
);

const resolveCanonicalCameraGeometry = (
  opticsState: DerivedOpticsState,
  coordinateSpace: ConceptualCameraCoordinateSpace,
): CanonicalCameraGeometry => {
  if (coordinateSpace === "rig-local") {
    const local: CameraBodyLocalGeometry = opticsState.cameraBodyLocalGeometry;
    return {
      lensCenter: local.lensCenterLocal,
      lensNormal: local.lensNormalLocal,
      filmCenter: local.filmCenterLocal,
      rearStandardFrame: local.rearStandardFrameLocal,
    };
  }

  return {
    lensCenter: opticsState.lensCenterWorld,
    lensNormal: opticsState.lensNormalWorld,
    filmCenter: opticsState.filmCenterWorld,
    rearStandardFrame: opticsState.rearStandardFrame,
  };
};

type ConceptualBeamTransform = {
  position: [number, number, number];
  quaternion: Quaternion;
  length: number;
};

type SupportSide = "rear" | "front";

const resolveRailEndpointRigLocal = (
  rail: ConceptualCameraRail,
  side: SupportSide,
): Vec3 => ({
  ...rail.centerRigLocal,
  z:
    rail.centerRigLocal.z +
    (side === "front" ? 1 : -1) * rail.dimensionsMm.z / 2,
});

const resolveSupportMountRigLocal = (
  rail: ConceptualCameraRail,
  side: SupportSide,
): Vec3 => ({
  x: rail.centerRigLocal.x,
  y: rail.centerRigLocal.y + rail.dimensionsMm.y / 2 + 10,
  z:
    rail.centerRigLocal.z +
    (side === "front" ? 1 : -1) *
      Math.max(
        0,
        rail.dimensionsMm.z / 2 - CONCEPTUAL_CAMERA_SUPPORT_RAIL_OVERHANG_MM,
      ),
});

/**
 * Resolve a world-space support beam from a fixed rig-local support datum.
 * Standard centres are deliberately not inputs: rise, shift, tilt, and swing
 * are local standard movements and cannot rotate or translate this beam.
 */
export const resolveConceptualSupportBeam = (
  rail: ConceptualCameraRail,
  rigTransform: CameraRigTransform,
): ConceptualBeamTransform => {
  const rearRigLocal = resolveRailEndpointRigLocal(rail, "rear");
  const frontRigLocal = resolveRailEndpointRigLocal(rail, "front");
  const rearWorldMm = transformRigLocalPointToWorld(rearRigLocal, rigTransform);
  const frontWorldMm = transformRigLocalPointToWorld(frontRigLocal, rigTransform);
  const rear = new Vector3(...vecToWorld(rearWorldMm));
  const front = new Vector3(...vecToWorld(frontWorldMm));
  const direction = front.clone().sub(rear);
  const length = Math.max(direction.length(), toWorld(20));
  if (direction.lengthSq() <= 1e-12) direction.set(0, 0, 1);
  else direction.normalize();

  return {
    position: [
      (rear.x + front.x) / 2,
      (rear.y + front.y) / 2,
      (rear.z + front.z) / 2,
    ],
    quaternion: new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      direction,
    ),
    length,
  };
};

/** Resolve the canonical endpoint span used by the static bellows folds. */
export const resolveConceptualBellowsSpan = (
  rearCenter: Vec3,
  frontCenter: Vec3,
): ConceptualBeamTransform => {
  const rear = new Vector3(...vecToWorld(rearCenter));
  const front = new Vector3(...vecToWorld(frontCenter));
  const direction = front.clone().sub(rear);
  const length = Math.max(direction.length(), toWorld(20));
  if (direction.lengthSq() <= 1e-12) direction.set(0, 0, 1);
  else direction.normalize();

  return {
    position: [
      (rear.x + front.x) / 2,
      (rear.y + front.y) / 2,
      (rear.z + front.z) / 2,
    ],
    quaternion: new Quaternion().setFromUnitVectors(
      new Vector3(0, 0, 1),
      direction,
    ),
    length,
  };
};

type PresentationProps = {
  ghost: boolean;
};

const frameMaterialProps = ({ ghost }: PresentationProps) => ({
  transparent: ghost,
  opacity: ghost ? 0.35 : 1,
  depthWrite: !ghost,
});

const FrontStandardAssembly = ({
  lensCenter,
  lensNormal,
  ghost,
  active,
}: {
  lensCenter: Vec3;
  lensNormal: Vec3;
  ghost: boolean;
  active: boolean;
}) => {
  const visual = resolveFocusStandardVisualState("front", active ? "front" : null);
  const transform = resolveFrontStandardRenderTransform(lensCenter, lensNormal);
  const presentation = { ghost, renderOrder: ghost ? 10 : 0 };
  const outerWidth = CAMERA_CONSTANTS.frontStandardWidthMm;
  const outerHeight = CAMERA_CONSTANTS.frontStandardHeightMm;
  const frameBar = 14;
  const innerHeight = outerHeight - frameBar * 2;

  return (
    <AnatomyPartGroup part="front-standard">
      <group
        name="front-standard-frame"
        position={transform.position}
        quaternion={transform.quaternion}
        renderOrder={presentation.renderOrder}
      >
        <mesh
          name="front-standard-frame-top"
          position={[0, toWorld((outerHeight - frameBar) / 2), 0]}
        >
          <boxGeometry args={[toWorld(outerWidth), toWorld(frameBar), toWorld(12)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="front-standard-frame-bottom"
          position={[0, -toWorld((outerHeight - frameBar) / 2), 0]}
        >
          <boxGeometry args={[toWorld(outerWidth), toWorld(frameBar), toWorld(12)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="front-standard-frame-left-upright"
          position={[-toWorld((outerWidth - frameBar) / 2), 0, 0]}
        >
          <boxGeometry args={[toWorld(frameBar), toWorld(innerHeight), toWorld(12)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="front-standard-frame-right-upright"
          position={[toWorld((outerWidth - frameBar) / 2), 0, 0]}
        >
          <boxGeometry args={[toWorld(frameBar), toWorld(innerHeight), toWorld(12)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>

        <AnatomyPartGroup
          part="lens-board"
          position={[0, 0, toWorld(8)]}
          renderOrder={presentation.renderOrder}
        >
          <mesh name="lens-board-plate">
            <boxGeometry args={[toWorld(112), toWorld(104), toWorld(8)]} />
            <meshStandardMaterial
              color={ghost ? "#cbd5e1" : visual.detailColor}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
        </AnatomyPartGroup>

        <AnatomyPartGroup
          part="lens"
          position={[0, 0, toWorld(12)]}
          renderOrder={presentation.renderOrder}
        >
          <mesh name="lens-rear-mount" position={[0, 0, toWorld(6)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(24), toWorld(24), toWorld(12), 24]} />
            <meshStandardMaterial
              color={ghost ? "#6b7280" : visual.lensColor}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
          <mesh name="lens-shutter-housing" position={[0, 0, toWorld(15)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(31), toWorld(31), toWorld(18), 32]} />
            <meshStandardMaterial
              color={ghost ? "#94a3b8" : "#374151"}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
          <mesh name="lens-front-barrel" position={[0, 0, toWorld(27)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(27), toWorld(27), toWorld(14), 32]} />
            <meshStandardMaterial
              color={ghost ? "#6b7280" : "#1f2937"}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
          <mesh name="lens-front-glass" position={[0, 0, toWorld(35.5)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(22), toWorld(22), toWorld(3), 32]} />
            <meshStandardMaterial
              color={ghost ? "#cbd5e1" : "#38bdf8"}
              transparent
              opacity={ghost ? 0.28 : 0.68}
              depthWrite={!ghost}
              metalness={0.15}
              roughness={0.18}
              side={DoubleSide}
            />
          </mesh>
        </AnatomyPartGroup>
      </group>
    </AnatomyPartGroup>
  );
};

const RearStandardAssembly = ({
  frame,
  ghost,
  active,
}: {
  frame: StandardFrame;
  ghost: boolean;
  active: boolean;
}) => {
  const visual = resolveFocusStandardVisualState("rear", active ? "rear" : null);
  const transform = resolveRearStandardRenderTransform(frame);
  const presentation = { ghost, renderOrder: ghost ? 10 : 0 };
  const outerWidth = CAMERA_CONSTANTS.frontStandardWidthMm;
  const outerHeight = CAMERA_CONSTANTS.frontStandardHeightMm;
  const frameBar = 14;
  const innerHeight = outerHeight - frameBar * 2;

  return (
    <AnatomyPartGroup part="rear-standard">
      <group
        name="rear-standard-frame"
        position={transform.position}
        quaternion={transform.quaternion}
        renderOrder={presentation.renderOrder}
      >
        <mesh
          name="rear-standard-frame-top"
          position={[0, toWorld((outerHeight - frameBar) / 2), 0]}
        >
          <boxGeometry args={[toWorld(outerWidth), toWorld(frameBar), toWorld(18)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="rear-standard-frame-bottom"
          position={[0, -toWorld((outerHeight - frameBar) / 2), 0]}
        >
          <boxGeometry args={[toWorld(outerWidth), toWorld(frameBar), toWorld(18)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="rear-standard-frame-left-upright"
          position={[-toWorld((outerWidth - frameBar) / 2), 0, 0]}
        >
          <boxGeometry args={[toWorld(frameBar), toWorld(innerHeight), toWorld(18)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        <mesh
          name="rear-standard-frame-right-upright"
          position={[toWorld((outerWidth - frameBar) / 2), 0, 0]}
        >
          <boxGeometry args={[toWorld(frameBar), toWorld(innerHeight), toWorld(18)]} />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : visual.bodyColor}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>

        <AnatomyPartGroup
          part="ground-glass-back"
          position={[0, 0, 0]}
          renderOrder={presentation.renderOrder}
        >
          <mesh name="ground-glass-screen">
            <boxGeometry
              args={[
                toWorld(CAMERA_CONSTANTS.filmWidthMm),
                toWorld(CAMERA_CONSTANTS.filmHeightMm),
                toWorld(3),
              ]}
            />
            <meshStandardMaterial
              color={ghost ? "#cbd5e1" : "#bae6fd"}
              transparent
              opacity={ghost ? 0.22 : 0.28}
              depthWrite={!ghost}
              side={DoubleSide}
            />
          </mesh>
          <mesh name="ground-glass-frame-top" position={[0, toWorld(CAMERA_CONSTANTS.filmHeightMm / 2 + 5), toWorld(-3)]}>
            <boxGeometry args={[toWorld(CAMERA_CONSTANTS.filmWidthMm + 10), toWorld(5), toWorld(2)]} />
            <meshStandardMaterial
              color={ghost ? "#cbd5e1" : "#64748b"}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
          <mesh name="ground-glass-frame-bottom" position={[0, -toWorld(CAMERA_CONSTANTS.filmHeightMm / 2 + 5), toWorld(-3)]}>
            <boxGeometry args={[toWorld(CAMERA_CONSTANTS.filmWidthMm + 10), toWorld(5), toWorld(2)]} />
            <meshStandardMaterial
              color={ghost ? "#cbd5e1" : "#64748b"}
              {...frameMaterialProps(presentation)}
            />
          </mesh>
        </AnatomyPartGroup>
      </group>
    </AnatomyPartGroup>
  );
};

const StaticBellowsAssembly = ({
  rearCenter,
  frontCenter,
  ghost,
}: {
  rearCenter: Vec3;
  frontCenter: Vec3;
  ghost: boolean;
}) => {
  const span = resolveConceptualBellowsSpan(rearCenter, frontCenter);
  const foldCount = 9;
  const segmentLength = span.length / foldCount;
  const rearWidth = 128;
  const frontWidth = 112;
  const rearHeight = 98;
  const frontHeight = 84;

  return (
    <AnatomyPartGroup
      part="bellows"
      position={span.position}
      quaternion={span.quaternion}
      renderOrder={ghost ? 10 : 0}
    >
      {Array.from({ length: foldCount }, (_, index) => {
        const t = (index + 0.5) / foldCount;
        const width = rearWidth + (frontWidth - rearWidth) * t;
        const height = rearHeight + (frontHeight - rearHeight) * t;
        const z = -span.length / 2 + segmentLength * (index + 0.5);
        return (
          <mesh
            key={`bellows-fold-${index + 1}`}
            name={`bellows-fold-${index + 1}`}
            position={[0, 0, z]}
          >
            <boxGeometry
              args={[toWorld(width), toWorld(height), Math.max(segmentLength * 0.78, toWorld(4))]}
            />
            <meshStandardMaterial
              color={ghost ? "#94a3b8" : "#111827"}
              transparent
              opacity={ghost ? 0.14 : 0.9}
              depthWrite={!ghost}
              roughness={0.88}
            />
          </mesh>
        );
      })}
    </AnatomyPartGroup>
  );
};

const CameraSupport = ({
  coordinateSpace,
  rigTransform,
  ghost,
  rigRail,
}: {
  coordinateSpace: ConceptualCameraCoordinateSpace;
  rigTransform: CameraRigTransform;
  ghost: boolean;
  rigRail?: ConceptualCameraRail;
}) => {
  const presentation = { ghost, renderOrder: ghost ? 10 : 0 };
  const rail = rigRail ?? CONCEPTUAL_CAMERA_SUPPORT_RAIL;
  const rearMountRigLocal = resolveSupportMountRigLocal(rail, "rear");
  const frontMountRigLocal = resolveSupportMountRigLocal(rail, "front");

  const mount = (
    name: string,
    position: [number, number, number],
    quaternion?: Quaternion,
  ) => (
    <group
      name={name}
      position={position}
      quaternion={quaternion}
      renderOrder={presentation.renderOrder}
    >
      <mesh>
        <boxGeometry args={[toWorld(52), toWorld(22), toWorld(38)]} />
        <meshStandardMaterial
          color={ghost ? "#cbd5e1" : "#475569"}
          {...frameMaterialProps(presentation)}
        />
      </mesh>
    </group>
  );

  if (coordinateSpace === "rig-local") {
    return (
      <AnatomyPartGroup part="camera-support" renderOrder={presentation.renderOrder}>
        <mesh
          name={ghost ? "original-ghost-camera-rail" : "camera-body-rail"}
          position={vecToWorld(rail.centerRigLocal)}
          renderOrder={presentation.renderOrder}
        >
          <boxGeometry
            args={[
              toWorld(rail.dimensionsMm.x),
              toWorld(rail.dimensionsMm.y),
              toWorld(rail.dimensionsMm.z),
            ]}
          />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : "#334155"}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
        {mount("camera-support-front-mount", vecToWorld(frontMountRigLocal))}
        {mount("camera-support-rear-mount", vecToWorld(rearMountRigLocal))}
      </AnatomyPartGroup>
    );
  }

  const beam = resolveConceptualSupportBeam(rail, rigTransform);
  const rearMountWorld = transformRigLocalPointToWorld(
    rearMountRigLocal,
    rigTransform,
  );
  const frontMountWorld = transformRigLocalPointToWorld(
    frontMountRigLocal,
    rigTransform,
  );

  return (
    <AnatomyPartGroup part="camera-support" renderOrder={presentation.renderOrder}>
      <group
        name={ghost ? "original-ghost-camera-support-rail" : "camera-support-rail"}
        position={beam.position}
        quaternion={beam.quaternion}
        renderOrder={presentation.renderOrder}
      >
        <mesh>
          <boxGeometry
            args={[
              toWorld(rail.dimensionsMm.x),
              toWorld(rail.dimensionsMm.y),
              beam.length,
            ]}
          />
          <meshStandardMaterial
            color={ghost ? "#94a3b8" : "#334155"}
            {...frameMaterialProps(presentation)}
          />
        </mesh>
      </group>
      {mount(
        "camera-support-front-mount",
        vecToWorld(frontMountWorld),
        beam.quaternion,
      )}
      {mount(
        "camera-support-rear-mount",
        vecToWorld(rearMountWorld),
        beam.quaternion,
      )}
    </AnatomyPartGroup>
  );
};

const renderAnatomy = ({
  opticsState,
  coordinateSpace,
  variant,
  showBellows,
  activeStandard,
  rigRail,
}: Required<Pick<ConceptualViewCameraProps, "opticsState" | "coordinateSpace" | "variant" | "showBellows">> & {
  activeStandard?: FocusStandard | null;
  rigRail?: ConceptualCameraRail;
}) => {
  const canonical = resolveCanonicalCameraGeometry(opticsState, coordinateSpace);
  const ghost = variant === "ghost";
  return (
    <>
      <CameraSupport
        coordinateSpace={coordinateSpace}
        rigTransform={opticsState.cameraRigTransform}
        ghost={ghost}
        rigRail={rigRail}
      />
      <FrontStandardAssembly
        lensCenter={canonical.lensCenter}
        lensNormal={canonical.lensNormal}
        ghost={ghost}
        active={activeStandard === "front"}
      />
      {showBellows ? (
        <StaticBellowsAssembly
          rearCenter={canonical.filmCenter}
          frontCenter={canonical.lensCenter}
          ghost={ghost}
        />
      ) : null}
      <RearStandardAssembly
        frame={canonical.rearStandardFrame}
        ghost={ghost}
        active={activeStandard === "rear"}
      />
    </>
  );
};

/**
 * Shared static anatomy for the conceptual view camera.
 *
 * Every placement input comes from DerivedOpticsState. The only distinction
 * between coordinate spaces is whether the existing canonical rig hierarchy
 * is applied around local geometry or the already-resolved world frame is
 * consumed directly.
 */
export const renderConceptualViewCamera = ({
  opticsState,
  variant = "current",
  coordinateSpace = "world",
  showBellows = true,
  activeStandard = null,
  rigRail,
}: ConceptualViewCameraProps) => {
  const ghost = variant === "ghost";
  const anatomy = renderAnatomy({
    opticsState,
    coordinateSpace,
    variant,
    showBellows,
    activeStandard,
    rigRail,
  });

  if (coordinateSpace === "rig-local") {
    const transform = resolveCameraRigRenderTransform(opticsState.cameraRigTransform);
    return (
      <group
        name={ghost ? "original-ghost-camera-rig-placement" : "camera-rig-placement"}
        userData={{ cameraVariant: variant, conceptualCamera: true }}
        position={transform.rigPlacement.position}
        quaternion={transform.rigPlacement.quaternion}
      >
        <group
          name={ghost ? "original-ghost-camera-body-pitch" : "camera-body-pitch"}
          position={transform.bodyPitch.position}
          quaternion={transform.bodyPitch.quaternion}
        >
          <group
            name="camera-body-local-geometry"
            userData={{ cameraCoordinateSpace: "rig-local" }}
            position={transform.localOffset}
          >
            {anatomy}
          </group>
        </group>
      </group>
    );
  }

  return (
    <group
      name={ghost ? "original-ghost-camera" : "conceptual-view-camera"}
      userData={{ cameraVariant: variant, conceptualCamera: true }}
    >
      {anatomy}
    </group>
  );
};

export const ConceptualViewCamera = (props: ConceptualViewCameraProps) =>
  renderConceptualViewCamera(props);

export default ConceptualViewCamera;
