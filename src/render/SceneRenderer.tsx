import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { DoubleSide, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitControls as OrbitControlsController } from "three-stdlib";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneAsset, SceneDefinition } from "../types/scene";
import type { RenderQualityProfile } from "../types/ui";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { FocusFundamentalsSubject } from "./FocusFundamentalsSubjectFactory";
import { UI_COPY } from "../ui/copy";
import { getRenderQualitySettings } from "./renderQuality";

type SceneRendererProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  attempt: number;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  // new: show/hide optical debug planes (film plane) - default hidden for Focus Fundamentals
  showOpticalDebugPlanes?: boolean;
  renderQuality: RenderQualityProfile;
  viewResetNonce: number;
  simulateAssetFailure: boolean;
  onAssetError: (message: string) => void;
  // optional container style allows embedding the renderer in different sized containers
  containerStyle?: React.CSSProperties;
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

const RearStandard = ({ isFocusFundamentals }: { isFocusFundamentals?: boolean }) => {
  const rearZ = isFocusFundamentals ? 0 : -CAMERA_CONSTANTS.focalLengthMm;
  return (
    <>
      <mesh position={[0, 0, toWorld(rearZ)]}>
        <boxGeometry args={[toWorld(180), toWorld(140), toWorld(18)]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
    </>
  );
};

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
  // Build a single continuous line passing through film datum center, lens center, focus point and extending forward
  const filmCenter = vecToWorld(opticsState.filmCenterWorld);
  const lensCenter = vecToWorld(opticsState.lensCenterWorld);
  const focusCenter = vecToWorld(opticsState.focusPlane.point);
  const dir = {
    x: focusCenter[0] - lensCenter[0],
    y: focusCenter[1] - lensCenter[1],
    z: focusCenter[2] - lensCenter[2],
  };
  const dirLen = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const forward = { x: dir.x / dirLen, y: dir.y / dirLen, z: dir.z / dirLen };
  const DEBUG_DEPTH = toWorld(10000);
  const forwardPoint: [number, number, number] = [lensCenter[0] + forward.x * DEBUG_DEPTH, lensCenter[1] + forward.y * DEBUG_DEPTH, lensCenter[2] + forward.z * DEBUG_DEPTH];

  const positions = new Float32Array([
    filmCenter[0], filmCenter[1], filmCenter[2],
    lensCenter[0], lensCenter[1], lensCenter[2],
    focusCenter[0], focusCenter[1], focusCenter[2],
    forwardPoint[0], forwardPoint[1], forwardPoint[2],
  ]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      {/* optical axis color updated to be visually distinct from FOV rays */}
      <lineBasicMaterial attach="material" color="#06b6d4" linewidth={2} transparent opacity={0.95} />
    </line>
  );
};

const PlaneOverlay = ({ color, point }: { color: string; point: [number, number, number] }) => (
  <mesh position={point}>
    <planeGeometry args={[toWorld(450), toWorld(300)]} />
    <meshBasicMaterial color={color} transparent opacity={0.2} side={DoubleSide} />
  </mesh>
);

// Helper to render legend text and swatch for a given key
const renderLegendText = (key: string) => {
  const swatch = (color: string) => (
    <span style={{ display: "inline-block", width: 10, height: 10, background: color, marginRight: 6, verticalAlign: "middle", borderRadius: 2 }} />
  );
  switch (key) {
    case "film":
      return (
        <>
          {swatch("#38bdf8")}
          <span>Film plane (blue)</span>
        </>
      );
    case "lens":
      return (
        <>
          {swatch("#1f2937")}
          <span>Lens plane (slate)</span>
        </>
      );
    case "focus":
      return (
        <>
          {swatch("#16a34a")}
          <span>Focus plane (green)</span>
        </>
      );
    case "nearDof":
    case "farDof":
      return (
        <>
          {swatch("#a78bfa")}
          <span>DOF limit (violet)</span>
        </>
      );
    case "fov":
      return (
        <>
          {swatch("#f59e0b")}
          <span>FOV rays (amber)</span>
        </>
      );
    case "axis":
      return (
        <>
          {swatch("#06b6d4")}
          <span>Optical axis</span>
        </>
      );
    default:
      return <span>{key}</span>;
  }
};

// LegendUpdater: projects world anchors to screen positions each frame and updates parent state
const LegendUpdater = ({
  containerRef,
  opticsState,
  setLegendPositions,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  opticsState: DerivedOpticsState;
  setLegendPositions: React.Dispatch<React.SetStateAction<Record<string, { left: number; top: number; visible: boolean; corner?: boolean }>>>;
}) => {
  const { camera, gl } = useThree();
  const tmpV = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!containerRef.current) return;
    // prefer the actual canvas element bounds for projection math
    const canvasEl = gl.domElement as HTMLCanvasElement;
    const canvasRect = canvasEl.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const anchors: Record<string, [number, number, number]> = {
      film: vecToWorld(opticsState.filmCenterWorld),
      lens: vecToWorld(opticsState.lensCenterWorld),
      focus: vecToWorld(opticsState.focusPlane.point),
      nearDof: vecToWorld(opticsState.depthOfFieldNearPlane.point),
      farDof: vecToWorld(opticsState.depthOfFieldFarPlane.point),
      fov: vecToWorld({ x: opticsState.lensCenterWorld.x + 0.001, y: opticsState.lensCenterWorld.y + 0.001, z: opticsState.lensCenterWorld.z + 0.001 }),
      axis: vecToWorld({ x: opticsState.lensCenterWorld.x, y: opticsState.lensCenterWorld.y, z: opticsState.lensCenterWorld.z }),
    };

    const margin = 8;
    const nextEntries: { key: string; left: number; top: number; visible: boolean }[] = [];

    Object.entries(anchors).forEach(([k, v]) => {
      tmpV.set(v[0], v[1], v[2]);
      tmpV.project(camera);
      // projection within canvas coordinate space
      const xCanvas = (tmpV.x + 1) / 2 * canvasRect.width;
      const yCanvas = (1 - tmpV.y) / 2 * canvasRect.height;

      // compute position relative to container (overlay parent) so CSS left/top align
      let left = canvasRect.left - containerRect.left + xCanvas;
      let top = canvasRect.top - containerRect.top + yCanvas;

      // clamp to canvas bounds with margin so labels never render outside
      left = Math.min(Math.max(left, canvasRect.left - containerRect.left + margin), canvasRect.right - containerRect.left - margin);
      top = Math.min(Math.max(top, canvasRect.top - containerRect.top + margin), canvasRect.bottom - containerRect.top - margin);

      const inFrustum = tmpV.z > -1 && tmpV.z < 1;
      nextEntries.push({ key: k, left, top, visible: inFrustum });
    });

    // Simple collision avoidance: sort by top and push overlapping labels downward
    const minSpacing = 24; // px
    nextEntries.sort((a, b) => a.top - b.top);
    for (let i = 1; i < nextEntries.length; i++) {
      const prev = nextEntries[i - 1];
      const cur = nextEntries[i];
      const dy = cur.top - prev.top;
      const dx = Math.abs(cur.left - prev.left);
      if (dy < minSpacing && dx < 80) {
        // push current down to avoid overlap
        cur.top = prev.top + minSpacing;
        // ensure we don't push beyond canvas bottom
        const maxTop = canvasRect.bottom - containerRect.top - margin;
        if (cur.top > maxTop) cur.top = maxTop;
      }
    }

    const next: Record<string, { left: number; top: number; visible: boolean; corner?: boolean }> = {};
    nextEntries.forEach((e) => {
      next[e.key] = { left: e.left, top: e.top, visible: e.visible, corner: false };
    });

    setLegendPositions(next);
  });

  return null;
};

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
  showOpticalDebugPlanes = false,
}: {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  showOpticalDebugPlanes?: boolean;
}) => (
  <>
    <color attach="background" args={["#f8fafc"]} />
    <ambientLight intensity={0.65} />
    <directionalLight position={[2, 4, 2]} intensity={0.7} />
    <hemisphereLight args={["#ffffff", "#d1d5db", 0.45]} />
    <SceneAssets assets={scene.assets} />
    <RearStandard isFocusFundamentals={scene.id === "focus-fundamentals-two-targets"} />
    <FrontStandard opticsState={opticsState} />
    {showOpticalDebugPlanes && <FilmPlane opticsState={opticsState} />}
    {scene.id !== "focus-fundamentals-two-targets" && <Bellows opticsState={opticsState} />}
    <OpticalAxisOverlay opticsState={opticsState} />
    {/* If this is the Focus Fundamentals scene, render planes sized from the optical frustum */}
    {scene.id === "focus-fundamentals-two-targets" ? (
      <>
        {/* FOV forward rays (object-side) derived from film corners -> lens -> forward continuation */}
        <group>
          {(() => {
            const filmCorners = [
              opticsState.filmPlaneCornersWorld.topLeft,
              opticsState.filmPlaneCornersWorld.topRight,
              opticsState.filmPlaneCornersWorld.bottomRight,
              opticsState.filmPlaneCornersWorld.bottomLeft,
            ];
            const lens = vecToWorld(opticsState.lensCenterWorld);
            const DEBUG_DEPTH = toWorld(10000);
            return filmCorners.map((corner, idx) => {
              const cornerW = vecToWorld(corner);
              const dir = { x: lens[0] - cornerW[0], y: lens[1] - cornerW[1], z: lens[2] - cornerW[2] };
              const dlen = Math.hypot(dir.x, dir.y, dir.z) || 1;
              const nd = { x: dir.x / dlen, y: dir.y / dlen, z: dir.z / dlen };
              const start: [number, number, number] = [lens[0], lens[1], lens[2]];
              const end: [number, number, number] = [lens[0] + nd.x * DEBUG_DEPTH, lens[1] + nd.y * DEBUG_DEPTH, lens[2] + nd.z * DEBUG_DEPTH];
              const positions = new Float32Array([start[0], start[1], start[2], end[0], end[1], end[2]]);
              return (
                <line key={idx}>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                  </bufferGeometry>
                  <lineBasicMaterial attach="material" color="#f59e0b" linewidth={2} transparent opacity={0.98} />
                </line>
              );
            });
          })()}
        </group>

        {/* Focus plane and DOF planes derived from intersections of object-side FOV rays with each plane */}
        {showFocusPlaneOverlay && !opticsState.diagnostics?.isInfinityFocus && (() => {
         // helper: intersect ray (origin + t*dir) with plane where planePoint is a world-space triplet array
         const intersectRayPlane = (
           origin: [number, number, number],
           dir: { x: number; y: number; z: number },
           planePointArr: [number, number, number],
           planeNormal: { x: number; y: number; z: number },
         ): [number, number, number] | null => {
           const o = { x: origin[0], y: origin[1], z: origin[2] };
           const p0 = { x: planePointArr[0], y: planePointArr[1], z: planePointArr[2] };
           const n = planeNormal;
           const denom = dir.x * n.x + dir.y * n.y + dir.z * n.z;
           if (Math.abs(denom) < 1e-6) return null; // parallel
           const t = ((p0.x - o.x) * n.x + (p0.y - o.y) * n.y + (p0.z - o.z) * n.z) / denom;
           if (!Number.isFinite(t) || t <= 1e-6) return null; // intersection behind or at origin
           return [o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t];
         };

         const lens = vecToWorld(opticsState.lensCenterWorld);
         const filmCorners = [
           opticsState.filmPlaneCornersWorld.topLeft,
           opticsState.filmPlaneCornersWorld.topRight,
           opticsState.filmPlaneCornersWorld.bottomRight,
           opticsState.filmPlaneCornersWorld.bottomLeft,
         ];

         const filmCornersW = filmCorners.map((c) => vecToWorld(c));

         const rayDirs = filmCornersW.map((cornerW) => {
           const dir = { x: lens[0] - cornerW[0], y: lens[1] - cornerW[1], z: lens[2] - cornerW[2] };
           const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
           return { x: dir.x / len, y: dir.y / len, z: dir.z / len };
         });

         // compute intersections
         const focusPlanePointWorld = vecToWorld(opticsState.focusPlane.point);
         const nearPlanePointWorld = vecToWorld(opticsState.depthOfFieldNearPlane.point);
         const farPlanePointWorld = vecToWorld(opticsState.depthOfFieldFarPlane.point);

         const focusCorners = rayDirs.map((d) => intersectRayPlane(lens, d, focusPlanePointWorld, opticsState.focusPlane.normal));
         const nearCorners = rayDirs.map((d) => intersectRayPlane(lens, d, nearPlanePointWorld, opticsState.depthOfFieldNearPlane.normal));
         const farCorners = rayDirs.map((d) => intersectRayPlane(lens, d, farPlanePointWorld, opticsState.depthOfFieldFarPlane.normal));

         const lensZ = lens[2];

         const allFocusValid = focusCorners.every((p) => p !== null && p[2] > lensZ + 1e-6);
         const allNearValid = nearCorners.every((p) => p !== null && p[2] > lensZ + 1e-6);
         const allFarValid = farCorners.every((p) => p !== null && p[2] > lensZ + 1e-6);

         const makeQuadMesh = (pts: (null | [number, number, number])[], color: string, opacity = 0.35) => {
           if (pts.some((p) => p === null)) return null;
           // positions: p0,p1,p2,p3 -> triangles [0,1,2] and [0,2,3]
           const p0 = pts[0] as [number, number, number];
           const p1 = pts[1] as [number, number, number];
           const p2 = pts[2] as [number, number, number];
           const p3 = pts[3] as [number, number, number];
           const positions = new Float32Array([
             p0[0], p0[1], p0[2],
             p1[0], p1[1], p1[2],
             p2[0], p2[1], p2[2],
             p3[0], p3[1], p3[2],
           ]);
           const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
           return (
             <mesh>
               <bufferGeometry>
                 <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                 <bufferAttribute attach="index" args={[indices, 1]} />
               </bufferGeometry>
               <meshBasicMaterial color={color} transparent opacity={opacity} side={DoubleSide} />
             </mesh>
           );
         };

         return (
           <>
             {allFocusValid && makeQuadMesh(focusCorners, "#16a34a", 0.35)}
             {showDofOverlay && allNearValid && makeQuadMesh(nearCorners, "#a78bfa", 0.25)}
             {showDofOverlay && allFarValid && makeQuadMesh(farCorners, "#a78bfa", 0.2)}
           </>
         );
        })()}

      </>
    ) : (
      <>
        {showFocusPlaneOverlay && !opticsState.diagnostics?.isInfinityFocus && (
          <PlaneOverlay color="#22c55e" point={vecToWorld(opticsState.focusPlane.point)} />
        )}
        {showDofOverlay && (
          <>
            <PlaneOverlay color="#60a5fa" point={vecToWorld(opticsState.depthOfFieldNearPlane.point)} />
            <PlaneOverlay color="#a78bfa" point={vecToWorld(opticsState.depthOfFieldFarPlane.point)} />
          </>
        )}
      </>
    )}
    {scene.id === "focus-fundamentals-two-targets" ? (
      // Use shared scene subject for Focus Fundamentals
      <>
        <FocusFundamentalsSubject />
      </>
    ) : (
      scene.focusTargets.map((target) => (
        <mesh key={target.id} position={vecToWorld(target.worldPosition)}>
          <sphereGeometry args={[toWorld(50), 16, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))
    )}
  </>
);

export const SceneRenderer = ({
  scene,
  opticsState,
  attempt,
  showFocusPlaneOverlay,
  showDofOverlay,
  showOpticalDebugPlanes,
  renderQuality,
  viewResetNonce,
  simulateAssetFailure,
  onAssetError,
  containerStyle,
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

  const defaultContainerStyle: React.CSSProperties = { height: 320, border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [legendPositions, setLegendPositions] = useState<Record<string, { left: number; top: number; visible: boolean; corner?: boolean }>>({});
  const [showLegends, setShowLegends] = useState(true);
  const [showDebugOverlay, setShowDebugOverlay] = useState(true);

  // ensure the wrapper is positioned so absolute children (legends, button) are positioned relative to it
  const wrapperStyle: React.CSSProperties = containerStyle
    ? { ...containerStyle, position: (containerStyle as React.CSSProperties).position ?? "relative" }
    : { ...defaultContainerStyle, position: "relative" };

  // If assets failed to load, don't render the canvas content. This return must come after hooks to satisfy hook rules.
  if (simulateAssetFailure && attempt === 0) {
    return null;
  }

  return (
    <div ref={containerRef} data-testid="scene-canvas" style={wrapperStyle}>
      {/* Legends toggle */}
      <button
        onClick={() => setShowLegends((s) => !s)}
        aria-pressed={showLegends}
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          zIndex: 220,
          background: showLegends ? "#0f172a" : "#ffffff",
          color: showLegends ? "#ffffff" : "#0f172a",
          border: "1px solid rgba(2,6,23,0.08)",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {showLegends ? "Hide legends" : "Show legends"}
      </button>
      {/* Debug overlay toggle */}
      <button
        onClick={() => setShowDebugOverlay((s) => !s)}
        aria-pressed={showDebugOverlay}
        style={{
          position: "absolute",
          left: 8,
          top: 44,
          zIndex: 220,
          background: showDebugOverlay ? "#374151" : "#ffffff",
          color: showDebugOverlay ? "#ffffff" : "#0f172a",
          border: "1px solid rgba(2,6,23,0.08)",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {showDebugOverlay ? "Hide debug" : "Show debug"}
      </button>
      <Canvas
        style={{ width: "100%", height: "100%" }}
        dpr={qualityConfig.dpr}
        camera={{ position: observerCameraPosition, fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: qualityConfig.antialias }}
      >
        {/* LegendUpdater runs inside the r3f context so it can access camera and gl */}
        {/**/}
        <LegendUpdater containerRef={containerRef} opticsState={opticsState} setLegendPositions={setLegendPositions} />
        <SceneContent
          scene={{ ...scene, assets: activeAssets }}
          opticsState={opticsState}
          showFocusPlaneOverlay={showFocusPlaneOverlay}
          showDofOverlay={showDofOverlay}
          showOpticalDebugPlanes={showOpticalDebugPlanes}
        />
        <OrbitControls ref={controlsRef} enablePan={false} enableZoom enableRotate />
      </Canvas>

      {/* Legends overlay stuck to elements */}
      {showLegends && Object.entries(legendPositions).map(([key, pos]) =>
        pos.visible ? (
          <div
            key={key}
            style={{
              position: "absolute",
              left: pos.left,
              top: pos.top,
              // If this position was explicitly placed in a corner, don't apply centering transform
              transform: pos.corner ? "none" : "translate(-50%, -60%)",
              pointerEvents: "none",
              color: "#0f172a",
              background: "rgba(255,255,255,0.9)",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 12,
              border: "1px solid rgba(2,6,23,0.06)",
              maxWidth: 220,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {renderLegendText(key)}
          </div>
        ) : null,
      )}

      {/* Debug overlay (scene-only): simple assertions and numeric readout for Focus Fundamentals */}
      {scene.id === "focus-fundamentals-two-targets" && (() => {
        // compute basic assertion values in mm
        const filmDatumZ = opticsState.filmCenterWorld.z;
        const lensZ = opticsState.lensCenterWorld.z;
        const nearDofZ = opticsState.depthOfFieldNearPlane.point.z;
        const focusZ = opticsState.focusPlane.point.z;
        const farDofZ = opticsState.depthOfFieldFarPlane.point.z;
        const filmCorners = [
          opticsState.filmPlaneCornersWorld.topLeft,
          opticsState.filmPlaneCornersWorld.topRight,
          opticsState.filmPlaneCornersWorld.bottomRight,
          opticsState.filmPlaneCornersWorld.bottomLeft,
        ];
        const lens = opticsState.lensCenterWorld;
        // ray dir in world mm: L - F
        const rayDirs = filmCorners.map((c) => {
          const d = { x: lens.x - c.x, y: lens.y - c.y, z: lens.z - c.z };
          const len = Math.hypot(d.x, d.y, d.z) || 1;
          return { x: d.x / len, y: d.y / len, z: d.z / len };
        });
        const intersectPlane = (origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, planePoint: { x: number; y: number; z: number }, planeNormal: { x: number; y: number; z: number }) => {
          const denom = dir.x * planeNormal.x + dir.y * planeNormal.y + dir.z * planeNormal.z;
          if (Math.abs(denom) < 1e-9) return null;
          const t = ((planePoint.x - origin.x) * planeNormal.x + (planePoint.y - origin.y) * planeNormal.y + (planePoint.z - origin.z) * planeNormal.z) / denom;
          if (!Number.isFinite(t) || t <= 1e-6) return null;
          return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
        };
        const focusIntersections = rayDirs.map((d) => intersectPlane(lens, d, opticsState.focusPlane.point, opticsState.focusPlane.normal));
        const allFovHitFocus = focusIntersections.every((p) => p !== null && p.z > lensZ + 1e-6);
        const nearIntersections = rayDirs.map((d) => intersectPlane(lens, d, opticsState.depthOfFieldNearPlane.point, opticsState.depthOfFieldNearPlane.normal));
        const farIntersections = rayDirs.map((d) => intersectPlane(lens, d, opticsState.depthOfFieldFarPlane.point, opticsState.depthOfFieldFarPlane.normal));
        const allNearInFront = nearIntersections.every((p) => p !== null && p.z > lensZ + 1e-6);
        const allFarInFront = farIntersections.every((p) => p !== null && p.z > lensZ + 1e-6);

        return (
          showDebugOverlay ? (
            <div style={{ position: "absolute", right: 8, top: 8, zIndex: 210, background: "rgba(15,23,42,0.9)", padding: 8, borderRadius: 6, color: "#e5e7eb", fontSize: 11, pointerEvents: 'auto', maxWidth: 260, lineHeight: 1.2, overflow: "auto", maxHeight: 180 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>Optical debug</div>
                <button onClick={() => setShowDebugOverlay(false)} style={{ marginLeft: 8, background: "transparent", border: "none", color: "#e5e7eb", cursor: "pointer" }} aria-label="Close debug">✕</button>
              </div>
              <div style={{ fontSize: 11 }}>
                <div>filmDatumZ: {filmDatumZ.toFixed(2)} mm</div>
                <div>lensZ: {lensZ.toFixed(2)} mm</div>
                <div>nearDofZ: {nearDofZ.toFixed(2)} mm</div>
                <div>focusZ: {focusZ.toFixed(2)} mm</div>
                <div>farDofZ: {farDofZ.toFixed(2)} mm</div>
                <div style={{ marginTop: 6 }}>opticalAxisEndpoints: film→lens→focus</div>
                <div>FOV rays: 4</div>
                <div>All FOV rays hit focus plane: {allFovHitFocus ? "yes" : "no"}</div>
                <div>All DOF near plane in front of lens: {allNearInFront ? "yes" : "no"}</div>
                <div>All DOF far plane in front of lens: {allFarInFront ? "yes" : "no"}</div>
              </div>
            </div>
          ) : null
        );
      })()}
    </div>
  );
};
