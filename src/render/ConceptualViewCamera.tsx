/* eslint-disable react-refresh/only-export-components */
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Quaternion,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import { transformRigLocalPointToWorld } from "../core/optics/applyCameraBodyPitch";
import type {
  CameraBodyLocalGeometry,
  CameraRigTransform,
  DerivedOpticsState,
  StandardFrame,
  Vec3,
} from "../types/optics";
import type { ApertureValue, FocusStandard } from "../types/camera";
import { CAMERA_CONSTANTS } from "../utils/constants";
import {
  resolveCameraRigRenderTransform,
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "./planeOrientation";
import { resolveFocusStandardVisualState } from "./focusStandardPresentation";
import { WORLD_SCALE } from "./rttUtils";
import {
  buildConceptualBellowsGeometry,
  resolveConceptualBellowsAttachmentFrames,
  type ConceptualBellowsGeometry,
  type ConceptualBellowsAttachmentFrames,
} from "./conceptualBellowsGeometry";
import {
  resolveConceptualApertureBlades,
  resolveConceptualApertureOpening,
  resolveConceptualFilmHolderGeometry,
  resolveConceptualGroundGlassGeometry,
  type ConceptualRearBackMode,
} from "./conceptualCameraAnatomyGeometry";

export type { ConceptualRearBackMode } from "./conceptualCameraAnatomyGeometry";

/** Stable semantic part IDs reserved for future camera-anatomy inspection. */
export const CONCEPTUAL_CAMERA_ANATOMY_PARTS = [
  "lens",
  "lens-board",
  "front-standard",
  "bellows",
  "rear-standard",
  "ground-glass-back",
  "film-holder",
  "camera-support",
] as const;

export type ConceptualCameraAnatomyPart =
  (typeof CONCEPTUAL_CAMERA_ANATOMY_PARTS)[number];

export type ConceptualCameraVariant = "current" | "ghost";
export type ConceptualCameraCoordinateSpace = "world" | "rig-local";

export type AnatomyPresentationState = "normal" | "highlighted" | "dimmed";

export type ConceptualAnatomyTarget =
  | {
      kind: "part";
      part: ConceptualCameraAnatomyPart;
    }
  | {
      kind: "element";
      name: "lens-aperture-iris";
      parentPart: "lens";
    };

export type ConceptualCameraAnatomyPresentation = {
  targets: readonly ConceptualAnatomyTarget[];
};

export type ConceptualCameraPresentation = {
  anatomy?: ConceptualCameraAnatomyPresentation;
  /** Physical rear-back presentation; this does not alter optical state. */
  rearBackMode?: ConceptualRearBackMode;
  /** Presentation-only aperture value; canonical state remains authoritative. */
  aperture?: ApertureValue;
};

const isPartTarget = (
  target: ConceptualAnatomyTarget,
  part: ConceptualCameraAnatomyPart,
): boolean => target.kind === "part" && target.part === part;

/**
 * Resolve the declarative presentation state for a semantic camera part.
 * Structural targets include their visible child assemblies so a Front or
 * Rear Standard remains comprehensible while a specific child can still be
 * inspected on its own.
 */
export const resolveConceptualAnatomyPartState = (
  part: ConceptualCameraAnatomyPart,
  presentation?: ConceptualCameraAnatomyPresentation,
): AnatomyPresentationState => {
  const targets = presentation?.targets ?? [];
  if (targets.length === 0) return "normal";

  const highlighted = targets.some((target) => {
    if (isPartTarget(target, part)) return true;
    if (target.kind === "element" && target.parentPart === part) return true;
    if (target.kind !== "part") return false;
    if (target.part === "front-standard") {
      return part === "lens-board" || part === "lens";
    }
    if (target.part === "rear-standard") {
      return part === "ground-glass-back" || part === "film-holder";
    }
    return false;
  });

  return highlighted ? "highlighted" : "dimmed";
};

export const resolveConceptualAnatomyElementState = (
  targetName: "lens-aperture-iris",
  parentPart: "lens",
  presentation?: ConceptualCameraAnatomyPresentation,
): AnatomyPresentationState => {
  const targets = presentation?.targets ?? [];
  if (targets.length === 0) return "normal";
  if (
    targets.some(
      (target) =>
        target.kind === "element" &&
        target.name === targetName &&
        target.parentPart === parentPart,
    )
  ) {
    return "highlighted";
  }
  return resolveConceptualAnatomyPartState(parentPart, presentation);
};

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
  /** Physical rear-back anatomy to render; this does not alter optical state. */
  rearBackMode?: ConceptualRearBackMode;
  /** Canonical camera inputs used only for the visual aperture subcomponent. */
  aperture?: ApertureValue;
  focalLengthMm?: number;
  /** Existing canonical support rail for the calibrated rig scene. */
  rigRail?: ConceptualCameraRail;
  /** Lesson/anatomy presentation only; never an input to optical derivation. */
  presentation?: ConceptualCameraPresentation;
};

type CanonicalCameraGeometry = {
  lensCenter: Vec3;
  lensNormal: Vec3;
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
      rearStandardFrame: local.rearStandardFrameLocal,
    };
  }

  return {
    lensCenter: opticsState.lensCenterWorld,
    lensNormal: opticsState.lensNormalWorld,
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

type PresentationProps = {
  ghost: boolean;
  state?: AnatomyPresentationState;
};

const resolvePresentationColor = (
  baseColor: string,
  ghostColor: string,
  state: AnatomyPresentationState,
  ghost: boolean,
): string => {
  if (state === "highlighted") return "#f59e0b";
  return ghost ? ghostColor : baseColor;
};

const frameMaterialProps = ({ ghost, state = "normal" }: PresentationProps) => ({
  transparent: ghost || state === "dimmed",
  opacity: ghost ? 0.35 : state === "dimmed" ? 0.25 : 1,
  depthWrite: !ghost && state !== "dimmed",
});

const FrontStandardAssembly = ({
  lensCenter,
  lensNormal,
  ghost,
  active,
  aperture,
  focalLengthMm,
  anatomy,
}: {
  lensCenter: Vec3;
  lensNormal: Vec3;
  ghost: boolean;
  active: boolean;
  aperture?: ApertureValue;
  focalLengthMm?: number;
  anatomy?: ConceptualCameraAnatomyPresentation;
}) => {
  const visual = resolveFocusStandardVisualState("front", active ? "front" : null);
  const transform = resolveFrontStandardRenderTransform(lensCenter, lensNormal);
  const frameState = resolveConceptualAnatomyPartState("front-standard", anatomy);
  const lensBoardState = resolveConceptualAnatomyPartState("lens-board", anatomy);
  const lensState = resolveConceptualAnatomyPartState("lens", anatomy);
  const apertureState = resolveConceptualAnatomyElementState(
    "lens-aperture-iris",
    "lens",
    anatomy,
  );
  const presentation = {
    ghost,
    renderOrder: ghost ? 10 : 0,
    state: frameState,
  };
  const apertureOpening = resolveConceptualApertureOpening({ aperture, focalLengthMm });
  const apertureBlades = resolveConceptualApertureBlades({ aperture, focalLengthMm });
  const apertureFocused = apertureState === "highlighted";
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
              color={resolvePresentationColor(visual.detailColor, "#cbd5e1", lensBoardState, ghost)}
              {...frameMaterialProps({ ghost, state: lensBoardState })}
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
              color={resolvePresentationColor(visual.lensColor, "#6b7280", lensState, ghost)}
              {...frameMaterialProps({ ghost, state: lensState })}
            />
          </mesh>
          <mesh name="lens-shutter-housing" position={[0, 0, toWorld(15)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(31), toWorld(31), toWorld(18), 32]} />
            <meshStandardMaterial
              color={resolvePresentationColor("#374151", "#94a3b8", lensState, ghost)}
              {...frameMaterialProps({ ghost, state: lensState })}
            />
          </mesh>
          <mesh name="lens-front-barrel" position={[0, 0, toWorld(27)]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[toWorld(27), toWorld(27), toWorld(14), 32, 1, true]} />
            <meshStandardMaterial
              color={resolvePresentationColor("#1f2937", "#6b7280", lensState, ghost)}
              {...frameMaterialProps({ ghost, state: lensState })}
            />
          </mesh>
          <mesh
            name="lens-front-glass"
            position={[0, 0, toWorld(35.5)]}
            scale={[1, 1, 0.22]}
            renderOrder={presentation.renderOrder}
          >
            <sphereGeometry args={[toWorld(22), 32, 16]} />
            <meshStandardMaterial
              color={
                apertureFocused
                  ? "#7dd3fc"
                  : resolvePresentationColor("#38bdf8", "#cbd5e1", lensState, ghost)
              }
              transparent
              opacity={
                ghost
                  ? 0.2
                  : apertureFocused
                    ? 0.08
                    : lensState === "dimmed"
                      ? 0.14
                      : 0.42
              }
              depthWrite={false}
              metalness={0.15}
              roughness={0.18}
              side={DoubleSide}
            />
          </mesh>
          <mesh
            name="lens-aperture-iris"
            position={[0, 0, toWorld(30)]}
            renderOrder={presentation.renderOrder + 1}
          >
            <ringGeometry
              args={[
                toWorld(apertureOpening.openingRadiusMm),
                toWorld(apertureOpening.outerRadiusMm),
                32,
              ]}
            />
            <meshStandardMaterial
              color={resolvePresentationColor("#020617", "#475569", apertureState, ghost)}
              transparent={ghost || apertureState === "dimmed"}
              opacity={ghost ? 0.38 : apertureState === "dimmed" ? 0.2 : 0.96}
              depthWrite={!ghost && apertureState !== "dimmed"}
              depthTest={false}
              side={DoubleSide}
              roughness={0.82}
            />
          </mesh>
          <mesh
            name="lens-aperture-opening"
            position={[0, 0, toWorld(30.5)]}
            renderOrder={presentation.renderOrder + 2}
          >
            <circleGeometry args={[toWorld(apertureOpening.openingRadiusMm), 32]} />
            <meshBasicMaterial
              color="#020617"
              transparent={ghost || apertureState === "dimmed"}
              opacity={ghost ? 0.3 : apertureState === "dimmed" ? 0.18 : 0.92}
              depthTest={false}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          {apertureBlades.map((blade) => (
            <mesh
              key={blade.index}
              name={`lens-aperture-iris-blade-${blade.index}`}
              position={[0, 0, toWorld(30.75)]}
              renderOrder={presentation.renderOrder + 3}
            >
              <ringGeometry
                args={[
                  toWorld(blade.innerRadiusMm),
                  toWorld(blade.outerRadiusMm),
                  12,
                  1,
                  blade.thetaStartRad,
                  blade.thetaLengthRad,
                ]}
              />
              <meshStandardMaterial
                color={
                  apertureState === "highlighted"
                    ? "#fef3c7"
                    : resolvePresentationColor("#1e293b", "#64748b", apertureState, ghost)
                }
                transparent={ghost || apertureState === "dimmed"}
                opacity={ghost ? 0.4 : apertureState === "dimmed" ? 0.2 : 0.98}
                depthWrite={!ghost && apertureState !== "dimmed"}
                depthTest={false}
                side={DoubleSide}
                roughness={0.76}
              />
            </mesh>
          ))}
        </AnatomyPartGroup>
      </group>
    </AnatomyPartGroup>
  );
};

const GroundGlassBack = ({ ghost, state = "normal" }: PresentationProps) => {
  const geometry = resolveConceptualGroundGlassGeometry();
  const { frame, surface } = geometry;
  const frameY = (frame.outerHeightMm - frame.barMm) / 2;
  const frameX = (frame.outerWidthMm - frame.barMm) / 2;
  const renderFrameMaterial = () => (
    <meshStandardMaterial
      color={resolvePresentationColor("#64748b", "#cbd5e1", state, ghost)}
      {...frameMaterialProps({ ghost, state })}
    />
  );

  return (
    <AnatomyPartGroup
      part="ground-glass-back"
      position={[0, 0, 0]}
      renderOrder={ghost ? 10 : 0}
    >
      <group
        name="ground-glass-frame"
        position={vecToWorld(frame.centerLocal)}
        renderOrder={ghost ? 10 : 0}
      >
        <mesh name="ground-glass-frame-top" position={[0, toWorld(frameY), 0]}>
          <boxGeometry args={[toWorld(frame.outerWidthMm), toWorld(frame.barMm), toWorld(frame.depthMm)]} />
          {renderFrameMaterial()}
        </mesh>
        <mesh name="ground-glass-frame-bottom" position={[0, -toWorld(frameY), 0]}>
          <boxGeometry args={[toWorld(frame.outerWidthMm), toWorld(frame.barMm), toWorld(frame.depthMm)]} />
          {renderFrameMaterial()}
        </mesh>
        <mesh name="ground-glass-frame-left" position={[-toWorld(frameX), 0, 0]}>
          <boxGeometry args={[toWorld(frame.barMm), toWorld(frame.outerHeightMm - frame.barMm * 2), toWorld(frame.depthMm)]} />
          {renderFrameMaterial()}
        </mesh>
        <mesh name="ground-glass-frame-right" position={[toWorld(frameX), 0, 0]}>
          <boxGeometry args={[toWorld(frame.barMm), toWorld(frame.outerHeightMm - frame.barMm * 2), toWorld(frame.depthMm)]} />
          {renderFrameMaterial()}
        </mesh>
      </group>
      <mesh
        name="ground-glass-screen"
        position={vecToWorld(surface.centerLocal)}
      >
        <planeGeometry args={[toWorld(surface.widthMm), toWorld(surface.heightMm)]} />
        <meshStandardMaterial
          color={resolvePresentationColor("#bae6fd", "#cbd5e1", state, ghost)}
          transparent
          opacity={ghost ? 0.22 : state === "dimmed" ? 0.1 : 0.28}
          depthWrite={!ghost && state !== "dimmed"}
          side={DoubleSide}
        />
      </mesh>
    </AnatomyPartGroup>
  );
};

const FilmHolder = ({ ghost, state = "normal" }: PresentationProps) => {
  const geometry = resolveConceptualFilmHolderGeometry();
  const { frame, holder, surface } = geometry;
  const frameY = (frame.outerHeightMm - frame.barMm) / 2;
  const frameX = (frame.outerWidthMm - frame.barMm) / 2;

  return (
    <AnatomyPartGroup
      part="film-holder"
      position={[0, 0, 0]}
      renderOrder={ghost ? 10 : 0}
    >
      <mesh
        name="film-holder-body"
        position={vecToWorld(holder.centerLocal)}
        renderOrder={ghost ? 10 : 0}
      >
        <boxGeometry
          args={[toWorld(holder.widthMm), toWorld(holder.heightMm), toWorld(holder.depthMm)]}
        />
        <meshStandardMaterial
          color={resolvePresentationColor("#1f2937", "#94a3b8", state, ghost)}
          {...frameMaterialProps({ ghost, state })}
          roughness={0.86}
        />
      </mesh>
      <group
        name="film-holder-frame"
        position={vecToWorld(frame.centerLocal)}
        renderOrder={ghost ? 10 : 0}
      >
        <mesh name="film-holder-frame-top" position={[0, toWorld(frameY), 0]}>
          <boxGeometry args={[toWorld(frame.outerWidthMm), toWorld(frame.barMm), toWorld(frame.depthMm)]} />
          <meshStandardMaterial
            color={resolvePresentationColor("#475569", "#cbd5e1", state, ghost)}
            {...frameMaterialProps({ ghost, state })}
          />
        </mesh>
        <mesh name="film-holder-frame-bottom" position={[0, -toWorld(frameY), 0]}>
          <boxGeometry args={[toWorld(frame.outerWidthMm), toWorld(frame.barMm), toWorld(frame.depthMm)]} />
          <meshStandardMaterial
            color={resolvePresentationColor("#475569", "#cbd5e1", state, ghost)}
            {...frameMaterialProps({ ghost, state })}
          />
        </mesh>
        <mesh name="film-holder-frame-left" position={[-toWorld(frameX), 0, 0]}>
          <boxGeometry args={[toWorld(frame.barMm), toWorld(frame.outerHeightMm - frame.barMm * 2), toWorld(frame.depthMm)]} />
          <meshStandardMaterial
            color={resolvePresentationColor("#475569", "#cbd5e1", state, ghost)}
            {...frameMaterialProps({ ghost, state })}
          />
        </mesh>
        <mesh name="film-holder-frame-right" position={[toWorld(frameX), 0, 0]}>
          <boxGeometry args={[toWorld(frame.barMm), toWorld(frame.outerHeightMm - frame.barMm * 2), toWorld(frame.depthMm)]} />
          <meshStandardMaterial
            color={resolvePresentationColor("#475569", "#cbd5e1", state, ghost)}
            {...frameMaterialProps({ ghost, state })}
          />
        </mesh>
      </group>
      <mesh
        name="film-holder-film-surface"
        position={vecToWorld(surface.centerLocal)}
        renderOrder={ghost ? 11 : 1}
      >
        <planeGeometry args={[toWorld(surface.widthMm), toWorld(surface.heightMm)]} />
        <meshStandardMaterial
          color={resolvePresentationColor("#111827", "#cbd5e1", state, ghost)}
          transparent={ghost || state === "dimmed"}
          opacity={ghost ? 0.3 : state === "dimmed" ? 0.18 : 0.9}
          depthWrite={!ghost && state !== "dimmed"}
          side={DoubleSide}
          roughness={0.92}
        />
      </mesh>
    </AnatomyPartGroup>
  );
};

const RearStandardAssembly = ({
  frame,
  ghost,
  active,
  rearBackMode,
  anatomy,
}: {
  frame: StandardFrame;
  ghost: boolean;
  active: boolean;
  rearBackMode: ConceptualRearBackMode;
  anatomy?: ConceptualCameraAnatomyPresentation;
}) => {
  const visual = resolveFocusStandardVisualState("rear", active ? "rear" : null);
  const transform = resolveRearStandardRenderTransform(frame);
  const frameState = resolveConceptualAnatomyPartState("rear-standard", anatomy);
  const groundGlassState = resolveConceptualAnatomyPartState(
    "ground-glass-back",
    anatomy,
  );
  const filmHolderState = resolveConceptualAnatomyPartState("film-holder", anatomy);
  const presentation = {
    ghost,
    renderOrder: ghost ? 10 : 0,
    state: frameState,
  };
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
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
            color={resolvePresentationColor(visual.bodyColor, "#94a3b8", frameState, ghost)}
            emissive={ghost ? "#000000" : visual.emissiveColor}
            emissiveIntensity={ghost ? 0 : visual.emissiveIntensity}
            {...frameMaterialProps(presentation)}
          />
        </mesh>

        {rearBackMode === "ground-glass" ? (
          <GroundGlassBack ghost={ghost} state={groundGlassState} />
        ) : (
          <FilmHolder ghost={ghost} state={filmHolderState} />
        )}
      </group>
    </AnatomyPartGroup>
  );
};

type RenderableBellowsGeometry = {
  geometry: BufferGeometry;
  position: Float32BufferAttribute;
  normal: Float32BufferAttribute;
  index: Uint16BufferAttribute;
};

const createRenderableBellowsGeometry = (
  data: ConceptualBellowsGeometry,
): RenderableBellowsGeometry => {
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute(
    new Float32Array(data.positions.map(toWorld)),
    3,
  );
  const normal = new Float32BufferAttribute(
    new Float32Array(data.normals),
    3,
  );
  const index = new Uint16BufferAttribute(
    new Uint16Array(data.triangleIndices),
    1,
  );
  geometry.setAttribute("position", position);
  geometry.setAttribute("normal", normal);
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return { geometry, position, normal, index };
};

type DeformableBellowsMeshProps = {
  frames: ConceptualBellowsAttachmentFrames;
  frustumCulled: boolean;
  ghost: boolean;
  name: string;
  state: AnatomyPresentationState;
};

const sameBellowsEndpointFrame = (
  first: ConceptualBellowsAttachmentFrames["rear"],
  second: ConceptualBellowsAttachmentFrames["rear"],
): boolean =>
  first.center.x === second.center.x &&
  first.center.y === second.center.y &&
  first.center.z === second.center.z &&
  first.quaternion.x === second.quaternion.x &&
  first.quaternion.y === second.quaternion.y &&
  first.quaternion.z === second.quaternion.z &&
  first.quaternion.w === second.quaternion.w &&
  first.widthMm === second.widthMm &&
  first.heightMm === second.heightMm;

const areDeformableBellowsMeshPropsEqual = (
  first: DeformableBellowsMeshProps,
  second: DeformableBellowsMeshProps,
): boolean =>
  first.ghost === second.ghost &&
  first.state === second.state &&
  first.frustumCulled === second.frustumCulled &&
  first.name === second.name &&
  sameBellowsEndpointFrame(first.frames.rear, second.frames.rear) &&
  sameBellowsEndpointFrame(first.frames.front, second.frames.front);

const DeformableBellowsMesh = memo(({
  frames,
  frustumCulled,
  ghost,
  name,
  state,
}: DeformableBellowsMeshProps) => {
  const geometryData = useMemo(
    () => buildConceptualBellowsGeometry(frames),
    [frames],
  );
  const [renderGeometry] = useState(() =>
    createRenderableBellowsGeometry(geometryData),
  );

  useLayoutEffect(() => {
    renderGeometry.position.copyArray(
      new Float32Array(geometryData.positions.map(toWorld)),
    );
    renderGeometry.position.needsUpdate = true;
    renderGeometry.normal.copyArray(new Float32Array(geometryData.normals));
    renderGeometry.normal.needsUpdate = true;
    renderGeometry.index.copyArray(
      new Uint16Array(geometryData.triangleIndices),
    );
    renderGeometry.index.needsUpdate = true;
    renderGeometry.geometry.computeBoundingSphere();
  }, [geometryData, renderGeometry]);

  useEffect(() => () => {
    renderGeometry.geometry.dispose();
  }, [renderGeometry]);

  return (
    <mesh
      name={name}
      geometry={renderGeometry.geometry}
      frustumCulled={frustumCulled}
      renderOrder={ghost ? 10 : 0}
    >
      <meshStandardMaterial
        color={resolvePresentationColor("#111827", "#94a3b8", state, ghost)}
        transparent={ghost || state === "dimmed"}
        opacity={ghost ? 0.18 : state === "dimmed" ? 0.16 : 0.9}
        depthWrite={!ghost && state !== "dimmed"}
        roughness={0.88}
        side={DoubleSide}
      />
    </mesh>
  );
}, areDeformableBellowsMeshPropsEqual);

const DeformableBellowsAssembly = ({
  frames,
  ghost,
  anatomy,
}: {
  frames: ConceptualBellowsAttachmentFrames;
  ghost: boolean;
  anatomy?: ConceptualCameraAnatomyPresentation;
}) => (
  <AnatomyPartGroup
    part="bellows"
    renderOrder={ghost ? 10 : 0}
  >
    <DeformableBellowsMesh
      name="bellows-folded-surface"
      frames={frames}
      frustumCulled={false}
      ghost={ghost}
      state={resolveConceptualAnatomyPartState("bellows", anatomy)}
    />
  </AnatomyPartGroup>
);

const CameraSupport = ({
  coordinateSpace,
  rigTransform,
  ghost,
  rigRail,
  anatomy,
}: {
  coordinateSpace: ConceptualCameraCoordinateSpace;
  rigTransform: CameraRigTransform;
  ghost: boolean;
  rigRail?: ConceptualCameraRail;
  anatomy?: ConceptualCameraAnatomyPresentation;
}) => {
  const supportState = resolveConceptualAnatomyPartState("camera-support", anatomy);
  const presentation = {
    ghost,
    renderOrder: ghost ? 10 : 0,
    state: supportState,
  };
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
            color={resolvePresentationColor("#475569", "#cbd5e1", supportState, ghost)}
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
            color={resolvePresentationColor("#334155", "#94a3b8", supportState, ghost)}
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
            color={resolvePresentationColor("#334155", "#94a3b8", supportState, ghost)}
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
  rearBackMode,
  aperture,
  focalLengthMm,
  rigRail,
  anatomy,
}: Required<Pick<ConceptualViewCameraProps, "opticsState" | "coordinateSpace" | "variant" | "showBellows">> & {
  activeStandard?: FocusStandard | null;
  rearBackMode: ConceptualRearBackMode;
  aperture?: ApertureValue;
  focalLengthMm?: number;
  rigRail?: ConceptualCameraRail;
  anatomy?: ConceptualCameraAnatomyPresentation;
}) => {
  const canonical = resolveCanonicalCameraGeometry(opticsState, coordinateSpace);
  const ghost = variant === "ghost";
  const bellowsFrames = showBellows
    ? resolveConceptualBellowsAttachmentFrames({
        frontCenter: canonical.lensCenter,
        frontNormal: canonical.lensNormal,
        rearFrame: canonical.rearStandardFrame,
      })
    : null;
  return (
    <>
      <CameraSupport
        coordinateSpace={coordinateSpace}
        rigTransform={opticsState.cameraRigTransform}
        ghost={ghost}
        rigRail={rigRail}
        anatomy={anatomy}
      />
      <FrontStandardAssembly
        lensCenter={canonical.lensCenter}
        lensNormal={canonical.lensNormal}
        ghost={ghost}
        active={activeStandard === "front"}
        aperture={aperture}
        focalLengthMm={focalLengthMm}
        anatomy={anatomy}
      />
      {showBellows ? (
        <DeformableBellowsAssembly
          frames={bellowsFrames!}
          ghost={ghost}
          anatomy={anatomy}
        />
      ) : null}
      <RearStandardAssembly
        frame={canonical.rearStandardFrame}
        ghost={ghost}
        active={activeStandard === "rear"}
        rearBackMode={rearBackMode}
        anatomy={anatomy}
      />
    </>
  );
};

/**
 * Shared anatomy for the conceptual view camera.
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
  rearBackMode = "ground-glass",
  aperture,
  focalLengthMm,
  rigRail,
  presentation,
}: ConceptualViewCameraProps) => {
  const ghost = variant === "ghost";
  const anatomyPresentation = presentation?.anatomy;
  const visualRearBackMode = presentation?.rearBackMode ?? rearBackMode;
  const visualAperture = presentation?.aperture ?? aperture;
  const anatomy = renderAnatomy({
    opticsState,
    coordinateSpace,
    variant,
    showBellows,
    activeStandard,
    rearBackMode: visualRearBackMode,
    aperture: visualAperture,
    focalLengthMm,
    rigRail,
    anatomy: anatomyPresentation,
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
