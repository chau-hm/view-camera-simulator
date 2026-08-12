import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import type { DerivedOpticsState } from "../types/optics";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { resolveFocusFundamentalsTeachingCue } from "../scenes/focusFundamentalsPresentation";
import { resolveFrontStandardRenderTransform, resolveRearStandardRenderTransform } from "./planeOrientation";
import { toWorld } from "./rttUtils";

type FocusFundamentalsTeachingCuesProps = {
  opticsState: DerivedOpticsState;
  referenceOpticsState: DerivedOpticsState;
};

const REFERENCE_FRAME_OPACITY = 0.24;
const MOVEMENT_VISIBILITY_THRESHOLD_MM = 0.5;

const FocusReferenceStandardFrame = ({
  opticsState,
  activeStandard,
}: {
  opticsState: DerivedOpticsState;
  activeStandard: "front" | "rear";
}) => {
  if (activeStandard === "front") {
    const transform = resolveFrontStandardRenderTransform(
      opticsState.lensCenterWorld,
      opticsState.lensNormalWorld,
    );
    return (
      <group
        name="focus-fundamentals-reference-front-standard"
        position={transform.position}
        quaternion={transform.quaternion}
        renderOrder={9}
      >
        <mesh>
          <boxGeometry
            args={[
              toWorld(CAMERA_CONSTANTS.frontStandardWidthMm),
              toWorld(CAMERA_CONSTANTS.frontStandardHeightMm),
              toWorld(12),
            ]}
          />
          <meshBasicMaterial
            color="#94a3b8"
            transparent
            opacity={REFERENCE_FRAME_OPACITY}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  const transform = resolveRearStandardRenderTransform(opticsState.rearStandardFrame);
  return (
    <group
      name="focus-fundamentals-reference-rear-standard"
      position={transform.position}
      quaternion={transform.quaternion}
      renderOrder={9}
    >
      <mesh>
        <boxGeometry args={[toWorld(180), toWorld(140), toWorld(18)]} />
        <meshBasicMaterial
          color="#94a3b8"
          transparent
          opacity={REFERENCE_FRAME_OPACITY}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

const FocusStandardMovementCue = ({
  opticsState,
  referenceOpticsState,
}: FocusFundamentalsTeachingCuesProps) => {
  const cue = useMemo(
    () => resolveFocusFundamentalsTeachingCue(opticsState, referenceOpticsState),
    [opticsState, referenceOpticsState],
  );
  const movement = useMemo(() => {
    if (cue.distanceMm <= MOVEMENT_VISIBILITY_THRESHOLD_MM) return null;

    const reference = new Vector3(
      toWorld(cue.referencePosition.x),
      toWorld(cue.referencePosition.y),
      toWorld(cue.referencePosition.z),
    );
    const current = new Vector3(
      toWorld(cue.currentPosition.x),
      toWorld(cue.currentPosition.y),
      toWorld(cue.currentPosition.z),
    );
    const delta = current.clone().sub(reference);
    const length = delta.length();
    if (!Number.isFinite(length) || length <= 0) return null;
    const direction = delta.normalize();
    const arrowLength = Math.min(toWorld(38), length * 0.45);
    const arrowPosition = current.clone().addScaledVector(direction, -arrowLength / 2);
    const arrowQuaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction,
    );

    return {
      positions: new Float32Array([
        reference.x,
        reference.y,
        reference.z,
        current.x,
        current.y,
        current.z,
      ]),
      arrowPosition,
      arrowQuaternion,
      arrowLength,
    };
  }, [cue]);

  if (!movement) return null;

  return (
    <group name="focus-fundamentals-standard-movement-cue" renderOrder={15}>
      <line name="focus-fundamentals-standard-movement-line">
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[movement.positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          color="#f59e0b"
          transparent
          opacity={0.82}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </line>
      <mesh
        name="focus-fundamentals-standard-movement-arrow"
        position={movement.arrowPosition}
        quaternion={movement.arrowQuaternion}
      >
        <coneGeometry args={[toWorld(8), movement.arrowLength, 12]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.82}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export const FocusFundamentalsTeachingCues = ({
  opticsState,
  referenceOpticsState,
}: FocusFundamentalsTeachingCuesProps) => {
  const activeStandard = resolveFocusFundamentalsTeachingCue(
    opticsState,
    referenceOpticsState,
  ).activeStandard;

  return (
    <>
      <FocusReferenceStandardFrame
        opticsState={referenceOpticsState}
        activeStandard={activeStandard}
      />
      <FocusStandardMovementCue
        opticsState={opticsState}
        referenceOpticsState={referenceOpticsState}
      />
    </>
  );
};

export default FocusFundamentalsTeachingCues;
