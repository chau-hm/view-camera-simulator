import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { DoubleSide } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitControls as OrbitControlsController } from "three-stdlib";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneAsset, SceneDefinition } from "../types/scene";
import type { RenderQualityProfile } from "../types/ui";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { UI_COPY } from "../ui/copy";
import { getRenderQualitySettings } from "./renderQuality";

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

type OrbitControlsProps = {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
};

const OrbitControls = forwardRef<OrbitControlsImpl, OrbitControlsProps>(function OrbitControls(
  { enablePan = false, enableZoom = true, enableRotate = true },
  ref,
) {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControlsController(camera, gl.domElement), [camera, gl.domElement]);

  useFrame(() => {
    controls.update();
  });

  useImperativeHandle(ref, () => controls, [controls]);

  useEffect(() => () => controls.dispose(), [controls]);

  useEffect(() => {
    controls.enablePan = enablePan;
    controls.enableZoom = enableZoom;
    controls.enableRotate = enableRotate;
  }, [controls, enablePan, enableRotate, enableZoom]);

  return null;
});

const toWorld = (millimeter: number): number => millimeter * WORLD_SCALE;
const vecToWorld = (value: { x: number; y: number; z: number }): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

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

const SceneAssetMesh = ({ assetId }: { assetId: string }) => {
  switch (assetId) {
    case "architecture-ground":
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -toWorld(60), 0]}>
          <planeGeometry args={[toWorld(12000), toWorld(12000)]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      );
    case "architecture-building-facade":
      return (
        <group>
          <mesh position={[0, toWorld(5000), toWorld(9500)]}>
            <boxGeometry args={[toWorld(2500), toWorld(10000), toWorld(1200)]} />
            <meshStandardMaterial color="#94a3b8" />
          </mesh>
          {[-800, -300, 300, 800].map((offsetX) => (
            <mesh key={offsetX} position={[toWorld(offsetX), toWorld(5000), toWorld(8900)]}>
              <boxGeometry args={[toWorld(70), toWorld(9800), toWorld(80)]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          ))}
        </group>
      );
    case "table-floor":
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, toWorld(620), 0]}>
          <planeGeometry args={[toWorld(9000), toWorld(9000)]} />
          <meshStandardMaterial color="#ece7e1" />
        </mesh>
      );
    case "table-top":
      return (
        <mesh position={[0, toWorld(800), toWorld(2400)]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[toWorld(2800), toWorld(80), toWorld(3600)]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
      );
    case "table-props":
      return (
        <group>
          <mesh position={[toWorld(-650), toWorld(860), toWorld(1200)]}>
            <cylinderGeometry args={[toWorld(90), toWorld(90), toWorld(140), 20]} />
            <meshStandardMaterial color="#60a5fa" />
          </mesh>
          <mesh position={[toWorld(50), toWorld(850), toWorld(2400)]}>
            <boxGeometry args={[toWorld(260), toWorld(40), toWorld(180)]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[toWorld(550), toWorld(845), toWorld(3600)]}>
            <boxGeometry args={[toWorld(280), toWorld(30), toWorld(220)]} />
            <meshStandardMaterial color="#a855f7" />
          </mesh>
        </group>
      );
    case "shelf-floor":
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, toWorld(640), 0]}>
          <planeGeometry args={[toWorld(10000), toWorld(10000)]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      );
    case "shelf-diagonal-structure":
      return (
        <group>
          <mesh position={[0, toWorld(1200), toWorld(3400)]} rotation={[0, -0.35, 0]}>
            <boxGeometry args={[toWorld(3000), toWorld(120), toWorld(6000)]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          <mesh position={[toWorld(-1100), toWorld(1350), toWorld(1700)]}>
            <boxGeometry args={[toWorld(120), toWorld(700), toWorld(120)]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[toWorld(0), toWorld(1350), toWorld(3300)]}>
            <boxGeometry args={[toWorld(120), toWorld(700), toWorld(120)]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[toWorld(1200), toWorld(1350), toWorld(5100)]}>
            <boxGeometry args={[toWorld(120), toWorld(700), toWorld(120)]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      );
    case "shelf-decor":
      return (
        <group>
          <mesh position={[toWorld(-1100), toWorld(1230), toWorld(1700)]}>
            <boxGeometry args={[toWorld(180), toWorld(180), toWorld(120)]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
          <mesh position={[toWorld(0), toWorld(1230), toWorld(3300)]}>
            <boxGeometry args={[toWorld(180), toWorld(180), toWorld(120)]} />
            <meshStandardMaterial color="#22c55e" />
          </mesh>
          <mesh position={[toWorld(1200), toWorld(1230), toWorld(5100)]}>
            <boxGeometry args={[toWorld(180), toWorld(180), toWorld(120)]} />
            <meshStandardMaterial color="#06b6d4" />
          </mesh>
        </group>
      );
    default:
      return null;
  }
};

const SceneAssets = ({ assets }: { assets: SceneAsset[] }) => (
  <>
    {assets.map((asset) => (
      <SceneAssetMesh key={asset.id} assetId={asset.id} />
    ))}
  </>
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
    <SceneAssets assets={scene.assets.filter((asset) => asset.loadStrategy !== "lazy")} />
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
  const [loadLazyAssets, setLoadLazyAssets] = useState(false);
  const qualityConfig = useMemo(() => getRenderQualitySettings(renderQuality), [renderQuality]);
  const observerCameraPosition = useMemo(
    () => vecToWorld(scene.cameraPlacement.position),
    [scene.cameraPlacement.position],
  );
  const observerCameraTarget = useMemo(
    () => vecToWorld(scene.cameraPlacement.target),
    [scene.cameraPlacement.target],
  );
  const activeAssets = useMemo(
    () =>
      scene.assets.filter((asset) =>
        loadLazyAssets ? true : asset.loadStrategy !== "lazy",
      ),
    [loadLazyAssets, scene.assets],
  );

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...observerCameraTarget);
      controlsRef.current.update();
    }
  }, [observerCameraTarget]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(...observerCameraTarget);
      controlsRef.current.update();
    }
  }, [observerCameraTarget, viewResetNonce]);

  useEffect(() => {
    setLoadLazyAssets(false);
    const timer = setTimeout(() => setLoadLazyAssets(true), 0);
    return () => clearTimeout(timer);
  }, [scene.id]);

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
        camera={{ position: observerCameraPosition, fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: qualityConfig.antialias }}
      >
        <SceneContent
          scene={{ ...scene, assets: activeAssets }}
          opticsState={opticsState}
          showFocusPlaneOverlay={showFocusPlaneOverlay}
          showDofOverlay={showDofOverlay}
        />
        <OrbitControls ref={controlsRef} enablePan={false} enableZoom enableRotate />
      </Canvas>
    </div>
  );
};
