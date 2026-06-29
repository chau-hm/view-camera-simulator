import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import type { RenderQualityProfile } from "../types/ui";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { UI_COPY } from "../ui/copy";

type SceneRendererProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  attempt: number;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  renderQuality: RenderQualityProfile;
  viewResetNonce: number;
  simulateAssetFailure: boolean;
  onAssetError: (message: string) => void;
};

const WORLD_SCALE = 0.001;
const DEFAULT_OBSERVER_CAMERA_POSITION: [number, number, number] = [0.6, 0.5, 1.6];
const DEFAULT_OBSERVER_CAMERA_TARGET: [number, number, number] = [0, 0, -0.2];

const toWorld = (millimeter: number): number => millimeter * WORLD_SCALE;
const vecToWorld = (value: { x: number; y: number; z: number }): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

const QUALITY_CONFIG: Record<RenderQualityProfile, { dpr: number }> = {
  high: { dpr: 2 },
  standard: { dpr: 1.5 },
  low: { dpr: 1 },
};

const RearStandard = () => (
  <>
    <mesh position={[0, 0, toWorld(-CAMERA_CONSTANTS.focalLengthMm)]}>
      <boxGeometry args={[toWorld(180), toWorld(140), toWorld(18)]} />
      <meshStandardMaterial color="#4b5563" />
    </mesh>
  </>
);

const FrontStandard = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  const frontPosition = vecToWorld(opticsState.lensCenterWorld);
  const frontRotation: [number, number, number] = [
    (opticsState.diagnostics.tiltAngleDeg * Math.PI) / 180,
    (opticsState.diagnostics.swingAngleDeg * Math.PI) / 180,
    0,
  ];

  return (
    <group position={frontPosition} rotation={frontRotation}>
      <mesh>
        <boxGeometry args={[toWorld(180), toWorld(140), toWorld(12)]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0, 0, toWorld(8)]}>
        <boxGeometry args={[toWorld(100), toWorld(100), toWorld(8)]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, 0, toWorld(16)]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[toWorld(18), toWorld(18), toWorld(18), 24]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
};

const FilmPlane = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  const filmPosition = vecToWorld(opticsState.filmCenterWorld);
  return (
    <mesh position={filmPosition}>
      <planeGeometry args={[toWorld(CAMERA_CONSTANTS.filmWidthMm), toWorld(CAMERA_CONSTANTS.filmHeightMm)]} />
      <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} side={DoubleSide} />
    </mesh>
  );
};

const Bellows = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  const rearZ = toWorld(-CAMERA_CONSTANTS.focalLengthMm);
  const front = vecToWorld(opticsState.lensCenterWorld);
  const center: [number, number, number] = [front[0] / 2, front[1] / 2, (rearZ + front[2]) / 2];
  const depth = Math.max(Math.abs(front[2] - rearZ), toWorld(20));

  return (
    <mesh position={center}>
      <boxGeometry args={[toWorld(120), toWorld(90), depth]} />
      <meshStandardMaterial color="#111827" transparent opacity={0.25} />
    </mesh>
  );
};

const OpticalAxisOverlay = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  const start = vecToWorld(opticsState.lensCenterWorld);
  const end = vecToWorld(opticsState.focusPointWorld);
  const center: [number, number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.max(Math.hypot(dx, dy, dz), toWorld(1));
  const yaw = Math.atan2(dx, dz);
  const pitch = -Math.atan2(dy, Math.hypot(dx, dz));

  return (
    <mesh position={center} rotation={[pitch, yaw, 0]}>
      <cylinderGeometry args={[toWorld(1), toWorld(1), length, 8]} />
      <meshBasicMaterial color="#f59e0b" />
    </mesh>
  );
};

const PlaneOverlay = ({ color, point }: { color: string; point: [number, number, number] }) => (
  <mesh position={point}>
    <planeGeometry args={[toWorld(450), toWorld(300)]} />
    <meshBasicMaterial color={color} transparent opacity={0.2} side={DoubleSide} />
  </mesh>
);

const SceneContent = ({
  scene,
  opticsState,
  showFocusPlaneOverlay,
  showDofOverlay,
}: {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
}) => (
  <>
    <color attach="background" args={["#f8fafc"]} />
    <ambientLight intensity={0.65} />
    <directionalLight position={[2, 4, 2]} intensity={0.7} />
    <hemisphereLight args={["#ffffff", "#d1d5db", 0.45]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -toWorld(60), 0]}>
      <planeGeometry args={[toWorld(8000), toWorld(8000)]} />
      <meshStandardMaterial color="#e5e7eb" />
    </mesh>
    <RearStandard />
    <FrontStandard opticsState={opticsState} />
    <FilmPlane opticsState={opticsState} />
    <Bellows opticsState={opticsState} />
    <OpticalAxisOverlay opticsState={opticsState} />
    {showFocusPlaneOverlay && <PlaneOverlay color="#22c55e" point={vecToWorld(opticsState.focusPlane.point)} />}
    {showDofOverlay && (
      <>
        <PlaneOverlay color="#60a5fa" point={vecToWorld(opticsState.depthOfFieldNearPlane.point)} />
        <PlaneOverlay color="#a78bfa" point={vecToWorld(opticsState.depthOfFieldFarPlane.point)} />
      </>
    )}
    {scene.focusTargets.map((target) => (
      <mesh key={target.id} position={vecToWorld(target.worldPosition)}>
        <sphereGeometry args={[toWorld(50), 16, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    ))}
  </>
);

export const SceneRenderer = ({
  scene,
  opticsState,
  attempt,
  showFocusPlaneOverlay,
  showDofOverlay,
  renderQuality,
  viewResetNonce,
  simulateAssetFailure,
  onAssetError,
}: SceneRendererProps) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const qualityConfig = useMemo(() => QUALITY_CONFIG[renderQuality], [renderQuality]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...DEFAULT_OBSERVER_CAMERA_TARGET);
      controlsRef.current.update();
    }
  }, []);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(...DEFAULT_OBSERVER_CAMERA_TARGET);
      controlsRef.current.update();
    }
  }, [viewResetNonce]);

  useEffect(() => {
    if (simulateAssetFailure && attempt === 0) {
      onAssetError(`${UI_COPY.render.sceneAssetLoadFailedPrefix} ${scene.id}.`);
    }
  }, [attempt, onAssetError, scene.id, simulateAssetFailure]);

  if (simulateAssetFailure && attempt === 0) {
    return null;
  }

  return (
    <div data-testid="scene-canvas" style={{ height: 320, border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
      <Canvas
        dpr={qualityConfig.dpr}
        camera={{ position: DEFAULT_OBSERVER_CAMERA_POSITION, fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: renderQuality !== "low" }}
      >
        <SceneContent
          scene={scene}
          opticsState={opticsState}
          showFocusPlaneOverlay={showFocusPlaneOverlay}
          showDofOverlay={showDofOverlay}
        />
        <OrbitControls ref={controlsRef} enablePan={false} enableZoom enableRotate />
      </Canvas>
    </div>
  );
};
