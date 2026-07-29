import { Quaternion, Vector3 } from "three";
import geometry from "../scenes/understandingCameraMovementsGeometry";
import type { DerivedOpticsState, StandardFrame, Vec3 } from "../types/optics";
import { CAMERA_CONSTANTS } from "../utils/constants";
import {
  resolveCameraRigRenderTransform,
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "./planeOrientation";
import { WORLD_SCALE } from "./rttUtils";

type CameraBodyAssemblyProps = {
  opticsState: DerivedOpticsState;
  ghost?: boolean;
  showBellows?: boolean;
};

const toWorld = (millimetres: number): number => millimetres * WORLD_SCALE;
const vecToWorld = (value: Vec3): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

const RearStandardFrame = ({
  frame,
  ghost,
}: {
  frame: StandardFrame;
  ghost: boolean;
}) => {
  const transform = resolveRearStandardRenderTransform(frame);
  return (
    <group
      name={ghost ? "original-ghost-rear-standard" : "camera-body-rear-standard"}
      position={transform.position}
      quaternion={transform.quaternion}
    >
      <mesh renderOrder={ghost ? 10 : 0}>
        <boxGeometry args={[toWorld(180), toWorld(140), toWorld(18)]} />
        <meshStandardMaterial
          color={ghost ? "#94a3b8" : "#4b5563"}
          transparent={ghost}
          opacity={ghost ? 0.35 : 1}
          depthWrite={!ghost}
        />
      </mesh>
    </group>
  );
};

const FrontStandardGeometry = ({
  lensCenter,
  lensNormal,
  ghost,
}: {
  lensCenter: Vec3;
  lensNormal: Vec3;
  ghost: boolean;
}) => {
  const transform = resolveFrontStandardRenderTransform(lensCenter, lensNormal);
  return (
    <group
      name={ghost ? "original-ghost-front-standard" : "camera-body-front-standard"}
      position={transform.position}
      quaternion={transform.quaternion}
      renderOrder={ghost ? 10 : 0}
    >
      <mesh>
        <boxGeometry
          args={[
            toWorld(CAMERA_CONSTANTS.frontStandardWidthMm),
            toWorld(CAMERA_CONSTANTS.frontStandardHeightMm),
            toWorld(12),
          ]}
        />
        <meshStandardMaterial
          color={ghost ? "#94a3b8" : "#6b7280"}
          transparent={ghost}
          opacity={ghost ? 0.35 : 1}
          depthWrite={!ghost}
        />
      </mesh>
      <mesh position={[0, 0, toWorld(8)]}>
        <boxGeometry args={[toWorld(100), toWorld(100), toWorld(8)]} />
        <meshStandardMaterial
          color={ghost ? "#cbd5e1" : "#9ca3af"}
          transparent={ghost}
          opacity={ghost ? 0.35 : 1}
          depthWrite={!ghost}
        />
      </mesh>
      <mesh position={[0, 0, toWorld(16)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[toWorld(18), toWorld(18), toWorld(18), 24]} />
        <meshStandardMaterial
          color={ghost ? "#6b7280" : "#1f2937"}
          transparent={ghost}
          opacity={ghost ? 0.35 : 1}
          depthWrite={!ghost}
        />
      </mesh>
    </group>
  );
};

const BellowsBetween = ({
  rearMm,
  frontMm,
  ghost,
}: {
  rearMm: Vec3;
  frontMm: Vec3;
  ghost: boolean;
}) => {
  const rear = vecToWorld(rearMm);
  const front = vecToWorld(frontMm);
  const center: [number, number, number] = [
    (rear[0] + front[0]) / 2,
    (rear[1] + front[1]) / 2,
    (rear[2] + front[2]) / 2,
  ];
  const depth = Math.max(
    Math.hypot(front[0] - rear[0], front[1] - rear[1], front[2] - rear[2]),
    toWorld(20),
  );
  const direction = new Vector3(
    front[0] - rear[0],
    front[1] - rear[1],
    front[2] - rear[2],
  ).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    direction,
  );

  return (
    <group
      name={ghost ? "original-ghost-bellows" : "camera-body-bellows"}
      position={center}
      quaternion={quaternion}
    >
      <mesh renderOrder={ghost ? 10 : 0}>
        <boxGeometry args={[toWorld(120), toWorld(90), depth]} />
        <meshStandardMaterial
          color={ghost ? "#94a3b8" : "#111827"}
          transparent
          opacity={ghost ? 0.2 : 0.25}
          depthWrite={!ghost}
        />
      </mesh>
    </group>
  );
};

/**
 * The capable scene's camera body owns this declarative R3F subtree.
 * R3F disposes the component-owned geometries and materials when it unmounts.
 */
export const CameraBodyAssembly = ({
  opticsState,
  ghost = false,
  showBellows = true,
}: CameraBodyAssemblyProps) => {
  const transform = resolveCameraRigRenderTransform(opticsState.cameraRigTransform);
  const local = opticsState.cameraBodyLocalGeometry;
  const rail = geometry.cameraBody.rail;

  return (
    <group
      name={ghost ? "original-ghost-camera-rig-placement" : "camera-rig-placement"}
      position={transform.rigPlacement.position}
      quaternion={transform.rigPlacement.quaternion}
    >
      <group
        name={ghost ? "original-ghost-camera-body-pitch" : "camera-body-pitch"}
        position={transform.bodyPitch.position}
        quaternion={transform.bodyPitch.quaternion}
      >
        <group name="camera-body-local-geometry" position={transform.localOffset}>
          <RearStandardFrame frame={local.rearStandardFrameLocal} ghost={ghost} />
          <FrontStandardGeometry
            lensCenter={local.lensCenterLocal}
            lensNormal={local.lensNormalLocal}
            ghost={ghost}
          />
          {showBellows ? (
            <BellowsBetween
              rearMm={local.filmCenterLocal}
              frontMm={local.lensCenterLocal}
              ghost={ghost}
            />
          ) : null}
          <mesh
            name={ghost ? "original-ghost-camera-rail" : "camera-body-rail"}
            position={vecToWorld(rail.centerRigLocal)}
            renderOrder={ghost ? 10 : 0}
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
              transparent={ghost}
              opacity={ghost ? 0.28 : 1}
              depthWrite={!ghost}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export default CameraBodyAssembly;
