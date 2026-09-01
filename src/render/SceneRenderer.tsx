/* eslint-disable react-refresh/only-export-components */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { add, scale } from "../core/math/vec";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Camera, DoubleSide, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitControls as OrbitControlsController } from "three-stdlib";
import type { ApertureValue, CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneAsset, SceneDefinition } from "../types/scene";
import type { RenderQualityProfile } from "../types/ui";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../utils/constants";
import "../i18n";
import { simulatorMessageKeys } from "../i18n/simulatorMessageKeys";
import { getRenderQualitySettings } from "./renderQuality";
import { getVisibleSceneLegendKeys } from "./sceneLegendHelpers";
import {
  createScenePlaneOverlayGeometry,
  getScenePlaneOverlayBounds,
  type ScenePlaneOverlayGeometry,
} from "./scenePlaneOverlayGeometry";
import { createScheimpflugConstructionGeometry } from "./scheimpflugConstructionGeometry";
import { quaternionForPlaneNormal } from "./planeOrientation";
import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import {
  getRegisteredSceneSubject,
  getSceneSubjectRegistration,
} from "./sceneSubjectRegistry";
import {
  translateObserverViewToTarget,
  type ObserverViewState,
  type SceneViewportFraming,
  type SceneViewFocus,
} from "./sceneViewFraming";
import { useAppStore } from "../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../state/selectors";
import { CameraBodyAssembly } from "./CameraBodyAssembly";
import {
  ConceptualViewCamera,
  type ConceptualCameraPresentation,
} from "./ConceptualViewCamera";
import {
  resolveCameraMovementLatticeRenderModel,
  type CameraMovementLatticeRenderModel,
} from "./cameraMovementLatticeRenderModel";
import { FocusFundamentalsTeachingCues } from "./FocusFundamentalsTeachingCues";
import {
  deriveFocusFundamentalsReferenceOptics,
  resolveFocusFundamentalsActiveStandard,
  resolveFocusFundamentalsTeachingCue,
} from "../scenes/focusFundamentalsPresentation";

type SceneRendererProps = {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  attempt: number;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  showLegends?: boolean;
  showOpticalGeometry?: boolean;
  showScheimpflugConstruction?: boolean;
  renderQuality: RenderQualityProfile;
  viewResetNonce: number;
  viewFocus: SceneViewFocus;
  observerViews: SceneViewportFraming;
  simulateAssetFailure: boolean;
  onAssetError: (message: string) => void;
  // optional container style allows embedding the renderer in different sized containers
  containerStyle?: React.CSSProperties;
  /** Presentation-only anatomy/rear-back/aperture overrides for Lesson 0. */
  cameraPresentation?: ConceptualCameraPresentation;
};

export const shouldRenderReferenceCamera = (
  scene: SceneDefinition,
  cameraMovementRenderModel?: CameraMovementLatticeRenderModel,
): boolean =>
  scene.showReferenceCamera !== false &&
  Boolean(scene.movementCapabilities) &&
  (
    getSceneSubjectRegistration(scene.id)?.resolveShowReferenceCamera?.({
      cameraMovementRenderModel,
    }) ??
    getSceneSubjectRegistration(scene.id)?.showReferenceCamera ??
    true
  );

const WORLD_SCALE = 0.001;

export const serializeFiniteRenderVector = (
  value: { x: number; y: number; z: number },
): string | undefined => {
  const components = [value.x, value.y, value.z];
  return components.every(Number.isFinite)
    ? components.map((component) => component.toFixed(6)).join(",")
    : undefined;
};

const serializeFiniteRenderNumber = (value: number): string | undefined =>
  Number.isFinite(value) ? value.toFixed(6) : undefined;

type OrbitControlsProps = {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  sceneId: string;
  viewFocus: SceneViewFocus;
  sceneView: ObserverViewState;
  cameraView: ObserverViewState;
  viewResetNonce: number;
  onViewStateChange: (state: ObserverViewState) => void;
};

const captureObserverView = (
  camera: Camera,
  controls: OrbitControlsImpl,
): ObserverViewState => ({
  position: camera.position.toArray() as [number, number, number],
  target: controls.target.toArray() as [number, number, number],
});

const targetsMatch = (
  a: [number, number, number],
  b: [number, number, number],
): boolean => a.every((value, index) => Math.abs(value - b[index]) < 1e-9);

const OrbitControls = forwardRef<OrbitControlsImpl, OrbitControlsProps>(function OrbitControls(
  {
    enablePan = false,
    enableZoom = true,
    enableRotate = true,
    sceneId,
    viewFocus,
    sceneView,
    cameraView,
    viewResetNonce,
    onViewStateChange,
  },
  ref,
) {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControlsController(camera, gl.domElement), [camera, gl.domElement]);
  const savedViewsRef = useRef<Record<SceneViewFocus, ObserverViewState | null>>({
    scene: null,
    camera: null,
  });
  const activeFocusRef = useRef(viewFocus);
  const activeSceneIdRef = useRef(sceneId);
  const previousCameraTargetRef = useRef<[number, number, number]>([...cameraView.target]);
  const lastResetNonceRef = useRef(viewResetNonce);
  const initializedRef = useRef(false);

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

  useEffect(() => {
    const publish = () => onViewStateChange(captureObserverView(camera, controls));
    controls.addEventListener("end", publish);
    return () => controls.removeEventListener("end", publish);
  }, [camera, controls, onViewStateChange]);

  useLayoutEffect(() => {
    const applyView = (view: ObserverViewState) => {
      applyObserverCameraReset(camera, controls, view.position, view.target);
      onViewStateChange(captureObserverView(camera, controls));
    };
    const presetFor = (focus: SceneViewFocus) =>
      focus === "scene" ? sceneView : cameraView;

    if (!initializedRef.current || activeSceneIdRef.current !== sceneId) {
      savedViewsRef.current = { scene: null, camera: null };
      activeFocusRef.current = viewFocus;
      activeSceneIdRef.current = sceneId;
      previousCameraTargetRef.current = [...cameraView.target];
      lastResetNonceRef.current = viewResetNonce;
      initializedRef.current = true;
      applyView(presetFor(viewFocus));
      return;
    }

    if (!targetsMatch(previousCameraTargetRef.current, cameraView.target)) {
      const savedCameraView = savedViewsRef.current.camera;
      if (savedCameraView) {
        savedViewsRef.current.camera = translateObserverViewToTarget(
          savedCameraView,
          cameraView.target,
        );
      }
      if (activeFocusRef.current === "camera") {
        applyView(
          translateObserverViewToTarget(
            captureObserverView(camera, controls),
            cameraView.target,
          ),
        );
      }
      previousCameraTargetRef.current = [...cameraView.target];
    }

    if (activeFocusRef.current !== viewFocus) {
      savedViewsRef.current[activeFocusRef.current] = captureObserverView(camera, controls);
      applyView(savedViewsRef.current[viewFocus] ?? presetFor(viewFocus));
      activeFocusRef.current = viewFocus;
    }

    if (lastResetNonceRef.current !== viewResetNonce) {
      applyView(presetFor(activeFocusRef.current));
      savedViewsRef.current[activeFocusRef.current] = captureObserverView(camera, controls);
      lastResetNonceRef.current = viewResetNonce;
    }
  }, [camera, cameraView, controls, onViewStateChange, sceneId, sceneView, viewFocus, viewResetNonce]);

  return null;
});

export const applyObserverCameraReset = (
  camera: Camera,
  controls: OrbitControlsImpl | null,
  position: [number, number, number],
  target: [number, number, number],
) => {
  camera.position.set(...position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...target);
  (camera as unknown as { updateProjectionMatrix?: () => void }).updateProjectionMatrix?.();
  if (controls) {
    controls.target.set(...target);
    controls.update();
  }
};


const toWorld = (millimeter: number): number => millimeter * WORLD_SCALE;
const vecToWorld = (value: { x: number; y: number; z: number }): [number, number, number] => [
  toWorld(value.x),
  toWorld(value.y),
  toWorld(value.z),
];

export const OCCLUDED_PLANE_MATERIAL_SETTINGS = {
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
} as const;

const FilmPlane = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  const filmPosition = vecToWorld(opticsState.filmPlane.point);
  return (
    <mesh position={filmPosition} quaternion={quaternionForPlaneNormal(opticsState.filmPlane.normal)}>
      <planeGeometry args={[toWorld(CAMERA_CONSTANTS.filmWidthMm), toWorld(CAMERA_CONSTANTS.filmHeightMm)]} />
      <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} side={DoubleSide} />
    </mesh>
  );
};

const OpticalAxisOverlay = ({ opticsState }: { opticsState: DerivedOpticsState }) => {
  // Build a single continuous line passing through film datum center, lens center, focus point and extending forward
  const filmCenter = vecToWorld(opticsState.filmCenterWorld);
  const lensCenter = vecToWorld(opticsState.lensCenterWorld);
  // Use physical focus plane if present; otherwise fall back to a visual cap along optical axis
  const focusPlanePointFallback = opticsState.sceneVisualCapDepthMm
    ? add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, opticsState.sceneVisualCapDepthMm))
    : add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, 10000));
  const focusCenter = vecToWorld((opticsState.focusPlane && opticsState.focusPlane.point) || focusPlanePointFallback);
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
      {/* Note: WebGL lineBasicMaterial linewidth is ignored by many browser/GPU combinations. */}
      <lineBasicMaterial attach="material" color="#06b6d4" linewidth={2} transparent opacity={0.95} />
    </line>
  );
};

// Helper to render legend text and swatch for a given key
const renderLegendText = (key: string, t: TFunction) => {
  const swatch = (color: string) => (
    <span style={{ display: "inline-block", width: 10, height: 10, background: color, marginRight: 6, verticalAlign: "middle", borderRadius: 2 }} />
  );
  switch (key) {
    case "film":
      return (
        <>
          {swatch("#38bdf8")}
          <span>{t(simulatorMessageKeys.sceneLegend.filmPlane)}</span>
        </>
      );
    case "lens":
      return (
        <>
          {swatch("#1f2937")}
          <span>{t(simulatorMessageKeys.sceneLegend.lensPlane)}</span>
        </>
      );
    case "focus":
      return (
        <>
          {swatch("#16a34a")}
          <span>{t(simulatorMessageKeys.sceneLegend.focusPlane)}</span>
        </>
      );
    case "nearDof":
      return (
        <>
          {swatch("#0284c7")}
          <span>{t(simulatorMessageKeys.sceneLegend.dofLimit)}</span>
        </>
      );
    case "farDof":
      return (
        <>
          {swatch("#a78bfa")}
          <span>{t(simulatorMessageKeys.sceneLegend.farDof)}</span>
        </>
      );
    case "fov":
      return (
        <>
          {swatch("#f59e0b")}
          <span>{t(simulatorMessageKeys.sceneLegend.fovRays)}</span>
        </>
      );
    case "axis":
      return (
        <>
          {swatch("#06b6d4")}
          <span>{t(simulatorMessageKeys.sceneLegend.opticalAxis)}</span>
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
  visibleKeys,
  showLegends,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  opticsState: DerivedOpticsState;
  setLegendPositions: React.Dispatch<React.SetStateAction<Record<string, { left: number; top: number; visible: boolean; corner?: boolean }>>>;
  visibleKeys?: string[];
  showLegends?: boolean;
}) => {
  const { camera, gl } = useThree();
  const tmpV = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!containerRef.current) return;
    if (!showLegends) return; // nothing to do when legends are disabled
    if (!visibleKeys || visibleKeys.length === 0) return;

    // prefer the actual canvas element bounds for projection math
    const canvasEl = gl.domElement as HTMLCanvasElement;
    const canvasRect = canvasEl.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const allAnchors: Record<string, [number, number, number]> = {
      film: vecToWorld(opticsState.filmCenterWorld),
      lens: vecToWorld(opticsState.lensCenterWorld),
      focus: vecToWorld((opticsState.focusPlane && opticsState.focusPlane.point) || (opticsState.sceneVisualCapDepthMm ? add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, opticsState.sceneVisualCapDepthMm)) : add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, 10000)))),
      nearDof: vecToWorld((opticsState.depthOfFieldNearPlane && opticsState.depthOfFieldNearPlane.point) || (opticsState.sceneVisualCapDepthMm ? add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, opticsState.sceneVisualCapDepthMm)) : add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, 10000)))),
      farDof: vecToWorld((opticsState.depthOfFieldFarPlane && opticsState.depthOfFieldFarPlane.point) || (opticsState.sceneVisualCapDepthMm ? add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, opticsState.sceneVisualCapDepthMm)) : add(opticsState.lensCenterWorld, scale(opticsState.opticalAxis.direction, 10000)))),
      fov: vecToWorld({ x: opticsState.lensCenterWorld.x + 0.001, y: opticsState.lensCenterWorld.y + 0.001, z: opticsState.lensCenterWorld.z + 0.001 }),
      axis: vecToWorld({ x: opticsState.lensCenterWorld.x, y: opticsState.lensCenterWorld.y, z: opticsState.lensCenterWorld.z }),
    };

    const margin = 8;
    const nextEntries: { key: string; left: number; top: number; visible: boolean }[] = [];

    visibleKeys.forEach((k) => {
      const v = allAnchors[k];
      if (!v) return;
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

export const SceneAssetMesh = ({ assetId }: { assetId: string }) => {
  switch (assetId) {
    case "architecture-ground":
      // Architecture Rise uses a shared Three.js subject; skip legacy per-asset meshes to avoid duplication.
      return null;
    case "architecture-building-facade":
      // ArchitectureRiseSubject renders the building geometry; skip legacy placeholder to avoid duplicate geometry.
      return null;
    case "table-floor":
    case "table-top":
    case "table-props":
      // Preserve placeholder metadata for existing preload/failure contracts, but
      // the canonical TableTiltSubject now owns all visible Table Tilt geometry.
      return null;
    case "shelf-floor":
    case "shelf-diagonal-structure":
    case "shelf-decor":
      // Shelf Swing keeps these metadata entries for preload/error contracts;
      // its canonical registered subject owns every visible mesh.
      return null;
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

const OpticalGeometryOverlays = ({
  scene,
  opticsState,
  showFocusPlaneOverlay,
  showDofOverlay,
  showOpticalGeometry,
  showScheimpflugConstruction,
}: {
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  showOpticalGeometry: boolean;
  showScheimpflugConstruction: boolean;
}) => {
  const lens = vecToWorld(opticsState.lensCenterWorld);
  const filmCorners = [
    opticsState.filmPlaneCornersWorld.topLeft,
    opticsState.filmPlaneCornersWorld.topRight,
    opticsState.filmPlaneCornersWorld.bottomRight,
    opticsState.filmPlaneCornersWorld.bottomLeft,
  ].map(vecToWorld);
  const rayDirections = filmCorners.map((corner) => {
    const direction = { x: lens[0] - corner[0], y: lens[1] - corner[1], z: lens[2] - corner[2] };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    return { x: direction.x / length, y: direction.y / length, z: direction.z / length };
  });
  const overlayBounds = getScenePlaneOverlayBounds(scene);
  const renderOverlayGeometry = (
    geometry: ScenePlaneOverlayGeometry,
    color: string,
    opacity: number,
    name: string,
    renderOrder: number,
  ) => {
    const vertices = geometry.verticesMm.map(vecToWorld);
    const positions = new Float32Array(vertices.flat());
    const outlinePositions = new Float32Array([...vertices, vertices[0]].flat());
    return (
      <group name={name} renderOrder={renderOrder}>
        <mesh name={`${name}-fill`} renderOrder={renderOrder}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute
              attach="index"
              args={[new Uint16Array(geometry.triangleIndices), 1]}
            />
          </bufferGeometry>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity}
            side={DoubleSide}
            depthTest={OCCLUDED_PLANE_MATERIAL_SETTINGS.depthTest}
            depthWrite={OCCLUDED_PLANE_MATERIAL_SETTINGS.depthWrite}
            polygonOffset={OCCLUDED_PLANE_MATERIAL_SETTINGS.polygonOffset}
            polygonOffsetFactor={OCCLUDED_PLANE_MATERIAL_SETTINGS.polygonOffsetFactor}
            polygonOffsetUnits={OCCLUDED_PLANE_MATERIAL_SETTINGS.polygonOffsetUnits}
            toneMapped={false}
          />
        </mesh>
        <line name={`${name}-outline`}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[outlinePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            attach="material"
            color={color}
            transparent
            opacity={Math.min(1, opacity + 0.45)}
            depthTest={false}
            depthWrite={OCCLUDED_PLANE_MATERIAL_SETTINGS.depthWrite}
            toneMapped={false}
          />
        </line>
      </group>
    );
  };
  const renderPlane = (
    plane: typeof opticsState.focusPlane,
    enabled: boolean,
    color: string,
    opacity: number,
    name: string,
    renderOrder: number,
  ) => {
    if (!enabled || !plane) return null;
    const geometry = createScenePlaneOverlayGeometry(plane, overlayBounds, {
      extendToPlanePoint: scene.id !== "table-tilt",
    });
    if (!geometry) return null;
    return renderOverlayGeometry(geometry, color, opacity, name, renderOrder);
  };
  const rayLength = toWorld(opticsState.sceneVisualCapDepthMm ?? 12000);
  const constructionGeometry = showScheimpflugConstruction
    ? createScheimpflugConstructionGeometry(opticsState, scene)
    : null;

  return (
    <>
      {showOpticalGeometry && (
        <>
          {filmCorners.map((_, index) => {
            const direction = rayDirections[index];
            const positions = new Float32Array([
              lens[0], lens[1], lens[2],
              lens[0] + direction.x * rayLength,
              lens[1] + direction.y * rayLength,
              lens[2] + direction.z * rayLength,
            ]);
            return (
              <line key={`fov-${index}`}>
                <bufferGeometry>
                  <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                </bufferGeometry>
                <lineBasicMaterial attach="material" color="#f59e0b" linewidth={2} />
              </line>
            );
          })}
          <FilmPlane opticsState={opticsState} />
          <mesh
            name="lens-plane-helper"
            position={vecToWorld(opticsState.lensPlane.point)}
            quaternion={quaternionForPlaneNormal(opticsState.lensPlane.normal)}
          >
            <planeGeometry args={[toWorld(220), toWorld(180)]} />
            <meshBasicMaterial color="#1f2937" transparent opacity={0.35} side={DoubleSide} />
          </mesh>
          <mesh
            name="lens-plane-helper-grid"
            position={vecToWorld(opticsState.lensPlane.point)}
            quaternion={quaternionForPlaneNormal(opticsState.lensPlane.normal)}
          >
            <planeGeometry args={[toWorld(220), toWorld(180), 5, 4]} />
            <meshBasicMaterial color="#0f172a" wireframe transparent opacity={0.7} side={DoubleSide} />
          </mesh>
          <OpticalAxisOverlay opticsState={opticsState} />
        </>
      )}
      {constructionGeometry ? (
        <group name="scheimpflug-construction">
          {renderOverlayGeometry(constructionGeometry.filmPlane, "#38bdf8", 0.12, "scheimpflug-film-plane", 10)}
          {renderOverlayGeometry(constructionGeometry.lensPlane, "#475569", 0.16, "scheimpflug-lens-plane", 11)}
          {renderOverlayGeometry(constructionGeometry.focusPlane, "#16a34a", 0.16, "scheimpflug-focus-plane", 12)}
          <line name="scheimpflug-common-line">
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    ...vecToWorld(constructionGeometry.commonLine.start),
                    ...vecToWorld(constructionGeometry.commonLine.end),
                  ]),
                  3,
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              attach="material"
              color="#7c3aed"
              transparent
              opacity={0.95}
              depthTest={false}
              depthWrite={OCCLUDED_PLANE_MATERIAL_SETTINGS.depthWrite}
              toneMapped={false}
            />
          </line>
          {[constructionGeometry.commonLine.start, constructionGeometry.commonLine.end].map(
            (point, index) => (
              <mesh
                key={`scheimpflug-line-end-${index}`}
                name={`scheimpflug-common-line-end-${index + 1}`}
                position={vecToWorld(point)}
              >
                <sphereGeometry args={[toWorld(32), 12, 12]} />
                <meshBasicMaterial color="#7c3aed" depthTest={false} depthWrite={false} />
              </mesh>
            ),
          )}
        </group>
      ) : null}
      {renderPlane(opticsState.focusPlane ?? null, showFocusPlaneOverlay && !showScheimpflugConstruction && !opticsState.diagnostics.isInfinityFocus, "#16a34a", 0.42, "focus-plane-overlay", 30)}
      {renderPlane(opticsState.depthOfFieldNearPlane ?? null, showDofOverlay, "#60a5fa", 0.24, "near-dof-overlay", 20)}
      {renderPlane(opticsState.depthOfFieldFarPlane ?? null, showDofOverlay && !opticsState.diagnostics.isInfinityFocus, "#a78bfa", 0.22, "far-dof-overlay", 21)}
    </>
  );
};

const SceneContent = ({
  scene,
  cameraMovementRenderModel,
  opticsState,
  showFocusPlaneOverlay,
  showDofOverlay,
  showOpticalGeometry,
  showScheimpflugConstruction,
  focusFocalLengthMm,
  activeAperture,
  cameraPresentation,
}: {
  scene: SceneDefinition;
  cameraMovementRenderModel?: CameraMovementLatticeRenderModel;
  opticsState: DerivedOpticsState;
  showFocusPlaneOverlay: boolean;
  showDofOverlay: boolean;
  showOpticalGeometry: boolean;
  showScheimpflugConstruction: boolean;
  focusFocalLengthMm: number;
  activeAperture: ApertureValue;
  cameraPresentation?: ConceptualCameraPresentation;
}) => {
  const registration = getSceneSubjectRegistration(scene.id);
  const RegisteredSubject = registration?.SceneSubject;
  const isFocusFundamentals = scene.id === "focus-fundamentals-two-targets";
  const focusFundamentalsReferenceOptics = isFocusFundamentals
    ? deriveFocusFundamentalsReferenceOptics(opticsState, scene, focusFocalLengthMm)
    : null;
  const activeFocusStandard = isFocusFundamentals
    ? resolveFocusFundamentalsActiveStandard(opticsState)
    : null;
  const referenceCameraVisible = shouldRenderReferenceCamera(
    scene,
    cameraMovementRenderModel,
  );

  return (
    <>
    <color attach="background" args={["#f8fafc"]} />
    <ambientLight intensity={0.65} />
    <directionalLight position={[2, 4, 2]} intensity={0.7} />
    <hemisphereLight args={["#ffffff", "#d1d5db", 0.45]} />
    <SceneAssets assets={scene.assets} />
    {scene.cameraBodyPitchCapability?.enabled ? (
      <CameraBodyAssembly
        opticsState={opticsState}
        activeStandard={activeFocusStandard}
        aperture={activeAperture}
        focalLengthMm={focusFocalLengthMm}
        presentation={cameraPresentation}
      />
    ) : (
      <ConceptualViewCamera
        opticsState={opticsState}
        variant="current"
        coordinateSpace="world"
        activeStandard={activeFocusStandard}
        aperture={activeAperture}
        focalLengthMm={focusFocalLengthMm}
        presentation={cameraPresentation}
      />
    )}
    {focusFundamentalsReferenceOptics ? (
      <FocusFundamentalsTeachingCues
        opticsState={opticsState}
        referenceOpticsState={focusFundamentalsReferenceOptics}
      />
    ) : null}
    <OpticalGeometryOverlays
      scene={scene}
      opticsState={opticsState}
      showFocusPlaneOverlay={showFocusPlaneOverlay}
      showDofOverlay={showDofOverlay}
      showOpticalGeometry={showOpticalGeometry}
      showScheimpflugConstruction={showScheimpflugConstruction}
    />
    {RegisteredSubject ? (
      <RegisteredSubject scene={scene} />
    ) : (
      scene.focusTargets.map((target) => (
        <mesh key={target.id} position={vecToWorld(target.worldPosition)}>
          <sphereGeometry args={[toWorld(50), 16, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))
    )}
    {referenceCameraVisible ? <OriginalGhostCamera scene={scene} /> : null}
    </>
  );
};

const OriginalGhostCamera = ({
  scene,
}: {
  scene: SceneDefinition;
}) => {
  const hasCapabilities = Boolean(scene.movementCapabilities);
  const originalAperture = scene.cameraPreset.aperture;
  const originalFocalLengthMm =
    scene.cameraPreset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm;

  // Always derive original (zero-movement) optics from the scene preset
  const originalOptics = useMemo(() => {
    if (!hasCapabilities) return null;
    const cameraState: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...scene.cameraPreset,
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      cameraBodyPitchDeg: 0,
      activeSceneId: scene.id,
    };
    return deriveOpticsState(cameraState, scene);
  }, [hasCapabilities, scene]);

  if (!hasCapabilities || !originalOptics) return null;

  return scene.cameraBodyPitchCapability?.enabled ? (
    <group name="original-ghost-camera">
      <CameraBodyAssembly
        opticsState={originalOptics}
        ghost
        aperture={originalAperture}
        focalLengthMm={originalFocalLengthMm}
      />
    </group>
  ) : (
    <ConceptualViewCamera
      opticsState={originalOptics}
      variant="ghost"
      coordinateSpace="world"
      aperture={originalAperture}
      focalLengthMm={originalFocalLengthMm}
    />
  );
};

export const SceneRenderer = ({
  scene,
  opticsState,
  attempt,
  showFocusPlaneOverlay,
  showDofOverlay,
  showLegends,
  showOpticalGeometry,
  showScheimpflugConstruction,
  renderQuality,
  viewResetNonce,
  viewFocus,
  observerViews,
  simulateAssetFailure,
  onAssetError,
  containerStyle,
  cameraPresentation,
}: SceneRendererProps) => {
  const { t } = useTranslation();
  const activeFocalLengthMm = useAppStore((state) => state.camera.focalLengthMm);
  const activeAperture = useAppStore((state) => state.camera.aperture);
  const configuredTargetRegion = useAppStore((state) => state.scene.targetRegion);
  const effectiveCameraMovementCalibration = useAppStore(
    selectEffectiveCameraMovementCalibration,
  );
  const interactiveLatticeRuntimeInfo = useAppStore(
    (state) => state.interactiveLatticeRuntimeInfo,
  );
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [loadLazyAssets, setLoadLazyAssets] = useState(false);
  const qualityConfig = useMemo(() => getRenderQualitySettings(renderQuality), [renderQuality]);
  const cameraMovementRenderModel = resolveCameraMovementLatticeRenderModel(
    effectiveCameraMovementCalibration,
  );
  const renderScene = useMemo(
    () =>
      scene.id === "understanding-camera-movements"
        ? {
            ...scene,
            bounds: cameraMovementRenderModel.subjectBounds,
          }
        : scene,
    [cameraMovementRenderModel, scene],
  );
  const observerCameraPosition = observerViews[viewFocus].position;
  const [observerViewState, setObserverViewState] = useState<ObserverViewState>(
    () => observerViews[viewFocus],
  );
  const activeAssets = useMemo(
    () =>
      scene.assets.filter((asset) =>
        loadLazyAssets ? true : asset.loadStrategy !== "lazy",
      ),
    [loadLazyAssets, scene.assets],
  );

  useEffect(() => {
    setLoadLazyAssets(false);
    const timer = setTimeout(() => setLoadLazyAssets(true), 0);
    return () => clearTimeout(timer);
  }, [scene.id]);

  useEffect(() => {
    if (simulateAssetFailure && attempt === 0) {
      onAssetError(`${t(simulatorMessageKeys.viewport.sceneAssetLoadFailedPrefix)} ${scene.id}.`);
    }
  }, [attempt, onAssetError, scene.id, simulateAssetFailure, t]);

  const defaultContainerStyle: React.CSSProperties = { height: 320, border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [legendPositions, setLegendPositions] = useState<Record<string, { left: number; top: number; visible: boolean; corner?: boolean }>>({});
  // legends and optical geometry controlled by parent (SceneViewport)
  // showLegends and showOpticalGeometry are received as props

  // ensure the wrapper is positioned so absolute children (legends, button) are positioned relative to it
  const wrapperStyle: React.CSSProperties = containerStyle
    ? { ...containerStyle, position: (containerStyle as React.CSSProperties).position ?? "relative" }
    : { ...defaultContainerStyle, position: "relative" };

  // If assets failed to load, don't render the canvas content. This return must come after hooks to satisfy hook rules.
  if (simulateAssetFailure && attempt === 0) {
    return null;
  }

  // compute legend visibility keys based on parent-controlled overlay states
  const visibleLegendKeys = getVisibleSceneLegendKeys({
    showFocusPlane: Boolean(showFocusPlaneOverlay),
    showDofRegion: Boolean(showDofOverlay),
    showOpticalGeometry: Boolean(showOpticalGeometry),
    isInfinityFocus: Boolean(opticsState.diagnostics.isInfinityFocus),
    hasFiniteFarPlane: Boolean(opticsState.depthOfFieldFarPlane),
  });
  const overlayBounds = getScenePlaneOverlayBounds(renderScene);
  const focusOverlayVertexCount = opticsState.focusPlane
    ? createScenePlaneOverlayGeometry(opticsState.focusPlane, overlayBounds, { extendToPlanePoint: scene.id !== "table-tilt" })?.verticesMm.length ?? 0
    : 0;
  const nearDofOverlayVertexCount = opticsState.depthOfFieldNearPlane
    ? createScenePlaneOverlayGeometry(opticsState.depthOfFieldNearPlane, overlayBounds, { extendToPlanePoint: scene.id !== "table-tilt" })?.verticesMm.length ?? 0
    : 0;
  const farDofOverlayVertexCount = opticsState.depthOfFieldFarPlane
    ? createScenePlaneOverlayGeometry(opticsState.depthOfFieldFarPlane, overlayBounds, { extendToPlanePoint: scene.id !== "table-tilt" })?.verticesMm.length ?? 0
    : 0;
  const scheimpflugConstructionGeometry = showScheimpflugConstruction
    ? createScheimpflugConstructionGeometry(opticsState, renderScene)
    : null;
  const subjectRegistration = getSceneSubjectRegistration(scene.id);
  const focusFundamentalsReferenceOptics = scene.id === "focus-fundamentals-two-targets"
    ? deriveFocusFundamentalsReferenceOptics(opticsState, scene, activeFocalLengthMm)
    : null;
  const focusFundamentalsTeachingCue = focusFundamentalsReferenceOptics
    ? resolveFocusFundamentalsTeachingCue(opticsState, focusFundamentalsReferenceOptics)
    : null;
  const referenceCameraVisible = shouldRenderReferenceCamera(
    renderScene,
    cameraMovementRenderModel,
  );

  return (
    <div
      ref={containerRef}
      data-testid="scene-canvas"
      data-scene-subject-id={getRegisteredSceneSubject(scene.id) ? scene.id : "fallback"}
      data-lattice-edge-count={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.edgeCount
          : subjectRegistration?.canonicalLattice?.edgeCount
      }
      data-lattice-target-region={
        subjectRegistration?.canonicalLattice ? configuredTargetRegion : undefined
      }
      data-mounted-lattice={
        scene.id === "understanding-camera-movements"
          ? String(interactiveLatticeRuntimeInfo?.mounted === true)
          : undefined
      }
      data-mounted-lattice-geometry-id={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.geometryId
          : undefined
      }
      data-mounted-lattice-geometry-key={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.geometryKey
          : undefined
      }
      data-mounted-lattice-presentation-key={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.presentationKey
          : undefined
      }
      data-mounted-lattice-resource-key={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.resourceKey
          : undefined
      }
      data-mounted-lattice-edge-count={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.edgeCount
          : undefined
      }
      data-mounted-lattice-presentation-region={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.presentationRegion
          : undefined
      }
      data-mounted-lattice-generation={
        scene.id === "understanding-camera-movements"
          ? interactiveLatticeRuntimeInfo?.generation
          : undefined
      }
      data-reference-camera-visible={String(referenceCameraVisible)}
      data-focus-overlay-vertices={focusOverlayVertexCount}
      data-near-dof-overlay-vertices={nearDofOverlayVertexCount}
      data-far-dof-overlay-vertices={farDofOverlayVertexCount}
      data-dof-overlay-visible={showDofOverlay ? "true" : "false"}
      data-focus-overlay-visible={showFocusPlaneOverlay && !showScheimpflugConstruction ? "true" : "false"}
      data-optical-geometry-visible={showOpticalGeometry ? "true" : "false"}
      data-scheimpflug-construction={
        scheimpflugConstructionGeometry ? "true" : "false"
      }
      data-scheimpflug-film-vertices={scheimpflugConstructionGeometry?.filmPlane.verticesMm.length ?? 0}
      data-scheimpflug-lens-vertices={scheimpflugConstructionGeometry?.lensPlane.verticesMm.length ?? 0}
      data-scheimpflug-focus-vertices={scheimpflugConstructionGeometry?.focusPlane.verticesMm.length ?? 0}
      data-scheimpflug-line-points={scheimpflugConstructionGeometry ? 2 : 0}
      data-lens-plane-normal={`${opticsState.lensPlane.normal.x.toFixed(6)},${opticsState.lensPlane.normal.y.toFixed(6)},${opticsState.lensPlane.normal.z.toFixed(6)}`}
      data-camera-rig-origin={serializeFiniteRenderVector(
        opticsState.cameraRigTransform.rigOriginWorld,
      )}
      data-camera-rig-placement-kind={opticsState.cameraRigPlacement.kind}
      data-camera-rig-anchor={
        opticsState.cameraRigPlacement.kind === "arc-anchor"
          ? opticsState.cameraRigPlacement.anchor
          : undefined
      }
      data-camera-rig-base-pitch-deg={serializeFiniteRenderNumber(
        opticsState.cameraRigTransform.basePitchDeg,
      )}
      data-camera-body-pitch-deg={serializeFiniteRenderNumber(
        opticsState.cameraRigTransform.bodyPitchDeg,
      )}
      data-camera-body-pivot-world={serializeFiniteRenderVector(
        opticsState.cameraBodyPivotWorld,
      )}
      data-camera-lens-center-world={serializeFiniteRenderVector(
        opticsState.lensCenterWorld,
      )}
      data-camera-film-center-world={serializeFiniteRenderVector(
        opticsState.filmCenterWorld,
      )}
      data-focus-standard-selected={
        opticsState.diagnostics.requestedFocusStandard ?? opticsState.diagnostics.focusStandard
      }
      data-focus-standard-resolved={opticsState.diagnostics.focusStandard}
      data-focus-teaching-active-standard={focusFundamentalsTeachingCue?.activeStandard}
      data-focus-teaching-current-position={
        focusFundamentalsTeachingCue
          ? serializeFiniteRenderVector(focusFundamentalsTeachingCue.currentPosition)
          : undefined
      }
      data-focus-teaching-reference-position={
        focusFundamentalsTeachingCue
          ? serializeFiniteRenderVector(focusFundamentalsTeachingCue.referencePosition)
          : undefined
      }
      data-focus-teaching-signed-movement-mm={
        focusFundamentalsTeachingCue
          ? serializeFiniteRenderNumber(focusFundamentalsTeachingCue.signedMovementMm)
          : undefined
      }
      data-focus-teaching-displacement-mm={
        focusFundamentalsTeachingCue
          ? serializeFiniteRenderNumber(focusFundamentalsTeachingCue.distanceMm)
          : undefined
      }
      data-focus-teaching-movement-visible={
        focusFundamentalsTeachingCue
          ? String(focusFundamentalsTeachingCue.distanceMm > 0.5)
          : undefined
      }
      data-optics-fallback-applied={String(opticsState.diagnostics.fallbackApplied)}
      data-optics-fallback-reason={opticsState.diagnostics.fallbackReason ?? undefined}
      data-view-focus={viewFocus}
      data-orbit-target={observerViewState.target.map((value) => value.toFixed(6)).join(",")}
      data-observer-camera-position={observerViewState.position.map((value) => value.toFixed(6)).join(",")}
      style={wrapperStyle}
    >
      <Canvas
        style={{ width: "100%", height: "100%" }}
        dpr={qualityConfig.dpr}
        camera={{ position: observerCameraPosition, fov: 45, near: 0.01, far: 200 }}
        gl={{ antialias: qualityConfig.antialias }}
      >
        {/* LegendUpdater runs inside the r3f context so it can access camera and gl */}
        {/**/}
        <LegendUpdater containerRef={containerRef} opticsState={opticsState} setLegendPositions={setLegendPositions} visibleKeys={visibleLegendKeys} showLegends={showLegends} />
        <SceneContent
          scene={{ ...renderScene, assets: activeAssets }}
          cameraMovementRenderModel={cameraMovementRenderModel}
          opticsState={opticsState}
          showFocusPlaneOverlay={showFocusPlaneOverlay}
          showDofOverlay={showDofOverlay}
          showOpticalGeometry={Boolean(showOpticalGeometry)}
          showScheimpflugConstruction={Boolean(showScheimpflugConstruction)}
          focusFocalLengthMm={activeFocalLengthMm}
          activeAperture={activeAperture}
          cameraPresentation={cameraPresentation}
        />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom
          enableRotate
          sceneId={scene.id}
          viewFocus={viewFocus}
          sceneView={observerViews.scene}
          cameraView={observerViews.camera}
          viewResetNonce={viewResetNonce}
          onViewStateChange={setObserverViewState}
        />
      </Canvas>

      {/* Legends overlay stuck to elements */}
      {showLegends && Object.entries(legendPositions).filter(([k]) => visibleLegendKeys.includes(k)).map(([key, pos]) =>
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
            {renderLegendText(key, t)}
          </div>
        ) : null,
      )}

    </div>
  );
};
