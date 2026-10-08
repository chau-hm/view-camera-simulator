import * as THREE from "three";
import {
  deriveOrthonormalPlaneBasis,
  computePhysicalBlurFootprint,
} from "../../../core/optics/computePhysicalBlurFootprint";
import { calculateGroundGlassCoverageGain } from "../../../core/optics/groundGlassCoverage";
import { calculateGroundGlassNaturalIlluminationGain } from "../../../core/optics/groundGlassNaturalIllumination";
import { deriveOpticsState } from "../../../core/optics/deriveOpticsState";
import { resolveGroundGlassRelativeIlluminance } from "../../../core/optics/groundGlassIlluminance";
import { GROUND_GLASS_PASS_ORDER } from "../../../render/groundGlassPassGraph";
import {
  createGroundGlassCocTarget,
  resolveGroundGlassCocStorageMaxMm,
} from "../../../render/groundGlassCocTarget";
import {
  groundGlassApertureGatherFragmentShader,
  groundGlassApparentWorldPositionCocFragmentShader,
  groundGlassCompositeFragmentShader,
  groundGlassVertexShader,
} from "../../../render/groundGlassDofShaderSources";
import { groundGlassSharedGlsl, groundGlassUniformDecls } from "../../../render/groundGlassDofShaders";
import {
  createGroundGlassDofRenderState,
  type GroundGlassDofRenderState,
} from "../../../render/groundGlassDofRenderState";
import type { GroundGlassPhysicalRenderState } from "../../../render/groundGlassPhysicalRenderState";
import {
  bindGroundGlassDofStateToApparentWorldPositionCocMaterial,
  bindGroundGlassDofStateToGatherMaterial,
  bindGroundGlassPhysicalStateToComposite,
} from "../../../render/groundGlassShaderBindings";
import {
  resolveGroundGlassRadianceContributions,
} from "../../../render/groundGlassRadianceContribution";
import { resolveGroundGlassCoverageRenderState } from "../../../render/groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationRenderState } from "../../../render/groundGlassNaturalIllumination";
import {
  configureGroundGlassCamera,
  readGroundGlassCameraPose,
} from "../../../render/configureGroundGlassCamera";
import { getGroundGlassClipRangeWorld } from "../../../render/groundGlassRttScenes";
import { resolveGroundGlassDisplayOpticsState, getGroundGlassDofVisualSettings } from "../../../render/groundGlassVisualSettings";
import { getRenderQualitySettings } from "../../../render/renderQuality";
import { resolveGroundGlassRttDisplayTransform } from "../../../render/groundGlassRttOrientation";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  resolveSampledFilmDimensionsMm,
} from "../../../render/groundGlassInspectionWindow";
import { createPresentationLightingRig, disposePresentationLightingRig } from "../../../render/TeachingLighting";
import { resolveScenePresentationLighting } from "../../../render/presentationLighting";
import { createWorldIlluminationRig, disposeWorldIlluminationRig } from "../../../render/worldIlluminationRig";
import { createWorldEnvironmentRig, disposeWorldEnvironmentRig } from "../../../render/worldEnvironmentRig";
import { resolveSceneWorldIllumination } from "../../../scenes/illumination/sceneWorldIllumination";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../../scenes/presentation/understandingCameraMovements";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../../scenes/presentation/architectureRise";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import { createArchitectureRiseGroup, disposeArchitectureRiseGroup } from "../../../render/ArchitectureRiseSubjectFactory";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS, DEFAULT_CAMERA_STATE } from "../../../utils/constants";
import { roundToStep } from "../../../utils/roundToStep";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";
import type { DerivedOpticsState } from "../../../types/optics";
import { getGroundGlassSceneProfile } from "../../../render/groundGlassSceneProfiles";
import { vecToWorld } from "../../../render/rttUtils";

const WIDTH = 768;
const HEIGHT = 614;
const REFLECTION_WEIGHT = 0.18;
const SKY_COLOR = new THREE.Color("#dfe5ec");
const TARGET_PANE_NAME = "architecture-rise-facade-window-bay-bay-2-1-glazing";
const TARGET_FACE_NAME = "architecture-rise-street-sign-face-back";
const PANE_U = 0.3;
const PANE_V = 0.3;
const FOCUS_CASES = {
  paneFocus: architectureRiseScene.cameraPreset.focusDistanceMm ?? 8_890,
} as const;

type FocusCaseId = "paneFocus" | "reflectionFocus";
type PointTuple = readonly [number, number, number];
type CpuFootprint = ReturnType<typeof computePhysicalBlurFootprint>;
type FloatTarget = THREE.WebGLRenderTarget;

type FocusCaseMeasurement = {
  focusDistanceMm: number;
  sourcePixel: { x: number; yBottom: number };
  cpu: {
    reflectedCoC: CoCMeasurement;
    directCoC: CoCMeasurement;
  };
  gpu: {
    reflectedCoC: CoCMeasurement;
    directCoC: CoCMeasurement;
    directFocusedRgb: PointTuple;
    reflectedFocusedRgb: PointTuple;
    combinedLinearRgb: PointTuple;
    maxLinearSumDifference: number;
    finalDisplayRgba: readonly [number, number, number, number];
  };
  reflectedSignSharpness: {
    crop: { minX: number; minYBottom: number; maxX: number; maxYBottom: number };
    edgeGradientEnergy: number;
    sampleCount: number;
  };
  reflectionSourceHash: string;
  reflectionOnlyHash: string;
  combinedDisplayHash: string;
};

type CoCMeasurement = {
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  minorRadiusMm: number;
  orientationRad: number;
  storageFormat: "half-float-mm" | "encoded-byte";
  storageToleranceMm: number;
  absoluteCpuDifferenceMm: number;
};

type ResourceDisposalCounts = {
  owned: number;
  disposed: number;
  duplicateDisposeEvents: number;
};

type ResourceLifecycleCounts = {
  renderTargets: ResourceDisposalCounts;
  textures: ResourceDisposalCounts;
  materials: ResourceDisposalCounts;
  geometries: ResourceDisposalCounts;
  customDisposers: { registered: number; invoked: number };
};

type ResourceLifecycleEvidence = ResourceLifecycleCounts & {
  rendererDisposeCalled: boolean;
};

type BackendCapability = {
  renderer: string;
  webgl2: boolean;
  webglVersion: string;
  extensionName: string;
  extensionSupported: boolean;
  float32FramebufferComplete: boolean;
  float32FramebufferStatus: string;
  float32ReadbackWorks: boolean;
  readbackArrayType: "Float32Array";
  floatProbeValue: number;
  floatLinearFilteringSupported: boolean;
  radianceFilter: "LinearFilter" | "NearestFilter";
};

type PlanarProof = {
  baseSha: string;
  backend: BackendCapability;
  sample: {
    pane: string;
    uv: { u: number; v: number };
    panePoint: PointTuple;
    normal: PointTuple;
    reflectedPoint: PointTuple;
    virtualPoint: PointTuple;
    sourcePixel: { x: number; yBottom: number };
    reflectedUv: { x: number; y: number; z: number };
    reflectedPixel: { x: number; yBottom: number };
    paneMaskActive: boolean;
    paneWorldPosition: PointTuple;
    directWorldPosition: PointTuple;
    reflectionObject: string;
    cpuQ: PointTuple;
    gpuQ: PointTuple;
    cpuQVirtual: PointTuple;
    gpuQVirtual: PointTuple;
    gpuQInsideSignFace: boolean;
    gpuQDistanceFromCpuM: number;
    gpuQVirtualDistanceFromCpuM: number;
    reflectedRadiance: PointTuple;
    euclideanGeometricRangeMm: number;
    gpuGeometricRangeMm: number;
    opticalAxisFocusDistanceMm: number;
    roundedReflectionFocusMm: number;
    reflectionCameraPosition: PointTuple;
    reflectionCameraForward: PointTuple;
  };
  groundGlassCamera: {
    pose: ReturnType<typeof readGroundGlassCameraPose>;
    lensCenterWorldM: PointTuple;
    opticalAxisOriginWorldM: PointTuple;
    opticalAxisDirection: PointTuple;
    projectionMatrix: readonly number[];
    frustum: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      near: number;
      far: number;
      determinant: number;
    };
  };
  contributionContract: {
    directId: string;
    reflectedId: string;
    radianceSemantics: "preweighted-linear-radiance";
    resolvedContributionCount: number;
    gatherVisibility: { dimensions: readonly [number, number]; purpose: "visibility-only"; neutral: true };
  };
  directViewSafety: {
    paneFirstHit: string;
    directRayHitsStreetSign: boolean;
    paneToQFirstHit: string;
    paneToQPathClear: boolean;
  };
  cases: Record<FocusCaseId, FocusCaseMeasurement>;
  sharedFilmEffects: {
    namedSample: {
      coverageActive: boolean;
      coverageGain: number;
      naturalIlluminationGain: number;
      relativeIlluminanceGain: number;
      sourceFilmPointMm: readonly [number, number];
      displayTransform: { flipDisplayX: boolean; flipDisplayY: boolean };
    };
    sharedCompositePasses: number;
  };
  resources: {
    resolution: readonly [number, number];
    targetCount: number;
    sceneRadianceTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; colorSpace: string; toneMapping: string };
    worldPositionTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; colorSpace: string; filter: string };
    paneMaskTarget: { dimensions: readonly [number, number]; format: string; type: string };
    paneWorldPositionTarget: { dimensions: readonly [number, number]; format: string; type: string };
    visibilityDepthInput: { dimensions: readonly [number, number]; format: string; type: string };
    resolvedRadianceTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; filter: string };
    directContributionRadianceTarget: { dimensions: readonly [number, number]; format: string; type: string; filter: string };
    apparentPositionTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string };
    cocTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; storageFormat: string };
    gatherTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; filter: string };
    focusedTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string; filter: string };
    combinedRadianceTarget: { dimensions: readonly [number, number]; format: string; type: string; colorSpace: string; toneMapping: string };
    finalDisplayTarget: { dimensions: readonly [number, number]; format: string; type: string };
    nominalTexelPayloadBytes: number;
    passCounts: {
      directSceneRenders: number;
      planarReflectionSceneRenders: number;
      worldPositionSceneRenders: number;
      paneMaskRenders: number;
      fullScreenMappingResolves: number;
      radianceValidityMaskPasses: number;
      cocPasses: number;
      cocDecodeDiagnostics: number;
      gatherPasses: number;
      focusResolvePasses: number;
      linearRadianceSums: number;
      sharedCompositePasses: number;
    };
    rendererTextureCountBeforeDispose: number;
    invalidPositionRadianceViolations: number;
    lifecycle: ResourceLifecycleEvidence;
  };
  production: {
    passOrder: readonly string[];
  };
  fixtureConfiguration: {
    reflectionWeight: number;
  };
  planarCapture: {
    cameraSideClippingPassed: boolean;
  };
};

declare global {
  interface Window {
    __architectureRisePlanarFocusProof?: PlanarProof & { showCase: (id: FocusCaseId) => void };
  }
}

type OwnedBundle = {
  targets: THREE.WebGLRenderTarget[];
  textures: THREE.Texture[];
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  disposers: Array<() => void>;
  lifecycle: ResourceLifecycleCounts;
  trackResource: (
    resource: THREE.WebGLRenderTarget | THREE.Texture | THREE.Material | THREE.BufferGeometry,
    category: "renderTargets" | "textures" | "materials" | "geometries",
  ) => void;
  dispose: () => void;
};

const makeOwnedBundle = (): OwnedBundle => {
  const lifecycle: ResourceLifecycleCounts = {
    renderTargets: { owned: 0, disposed: 0, duplicateDisposeEvents: 0 },
    textures: { owned: 0, disposed: 0, duplicateDisposeEvents: 0 },
    materials: { owned: 0, disposed: 0, duplicateDisposeEvents: 0 },
    geometries: { owned: 0, disposed: 0, duplicateDisposeEvents: 0 },
    customDisposers: { registered: 0, invoked: 0 },
  };
  const trackedResources = new WeakSet<object>();
  const bundle: OwnedBundle = {
    targets: [],
    textures: [],
    materials: [],
    geometries: [],
    disposers: [],
    lifecycle,
    trackResource: (resource, category) => {
      if (trackedResources.has(resource)) return;
      trackedResources.add(resource);
      const counts = lifecycle[category];
      counts.owned += 1;
      let disposeEvents = 0;
      const eventSource = resource as unknown as {
        addEventListener: (type: "dispose", listener: () => void) => void;
      };
      eventSource.addEventListener("dispose", () => {
        disposeEvents += 1;
        counts.disposed += 1;
        if (disposeEvents > 1) counts.duplicateDisposeEvents += 1;
      });
    },
    dispose: () => {
      const errors: unknown[] = [];
      const attemptAll = <T>(resources: readonly T[], dispose: (resource: T) => void): void => {
        resources.forEach((resource) => {
          try {
            dispose(resource);
          } catch (error) {
            errors.push(error);
          }
        });
      };
      bundle.materials.forEach((resource) => bundle.trackResource(resource, "materials"));
      bundle.targets.forEach((resource) => bundle.trackResource(resource, "renderTargets"));
      bundle.textures.forEach((resource) => bundle.trackResource(resource, "textures"));
      bundle.geometries.forEach((resource) => bundle.trackResource(resource, "geometries"));
      lifecycle.customDisposers.registered = bundle.disposers.length;
      attemptAll(bundle.disposers, (dispose) => {
        lifecycle.customDisposers.invoked += 1;
        dispose();
      });
      attemptAll(bundle.materials, (resource) => resource.dispose());
      attemptAll(bundle.targets, (resource) => resource.dispose());
      attemptAll(bundle.textures, (resource) => resource.dispose());
      attemptAll(bundle.geometries, (resource) => resource.dispose());
      if (errors.length > 0) {
        throw new AggregateError(errors, "One or more Planar fixture resources failed to dispose");
      }
    },
  };
  return bundle;
};

const registerOwnedTarget = (
  bundle: OwnedBundle,
  target: THREE.WebGLRenderTarget,
  disposeWithBundle = true,
): THREE.WebGLRenderTarget => {
  if (disposeWithBundle) bundle.targets.push(target);
  bundle.trackResource(target, "renderTargets");
  return target;
};

const registerOwnedMaterials = (bundle: OwnedBundle, ...materials: THREE.Material[]): void => {
  materials.forEach((resource) => {
    bundle.materials.push(resource);
    bundle.trackResource(resource, "materials");
  });
};

const lifecycleEvidence = (bundle: OwnedBundle, rendererDisposeCalled: boolean): ResourceLifecycleEvidence => ({
  renderTargets: { ...bundle.lifecycle.renderTargets },
  textures: { ...bundle.lifecycle.textures },
  materials: { ...bundle.lifecycle.materials },
  geometries: { ...bundle.lifecycle.geometries },
  customDisposers: { ...bundle.lifecycle.customDisposers },
  rendererDisposeCalled,
});

const makeTarget = (
  bundle: OwnedBundle,
  width: number,
  height: number,
  options: {
    type?: THREE.TextureDataType;
    filter?: THREE.MagnificationTextureFilter;
    depthBuffer?: boolean;
  } = {},
): THREE.WebGLRenderTarget => {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: options.type ?? THREE.FloatType,
    minFilter: options.filter ?? THREE.NearestFilter,
    magFilter: options.filter ?? THREE.NearestFilter,
    depthBuffer: options.depthBuffer ?? false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return registerOwnedTarget(bundle, target);
};

const verifyFloatTargetCapability = (
  renderer: THREE.WebGLRenderer,
  bundle: OwnedBundle,
  quadScene: THREE.Scene,
  quadCamera: THREE.OrthographicCamera,
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>,
): BackendCapability => {
  const gl = renderer.getContext();
  const extensionName = "EXT_color_buffer_float";
  const extensionSupported = Boolean(gl.getExtension(extensionName));
  if (!renderer.capabilities.isWebGL2 || !extensionSupported) {
    throw new Error(
      `Planar float radiance/position proof requires WebGL2 and ${extensionName}; ` +
      `webgl2=${renderer.capabilities.isWebGL2}, extension=${extensionSupported}`,
    );
  }

  const statusTarget = renderer.getRenderTarget();
  const target = new THREE.WebGLRenderTarget(2, 2, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  registerOwnedTarget(bundle, target, false);
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  let framebufferStatus = "not-checked";
  let capability: BackendCapability | null = null;
  let proofFailed = false;
  let proofError: unknown;
  const cleanupErrors: unknown[] = [];
  try {
    renderer.setRenderTarget(target);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    framebufferStatus = `0x${status.toString(16)}`;
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Float32 diagnostic framebuffer is incomplete (${framebufferStatus})`);
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: groundGlassVertexShader,
      fragmentShader: "precision highp float; void main(){ gl_FragColor = vec4(1.25, 0.5, 0.25, 1.0); }",
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    registerOwnedMaterials(bundle, material);
    quad.material = material;
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(quadScene, quadCamera);
    const readback = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, readback);
    const floatProbeValue = readback[0];
    if (!Number.isFinite(floatProbeValue) || Math.abs(floatProbeValue - 1.25) > 1e-5) {
      throw new Error(`Float32 readback did not preserve 1.25 (read ${floatProbeValue})`);
    }
    const floatLinearFilteringSupported = Boolean(gl.getExtension("OES_texture_float_linear"));
    capability = {
      renderer: renderer.info.programs ? "Three.js WebGLRenderer" : "Three.js WebGLRenderer",
      webgl2: renderer.capabilities.isWebGL2,
      webglVersion: String(gl.getParameter(gl.VERSION)),
      extensionName,
      extensionSupported,
      float32FramebufferComplete: true,
      float32FramebufferStatus: framebufferStatus,
      float32ReadbackWorks: true,
      readbackArrayType: "Float32Array",
      floatProbeValue,
      floatLinearFilteringSupported,
      radianceFilter: floatLinearFilteringSupported ? "LinearFilter" : "NearestFilter",
    };
  } catch (error) {
    proofFailed = true;
    proofError = error;
  } finally {
    try {
      renderer.setRenderTarget(statusTarget);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      target.dispose();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (proofFailed || cleanupErrors.length > 0) {
    const errors = proofFailed ? [proofError, ...cleanupErrors] : cleanupErrors;
    throw new AggregateError(errors, "Float32 capability check or target cleanup failed");
  }
  if (!capability) throw new Error("Float32 capability check produced no evidence");
  return capability;
};

const pointToTuple = (point: { x: number; y: number; z: number }): PointTuple => [point.x, point.y, point.z];

const findMesh = (root: THREE.Object3D, name: string): THREE.Mesh => {
  const object = root.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Required Architecture Rise mesh is missing: ${name}`);
  return object;
};

const getSignSample = (
  root: THREE.Group,
  pane: THREE.Mesh,
  lensOrigin: THREE.Vector3,
) => {
  root.updateMatrixWorld(true);
  pane.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(pane);
  const expectedPoint = new THREE.Vector3(
    bounds.min.x + PANE_U * (bounds.max.x - bounds.min.x),
    bounds.min.y + PANE_V * (bounds.max.y - bounds.min.y),
    bounds.min.z,
  );
  const paneRay = new THREE.Raycaster(lensOrigin, expectedPoint.clone().sub(lensOrigin).normalize());
  const paneHit = paneRay.intersectObject(pane, false)[0];
  if (!paneHit?.face) throw new Error("Known pane geometry sample did not hit the real glazing mesh");
  const normal = paneHit.face.normal.clone().applyMatrix3(
    new THREE.Matrix3().getNormalMatrix(pane.matrixWorld),
  ).normalize();
  const incident = paneHit.point.clone().sub(lensOrigin).normalize();
  const reflected = incident.clone().reflect(normal).normalize();
  const sceneMeshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object !== pane) sceneMeshes.push(object);
  });
  const hitRay = new THREE.Raycaster(paneHit.point.clone().addScaledVector(reflected, 0.12), reflected);
  hitRay.near = 0;
  hitRay.far = 100;
  const reflectedHit = hitRay.intersectObjects(sceneMeshes, false)[0];
  if (!reflectedHit) throw new Error("Known pane reflection ray missed the current Architecture Rise scene");
  if (reflectedHit.object.name !== TARGET_FACE_NAME) {
    throw new Error(`Known pane ray hit ${reflectedHit.object.name}, expected ${TARGET_FACE_NAME}`);
  }
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, paneHit.point);
  const virtualPoint = reflectedHit.point.clone().addScaledVector(
    normal,
    -2 * plane.distanceToPoint(reflectedHit.point),
  );
  return {
    panePoint: paneHit.point.clone(),
    normal,
    reflectedDirection: reflected,
    realPoint: reflectedHit.point.clone(),
    virtualPoint,
    plane,
    faceName: reflectedHit.object.name,
  };
};

const focusCameraState = (focusDistanceMm: number) => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  activeTaskId: null,
  mode: "free" as const,
  focusDistanceMm,
});

const makeConfiguredGroundGlassCamera = (focusDistanceMm: number) => {
  const optics = deriveOpticsState(focusCameraState(focusDistanceMm), architectureRiseScene);
  const camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.01, 100);
  const clip = getGroundGlassClipRangeWorld(
    architectureRiseScene,
    optics.lensCenterWorld,
    optics.opticalAxis.direction,
  );
  camera.near = clip.near;
  camera.far = clip.far;
  camera.updateProjectionMatrix();
  const config = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
  if (!config.ok) throw new Error(`Production Ground Glass camera setup failed: ${config.reason}`);
  return { camera, optics, clip, config };
};

const physicalFootprintAt = (optics: DerivedOpticsState, pointWorldM: THREE.Vector3): CpuFootprint => {
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    optics.filmPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  if (!lensBasis || !filmBasis) throw new Error("Architecture Rise CPU focus basis is degenerate");
  return computePhysicalBlurFootprint({
    objectPoint: { x: pointWorldM.x * 1000, y: pointWorldM.y * 1000, z: pointWorldM.z * 1000 },
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: lensBasis.normal,
    lensPlaneBasisX: lensBasis.x,
    lensPlaneBasisY: lensBasis.y,
    filmPlane: optics.filmPlane,
    filmPlaneBasisX: filmBasis.x,
    filmPlaneBasisY: filmBasis.y,
    focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
    apertureFNumber: architectureRiseScene.cameraPreset.aperture ?? DEFAULT_CAMERA_STATE.aperture,
  });
};

const reflectVectorAcrossPlane = (vector: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 =>
  vector.clone().addScaledVector(normal, -2 * vector.dot(normal));

const makePlanarReflectionCamera = (
  source: THREE.PerspectiveCamera,
  plane: THREE.Plane,
): THREE.PerspectiveCamera => {
  source.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, source.near, source.far);
  const sourcePosition = source.getWorldPosition(new THREE.Vector3());
  const sourceForward = source.getWorldDirection(new THREE.Vector3()).normalize();
  const sourceUp = new THREE.Vector3(0, 1, 0).applyQuaternion(source.quaternion).normalize();
  const reflectedPosition = sourcePosition.clone().addScaledVector(
    plane.normal,
    -2 * plane.distanceToPoint(sourcePosition),
  );
  const reflectedForward = reflectVectorAcrossPlane(sourceForward, plane.normal).normalize();
  const reflectedUp = reflectVectorAcrossPlane(sourceUp, plane.normal).normalize();
  camera.position.copy(reflectedPosition);
  camera.up.copy(reflectedUp);
  camera.lookAt(reflectedPosition.clone().add(reflectedForward));
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  camera.projectionMatrix.copy(source.projectionMatrix);
  camera.projectionMatrixInverse.copy(source.projectionMatrixInverse);
  if (camera.getWorldDirection(new THREE.Vector3()).dot(reflectedForward) < 0.99999) {
    throw new Error("Planar camera orientation does not match the geometrically reflected Ground Glass view");
  }
  const reflectedCameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  if (reflectedCameraUp.dot(reflectedUp) < 0.99999) {
    throw new Error("Planar camera up orientation did not follow the reflected production camera pose");
  }
  return camera;
};

type ContributionLayer = {
  cocTarget: THREE.WebGLRenderTarget;
  cocStorageFormat: "half-float-mm" | "encoded-byte";
  cocMaterial: THREE.ShaderMaterial;
  farTarget: THREE.WebGLRenderTarget;
  nearTarget: THREE.WebGLRenderTarget;
  gatherMaterial: THREE.ShaderMaterial;
  focusedTarget: THREE.WebGLRenderTarget;
  resolveMaterial: THREE.ShaderMaterial;
};

type RendererStateSnapshot = {
  target: THREE.WebGLRenderTarget | null;
  viewport: THREE.Vector4;
  scissor: THREE.Vector4;
  scissorTest: boolean;
  clearColor: THREE.Color;
  clearAlpha: number;
  autoClear: boolean;
  autoClearColor: boolean;
  autoClearDepth: boolean;
  autoClearStencil: boolean;
  toneMapping: THREE.ToneMapping;
  outputColorSpace: THREE.ColorSpace;
  xrEnabled: boolean;
  localClippingEnabled: boolean;
  clippingPlanes: THREE.Plane[];
  shadowMapEnabled: boolean;
  shadowMapAutoUpdate: boolean;
};

type FocusCaseImages = {
  reflection: Uint8Array;
  focused: Uint8Array;
  combined: Uint8Array;
};

const caseImages: Partial<Record<FocusCaseId, FocusCaseImages>> = {};

const captureRendererState = (renderer: THREE.WebGLRenderer): RendererStateSnapshot => ({
  target: renderer.getRenderTarget(),
  viewport: renderer.getViewport(new THREE.Vector4()),
  scissor: renderer.getScissor(new THREE.Vector4()),
  scissorTest: renderer.getScissorTest(),
  clearColor: renderer.getClearColor(new THREE.Color()).clone(),
  clearAlpha: renderer.getClearAlpha(),
  autoClear: renderer.autoClear,
  autoClearColor: renderer.autoClearColor,
  autoClearDepth: renderer.autoClearDepth,
  autoClearStencil: renderer.autoClearStencil,
  toneMapping: renderer.toneMapping,
  outputColorSpace: renderer.outputColorSpace as THREE.ColorSpace,
  xrEnabled: renderer.xr.enabled,
  localClippingEnabled: renderer.localClippingEnabled,
  clippingPlanes: renderer.clippingPlanes.map((plane) => plane.clone()),
  shadowMapEnabled: renderer.shadowMap.enabled,
  shadowMapAutoUpdate: renderer.shadowMap.autoUpdate,
});

const restoreRendererState = (
  renderer: THREE.WebGLRenderer,
  state: RendererStateSnapshot,
): void => {
  renderer.setRenderTarget(state.target);
  renderer.setViewport(state.viewport);
  renderer.setScissor(state.scissor);
  renderer.setScissorTest(state.scissorTest);
  renderer.setClearColor(state.clearColor, state.clearAlpha);
  renderer.autoClear = state.autoClear;
  renderer.autoClearColor = state.autoClearColor;
  renderer.autoClearDepth = state.autoClearDepth;
  renderer.autoClearStencil = state.autoClearStencil;
  renderer.toneMapping = state.toneMapping;
  renderer.outputColorSpace = state.outputColorSpace;
  renderer.xr.enabled = state.xrEnabled;
  renderer.localClippingEnabled = state.localClippingEnabled;
  renderer.clippingPlanes = state.clippingPlanes;
  renderer.shadowMap.enabled = state.shadowMapEnabled;
  renderer.shadowMap.autoUpdate = state.shadowMapAutoUpdate;
};

const makeRadianceTarget = (
  bundle: OwnedBundle,
  filter: THREE.MagnificationTextureFilter,
  depthBuffer = false,
): FloatTarget => makeTarget(bundle, WIDTH, HEIGHT, {
  type: THREE.FloatType,
  filter,
  depthBuffer,
});

const makePositionTarget = (bundle: OwnedBundle, depthBuffer = false): FloatTarget =>
  makeTarget(bundle, WIDTH, HEIGHT, {
    type: THREE.FloatType,
    filter: THREE.NearestFilter,
    depthBuffer,
  });

const makeDisplayTarget = (bundle: OwnedBundle): FloatTarget =>
  makeTarget(bundle, WIDTH, HEIGHT, {
    type: THREE.UnsignedByteType,
    filter: THREE.NearestFilter,
  });

const makeDataTexture = (
  bundle: OwnedBundle,
  data: Uint8Array,
  width: number,
  height: number,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  bundle.textures.push(texture);
  return texture;
};

const makeDofUniforms = (): Record<string, THREE.IUniform> => ({
  near: { value: 0.01 },
  far: { value: 100 },
  imageDistanceMm: { value: 0 },
  focalLengthMm: { value: CAMERA_CONSTANTS.focalLengthMm },
  fNumber: { value: 11 },
  renderWidth: { value: WIDTH },
  renderHeight: { value: HEIGHT },
  useRaw: { value: 0 },
  dofMode: { value: 0 },
  lensCenterWorld: { value: new THREE.Vector3() },
  lensPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  lensPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
  lensPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
  filmPlanePoint: { value: new THREE.Vector3(0, 0, -0.1) },
  filmPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  filmPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
  filmPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
  focusPlanePoint: { value: new THREE.Vector3() },
  focusPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  nearPlanePoint: { value: new THREE.Vector3() },
  nearPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  farPlanePoint: { value: new THREE.Vector3() },
  farPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  hasFiniteFar: { value: 0 },
  inverseProjectionMatrix: { value: new THREE.Matrix4() },
  cameraMatrixWorld: { value: new THREE.Matrix4() },
  maximumCoCRadiusPx: { value: 60 },
  circleOfConfusionMm: { value: ACCEPTABLE_COC_DIAMETER_MM },
  sampledFilmWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
  sampledFilmHeightMm: { value: CAMERA_CONSTANTS.filmHeightMm },
  sampleCount: { value: 32 },
  cocStorageEncoded: { value: 0 },
  cocStorageMaxMm: { value: 1 },
  footprintStorageMaxMm: { value: 0.5 },
  gatherLayer: { value: 0 },
});

const makePositionCaptureMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vWorldPosition;
      #include <clipping_planes_pars_vertex>
      void main(){
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorldPosition;
      #include <clipping_planes_pars_fragment>
      void main(){
        #include <clipping_planes_fragment>
        gl_FragColor = vec4(vWorldPosition, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    clipping: true,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makePaneMaskPositionMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial =>
  makePositionCaptureMaterial(bundle);

const makeMappingMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tPanePosition;
      uniform sampler2D tPlanarRadiance;
      uniform sampler2D tPlanarPosition;
      uniform mat4 reflectionViewProjection;
      uniform vec3 panePointWorld;
      uniform vec3 paneNormalWorld;
      uniform float reflectionWeight;
      uniform float outputApparentPosition;
      void main(){
        vec4 pane = texture2D(tPanePosition, vUv);
        if(pane.a < 0.5){ gl_FragColor = vec4(0.0); return; }
        vec4 reflectedClip = reflectionViewProjection * vec4(pane.xyz, 1.0);
        if(reflectedClip.w <= 1e-6){ gl_FragColor = vec4(0.0); return; }
        vec3 ndc = reflectedClip.xyz / reflectedClip.w;
        vec2 reflectedUv = ndc.xy * 0.5 + 0.5;
        if(any(lessThan(reflectedUv, vec2(0.0))) || any(greaterThan(reflectedUv, vec2(1.0))) ||
           ndc.z < -1.0 || ndc.z > 1.0){ gl_FragColor = vec4(0.0); return; }
        vec4 capturedPosition = texture2D(tPlanarPosition, reflectedUv);
        if(capturedPosition.a < 0.5){ gl_FragColor = vec4(0.0); return; }
        if(outputApparentPosition > 0.5){
          vec3 fromPlane = capturedPosition.xyz - panePointWorld;
          vec3 virtualPoint = capturedPosition.xyz - 2.0 * paneNormalWorld * dot(fromPlane, paneNormalWorld);
          gl_FragColor = vec4(virtualPoint, 1.0);
        } else {
          vec3 radiance = texture2D(tPlanarRadiance, reflectedUv).rgb;
          gl_FragColor = vec4(radiance * reflectionWeight, 1.0);
        }
      }
    `,
    uniforms: {
      tPanePosition: { value: null },
      tPlanarRadiance: { value: null },
      tPlanarPosition: { value: null },
      reflectionViewProjection: { value: new THREE.Matrix4() },
      panePointWorld: { value: new THREE.Vector3() },
      paneNormalWorld: { value: new THREE.Vector3(0, 0, 1) },
      reflectionWeight: { value: REFLECTION_WEIGHT },
      outputApparentPosition: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeRadianceValidityMaskMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tRadiance;
      uniform sampler2D tWorldPosition;
      void main(){
        vec4 position = texture2D(tWorldPosition, vUv);
        if(position.a < 0.5){ gl_FragColor = vec4(0.0); return; }
        vec3 radiance = texture2D(tRadiance, vUv).rgb;
        gl_FragColor = vec4(radiance, 1.0);
      }
    `,
    uniforms: {
      tRadiance: { value: null },
      tWorldPosition: { value: null },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeLayerResolveMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tFar;
      uniform sampler2D tNear;
      void main(){
        vec4 farRadiance = texture2D(tFar, vUv);
        vec4 nearRadiance = texture2D(tNear, vUv);
        gl_FragColor = vec4(mix(farRadiance.rgb, nearRadiance.rgb, clamp(nearRadiance.a, 0.0, 1.0)), farRadiance.a);
      }
    `,
    uniforms: { tFar: { value: null }, tNear: { value: null } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeRadianceSumMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDirect;
      uniform sampler2D tReflection;
      void main(){
        vec4 direct = texture2D(tDirect, vUv);
        vec4 reflection = texture2D(tReflection, vUv);
        gl_FragColor = vec4(direct.rgb + reflection.rgb, max(direct.a, reflection.a));
      }
    `,
    uniforms: { tDirect: { value: null }, tReflection: { value: null } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeCompositeMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: groundGlassCompositeFragmentShader,
    uniforms: {
      tGather: { value: null },
      tNearGather: { value: null },
      useNearGather: { value: 0 },
      flipDisplayX: { value: 1 },
      flipDisplayY: { value: 1 },
      groundGlassIlluminanceGain: { value: 1 },
      groundGlassNaturalIlluminationEnabled: { value: 0 },
      groundGlassNaturalIlluminationImageDistanceMm: { value: 0 },
      groundGlassNaturalIlluminationOffsetXMm: { value: 0 },
      groundGlassNaturalIlluminationOffsetYMm: { value: 0 },
      groundGlassCoverageEnabled: { value: 0 },
      groundGlassCoverageMode: { value: 0 },
      groundGlassCoverageRadiusMm: { value: 0 },
      groundGlassCoverageOffsetXMm: { value: 0 },
      groundGlassCoverageOffsetYMm: { value: 0 },
      groundGlassCoverageConicQuadratic: { value: new THREE.Vector3() },
      groundGlassCoverageConicLinear: { value: new THREE.Vector3() },
      groundGlassCoverageConicAxial: { value: new THREE.Vector3() },
      groundGlassCoverageEdgeFeatherMm: { value: 0 },
      groundGlassFilmWindowCenterXMm: { value: 0 },
      groundGlassFilmWindowCenterYMm: { value: 0 },
      groundGlassFilmWindowWidthMm: { value: CAMERA_CONSTANTS.filmWidthMm },
      groundGlassFilmWindowHeightMm: { value: CAMERA_CONSTANTS.filmHeightMm },
      renderWidth: { value: WIDTH },
      renderHeight: { value: HEIGHT },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeCocDecodeMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tCoC;
      ${groundGlassUniformDecls}
      ${groundGlassSharedGlsl}
      void main(){
        vec4 stored = texture2D(tCoC, vUv);
        float coc = decodeStoredSignedCoCDiameterMm(stored.r);
        vec2 axes = decodeStoredGroundGlassFootprintAxesMm(stored.gb);
        float angle = decodeStoredGroundGlassFootprintOrientation(stored.a);
        gl_FragColor = vec4(coc, axes, angle);
      }
    `,
    uniforms: { ...makeDofUniforms(), tCoC: { value: null } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeContributionLayer = (
  renderer: THREE.WebGLRenderer,
  bundle: OwnedBundle,
  visibilityDepth: THREE.Texture,
  radianceFilter: THREE.MagnificationTextureFilter,
): ContributionLayer => {
  const coc = createGroundGlassCocTarget(renderer, WIDTH, HEIGHT);
  coc.target.texture.colorSpace = THREE.NoColorSpace;
  bundle.targets.push(coc.target);
  const cocMaterial = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: groundGlassApparentWorldPositionCocFragmentShader,
    uniforms: { ...makeDofUniforms(), tApparentWorldPosition: { value: null } },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const gatherMaterial = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: groundGlassApertureGatherFragmentShader,
    uniforms: {
      ...makeDofUniforms(),
      tColor: { value: null },
      tDepth: { value: visibilityDepth },
      tCoC: { value: null },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(cocMaterial, gatherMaterial);
  const layer = {
    cocTarget: coc.target,
    cocStorageFormat: coc.storageFormat,
    cocMaterial,
    farTarget: makeRadianceTarget(bundle, radianceFilter),
    nearTarget: makeRadianceTarget(bundle, radianceFilter),
    gatherMaterial,
    focusedTarget: makeRadianceTarget(bundle, radianceFilter),
    resolveMaterial: makeLayerResolveMaterial(bundle),
  };
  return layer;
};

const makeFullscreenScene = (bundle: OwnedBundle): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
} => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 0.5;
  camera.lookAt(0, 0, 0);
  const geometry = new THREE.PlaneGeometry(2, 2);
  bundle.geometries.push(geometry);
  const baseMaterial = new THREE.MeshBasicMaterial();
  bundle.materials.push(baseMaterial);
  const quad = new THREE.Mesh(geometry, baseMaterial);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, camera, quad: quad as THREE.Mesh<THREE.PlaneGeometry, THREE.Material> };
};

const drawFullscreen = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  material: THREE.Material,
  fullscreen: ReturnType<typeof makeFullscreenScene>,
): void => {
  renderer.clippingPlanes = [];
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  fullscreen.quad.material = material;
  renderer.render(fullscreen.scene, fullscreen.camera);
};

const renderSceneTarget = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget,
): void => {
  renderer.setRenderTarget(target);
  renderer.setClearColor(SKY_COLOR, 1);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);
};

const readFloatPixels = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
): Float32Array => {
  const pixels = new Float32Array(target.width * target.height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  return pixels;
};

const readBytePixels = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
): Uint8Array => {
  const pixels = new Uint8Array(target.width * target.height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  return pixels;
};

const pixelOffset = (x: number, yBottom: number): number => (yBottom * WIDTH + x) * 4;

const readFloatAt = (
  pixels: Float32Array,
  x: number,
  yBottom: number,
): readonly [number, number, number, number] => {
  const offset = pixelOffset(x, yBottom);
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
};

const assertInvalidRadianceIsZero = (
  positions: Float32Array,
  radiance: Float32Array,
  label: string,
): void => {
  for (let offset = 0; offset < positions.length; offset += 4) {
    if (positions[offset + 3] >= 0.5) continue;
    if (
      Math.abs(radiance[offset]) > 1e-7 ||
      Math.abs(radiance[offset + 1]) > 1e-7 ||
      Math.abs(radiance[offset + 2]) > 1e-7
    ) {
      throw new Error(`${label} has non-zero radiance where apparent position is invalid at texel ${offset / 4}`);
    }
  }
};

const toDisplayBytes = (pixels: Float32Array): Uint8Array => {
  const output = new Uint8Array(pixels.length);
  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const linear = THREE.MathUtils.clamp(pixels[index + channel], 0, 1);
      const display = linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
      output[index + channel] = Math.round(THREE.MathUtils.clamp(display, 0, 1) * 255);
    }
    output[index + 3] = Math.round(THREE.MathUtils.clamp(pixels[index + 3], 0, 1) * 255);
  }
  return output;
};

const displayBytesFromTarget = (pixels: Uint8Array): Uint8Array => {
  const output = new Uint8Array(pixels.length);
  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const linear = pixels[index + channel] / 255;
      const display = linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
      output[index + channel] = Math.round(THREE.MathUtils.clamp(display, 0, 1) * 255);
    }
    output[index + 3] = pixels[index + 3];
  }
  return output;
};

const hashDisplayPixels = (pixels: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of pixels) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const setProofImage = (canvasId: string, pixels: Uint8Array): void => {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) throw new Error(`Missing diagnostic canvas ${canvasId}`);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Missing 2D diagnostic context for ${canvasId}`);
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), WIDTH, HEIGHT), 0, 0);
};

const displayCase = (id: FocusCaseId, proof: PlanarProof): void => {
  const images = caseImages[id];
  if (!images) return;
  const button = document.querySelector<HTMLButtonElement>(`button[data-case="${id}"]`);
  const measurements = document.getElementById("measurements");
  if (!button || !measurements) return;
  document.querySelectorAll<HTMLButtonElement>("button[data-case]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  measurements.textContent = JSON.stringify({ case: id, ...proof.cases[id] }, null, 2);
  setProofImage("reflection-source", images.reflection);
  setProofImage("reflection-focused", images.focused);
  setProofImage("combined-output", images.combined);
};

const makeConfiguredDofState = (
  camera: THREE.PerspectiveCamera,
  optics: DerivedOpticsState,
): GroundGlassDofRenderState => {
  const quality = getRenderQualitySettings("standard");
  const visual = getGroundGlassDofVisualSettings(architectureRiseScene.id);
  const maximumBlurRadiusPx = Math.min(quality.maximumCoCRadiusPx, visual.maximumBlurRadiusPx);
  const sampledFilm = resolveSampledFilmDimensionsMm({
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
  });
  return createGroundGlassDofRenderState(
    resolveGroundGlassDisplayOpticsState(architectureRiseScene.id, optics),
    camera,
    CAMERA_CONSTANTS.focalLengthMm,
    CAMERA_CONSTANTS.filmWidthMm,
    CAMERA_CONSTANTS.filmHeightMm,
    ACCEPTABLE_COC_DIAMETER_MM,
    architectureRiseScene.cameraPreset.aperture ?? DEFAULT_CAMERA_STATE.aperture,
    WIDTH,
    HEIGHT,
    maximumBlurRadiusPx,
    sampledFilm.widthMm,
    sampledFilm.heightMm,
    WIDTH,
  );
};

const projectToUv = (
  camera: THREE.Camera,
  pointWorld: THREE.Vector3,
): { x: number; y: number; z: number } => {
  camera.updateMatrixWorld(true);
  const projected = pointWorld.clone().project(camera);
  return {
    x: projected.x * 0.5 + 0.5,
    y: projected.y * 0.5 + 0.5,
    z: projected.z,
  };
};

const projectToPixel = (
  camera: THREE.Camera,
  pointWorld: THREE.Vector3,
): { x: number; yBottom: number; uv: { x: number; y: number; z: number } } => {
  const uv = projectToUv(camera, pointWorld);
  return {
    x: Math.floor(uv.x * WIDTH),
    yBottom: Math.floor(uv.y * HEIGHT),
    uv,
  };
};

const renderPositionCapture = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget,
  positionMaterial: THREE.ShaderMaterial,
  clippingPlane: THREE.Plane | null,
): void => {
  const previousOverride = scene.overrideMaterial;
  const previousBackground = scene.background;
  scene.overrideMaterial = positionMaterial;
  scene.background = null;
  renderer.clippingPlanes = clippingPlane ? [clippingPlane] : [];
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  try {
    renderer.render(scene, camera);
  } finally {
    scene.overrideMaterial = previousOverride;
    scene.background = previousBackground;
    renderer.clippingPlanes = [];
  }
};

const renderColorCapture = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget,
  clippingPlane: THREE.Plane | null,
): void => {
  renderer.clippingPlanes = clippingPlane ? [clippingPlane] : [];
  renderSceneTarget(renderer, scene, camera, target);
  renderer.clippingPlanes = [];
};

const renderPaneWorldPosition = (
  renderer: THREE.WebGLRenderer,
  pane: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  target: THREE.WebGLRenderTarget,
  positionMaterial: THREE.ShaderMaterial,
): void => {
  pane.updateWorldMatrix(true, false);
  const isolated = new THREE.Scene();
  const paneClone = pane.clone(false);
  paneClone.matrixAutoUpdate = false;
  paneClone.matrix.copy(pane.matrixWorld);
  paneClone.matrixWorld.copy(pane.matrixWorld);
  isolated.add(paneClone);
  isolated.updateMatrixWorld(true);
  renderPositionCapture(renderer, isolated, camera, target, positionMaterial, null);
  isolated.remove(paneClone);
};

const selectPanePixel = (
  camera: THREE.PerspectiveCamera,
  expectedPanePoint: THREE.Vector3,
  panePositions: Float32Array,
  directPositions: Float32Array,
): { x: number; yBottom: number; panePosition: THREE.Vector3; directPosition: THREE.Vector3 } => {
  const projected = projectToPixel(camera, expectedPanePoint);
  let best: { x: number; yBottom: number; panePosition: THREE.Vector3; directPosition: THREE.Vector3; score: number } | null = null;
  for (let y = Math.max(0, projected.yBottom - 5); y <= Math.min(HEIGHT - 1, projected.yBottom + 5); y += 1) {
    for (let x = Math.max(0, projected.x - 5); x <= Math.min(WIDTH - 1, projected.x + 5); x += 1) {
      const pane = readFloatAt(panePositions, x, y);
      const direct = readFloatAt(directPositions, x, y);
      if (pane[3] < 0.5 || direct[3] < 0.5) continue;
      const panePosition = new THREE.Vector3(pane[0], pane[1], pane[2]);
      const directPosition = new THREE.Vector3(direct[0], direct[1], direct[2]);
      const paneError = panePosition.distanceTo(expectedPanePoint);
      const directError = directPosition.distanceTo(panePosition);
      if (paneError > 0.035 || directError > 0.035) continue;
      const score = paneError + directError +
        Math.hypot(x - projected.x, y - projected.yBottom) * 0.0001;
      if (!best || score < best.score) best = { x, yBottom: y, panePosition, directPosition, score };
    }
  }
  if (!best) {
    throw new Error(
      `Ground Glass camera did not resolve the known glazing sample near ` +
      `(${projected.x}, ${projected.yBottom})`,
    );
  }
  return best;
};

const pointFromTexture = (
  pixels: Float32Array,
  x: number,
  yBottom: number,
  label: string,
): THREE.Vector3 => {
  const value = readFloatAt(pixels, x, yBottom);
  if (value[3] < 0.5 || ![value[0], value[1], value[2]].every(Number.isFinite)) {
    throw new Error(`${label} has no finite world-position sample at ${x},${yBottom}`);
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
};

const reflectPointAcrossPlane = (
  point: THREE.Vector3,
  plane: THREE.Plane,
): THREE.Vector3 => point.clone().addScaledVector(
  plane.normal,
  -2 * plane.distanceToPoint(point),
);

const createPositionSceneForSubject = (
  root: THREE.Group,
  pane: THREE.Mesh,
): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object !== pane && object.visible) meshes.push(object);
  });
  return meshes;
};

const findReflectedFaceSample = (
  camera: THREE.PerspectiveCamera,
  panePosition: THREE.Vector3,
  meshes: THREE.Mesh[],
): {
  uv: { x: number; y: number; z: number };
  pixel: { x: number; yBottom: number };
  objectName: string;
  rayDirection: THREE.Vector3;
} => {
  const uv = projectToUv(camera, panePosition);
  if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1 || uv.z < -1 || uv.z > 1) {
    throw new Error(`Projected pane position falls outside planar capture at ${JSON.stringify(uv)}`);
  }
  const x = Math.min(WIDTH - 1, Math.max(0, Math.floor(uv.x * WIDTH)));
  const yBottom = Math.min(HEIGHT - 1, Math.max(0, Math.floor(uv.y * HEIGHT)));
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(uv.x * 2 - 1, uv.y * 2 - 1), camera);
  // The canonical scene sample starts 120 mm beyond the pane to avoid treating
  // the receiving facade/glazing assembly as reflected-world content. Match
  // that geometric near offset in the planar camera's real scene query.
  raycaster.near = camera.getWorldPosition(new THREE.Vector3()).distanceTo(panePosition) + 0.12;
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (!hit) throw new Error("Reflected planar camera ray did not intersect Architecture Rise geometry");
  return { uv, pixel: { x, yBottom }, objectName: hit.object.name, rayDirection: raycaster.ray.direction.clone() };
};

const getWorldPositionAt = (
  camera: THREE.PerspectiveCamera,
  x: number,
  yBottom: number,
  target: THREE.WebGLRenderTarget,
): THREE.Ray => {
  const ndc = new THREE.Vector2(
    ((x + 0.5) / WIDTH) * 2 - 1,
    ((yBottom + 0.5) / HEIGHT) * 2 - 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const ray = raycaster.ray.clone();
  void target;
  return ray;
};

const measureSharpness = (
  image: Float32Array,
  apparentPositions: Float32Array,
  plane: THREE.Plane,
  signBounds: THREE.Box3,
): FocusCaseMeasurement["reflectedSignSharpness"] => {
  const valid = new Uint8Array(WIDTH * HEIGHT);
  let minX = WIDTH;
  let minY = HEIGHT;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = pixelOffset(x, y);
      if (apparentPositions[offset + 3] < 0.5) continue;
      const virtualPoint = new THREE.Vector3(
        apparentPositions[offset],
        apparentPositions[offset + 1],
        apparentPositions[offset + 2],
      );
      const realPoint = reflectPointAcrossPlane(virtualPoint, plane);
      if (signBounds.distanceToPoint(realPoint) > 0.035) continue;
      valid[y * WIDTH + x] = 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  let energy = 0;
  let count = 0;
  const lumaAt = (x: number, y: number): number => {
    const offset = pixelOffset(x, y);
    return image[offset] * 0.2126 + image[offset + 1] * 0.7152 + image[offset + 2] * 0.0722;
  };
  for (let y = Math.max(0, minY); y < Math.min(HEIGHT - 1, maxY); y += 1) {
    for (let x = Math.max(0, minX); x < Math.min(WIDTH - 1, maxX); x += 1) {
      const here = y * WIDTH + x;
      if (!valid[here]) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        if (!valid[(y + dy) * WIDTH + x + dx]) continue;
        const delta = lumaAt(x + dx, y + dy) - lumaAt(x, y);
        energy += delta * delta;
        count += 1;
      }
    }
  }
  if (count === 0) {
    return {
      crop: { minX: 0, minYBottom: 0, maxX: 0, maxYBottom: 0 },
      edgeGradientEnergy: 0,
      sampleCount: 0,
    };
  }
  return {
    crop: { minX, minYBottom: minY, maxX, maxYBottom: maxY },
    edgeGradientEnergy: energy / count,
    sampleCount: count,
  };
};

const formatName = (value: number): string => {
  if (value === THREE.RGBAFormat) return "RGBAFormat";
  if (value === THREE.FloatType) return "FloatType";
  if (value === THREE.HalfFloatType) return "HalfFloatType";
  if (value === THREE.UnsignedByteType) return "UnsignedByteType";
  if (value === THREE.NearestFilter) return "NearestFilter";
  if (value === THREE.LinearFilter) return "LinearFilter";
  return String(value);
};

const colorSpaceName = (colorSpace: string): string =>
  colorSpace === THREE.NoColorSpace ? "NoColorSpace" : colorSpace;

const bytesPerTexel = (type: number): number => {
  if (type === THREE.FloatType) return 16;
  if (type === THREE.HalfFloatType) return 8;
  return 4;
};

type CapturedCase = {
  camera: THREE.PerspectiveCamera;
  optics: DerivedOpticsState;
  sample: ReturnType<typeof getSignSample>;
  plane: THREE.Plane;
  reflectionCamera: THREE.PerspectiveCamera;
  panePixel: ReturnType<typeof selectPanePixel>;
  reflectionUv: { x: number; y: number; z: number };
  reflectionPixel: { x: number; yBottom: number };
  planarHitObject: string;
  panePositionPixels: Float32Array;
  directPositionPixels: Float32Array;
  reflectionPositionPixels: Float32Array;
  mappedPositionPixels: Float32Array;
  mappedRadiancePixels: Float32Array;
  directRadiancePixels: Float32Array;
  directRayFirstHit: string;
  clippingPlaneSideViolations: number;
  invalidPositionRadianceViolations: number;
};

const runPlanarFocusReference = (): PlanarProof => {
  const canvas = document.getElementById("gpu-source") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Planar reference WebGL canvas is missing");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  const rendererState = captureRendererState(renderer);
  const bundle = makeOwnedBundle();
  let proof: PlanarProof | null = null;
  let textureCountBeforeDispose = 0;
  let rendererDisposeCalled = false;
  let proofFailed = false;
  let proofError: unknown;
  const cleanupErrors: unknown[] = [];

  try {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    renderer.xr.enabled = false;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = true;
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.setScissorTest(false);
    renderer.setClearColor(SKY_COLOR, 1);

    const fullscreen = makeFullscreenScene(bundle);
    const positionMaterial = makePositionCaptureMaterial(bundle);
    const paneMaskMaterial = makePaneMaskPositionMaterial(bundle);
    const mappingMaterial = makeMappingMaterial(bundle);
    const radianceValidityMaskMaterial = makeRadianceValidityMaskMaterial(bundle);
    const radianceSumMaterial = makeRadianceSumMaterial(bundle);
    const compositeMaterial = makeCompositeMaterial(bundle);
    const cocDecodeMaterial = makeCocDecodeMaterial(bundle);

    const backend = verifyFloatTargetCapability(
      renderer,
      bundle,
      fullscreen.scene,
      fullscreen.camera,
      fullscreen.quad,
    );
    const radianceFilter: THREE.MagnificationTextureFilter = backend.radianceFilter === "LinearFilter"
      ? THREE.LinearFilter
      : THREE.NearestFilter;

    const scene = new THREE.Scene();
    scene.background = SKY_COLOR.clone();
    const subject = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    scene.add(subject);
    bundle.disposers.push(() => {
      scene.remove(subject);
      disposeArchitectureRiseGroup(subject);
    });
    const sceneProfile = getGroundGlassSceneProfile(architectureRiseScene);
    sceneProfile.configureRttShadowParticipation(subject);

    const presentationLighting = resolveScenePresentationLighting(architectureRiseScene.id, {
      surface: "ground-glass",
      cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
      presentationRegion: "middle",
    });
    const teachingLights = createPresentationLightingRig(scene, presentationLighting);
    bundle.disposers.push(() => disposePresentationLightingRig(scene, teachingLights));
    const worldIllumination = resolveSceneWorldIllumination(architectureRiseScene.id);
    const worldLights = createWorldIlluminationRig(scene, worldIllumination);
    bundle.disposers.push(() => disposeWorldIlluminationRig(scene, worldLights));
    if (worldIllumination.environment) {
      const worldEnvironment = createWorldEnvironmentRig(scene, renderer, worldIllumination.environment);
      bundle.disposers.push(() => disposeWorldEnvironmentRig(scene, worldEnvironment));
    }

    const pane = findMesh(subject, TARGET_PANE_NAME);
    const signFace = findMesh(subject, TARGET_FACE_NAME);
    const sceneMeshes = createPositionSceneForSubject(subject, pane);
    const visibilityDepth = makeDataTexture(bundle, new Uint8Array([255, 255, 255, 255]), 1, 1);

    const directRadianceTarget = makeRadianceTarget(bundle, radianceFilter, true);
    const planarRadianceTarget = makeRadianceTarget(bundle, radianceFilter, true);
    const directWorldPositionTarget = makePositionTarget(bundle, true);
    const planarWorldPositionTarget = makePositionTarget(bundle, true);
    const paneWorldPositionTarget = makePositionTarget(bundle, true);
    const directContributionRadianceTarget = makeRadianceTarget(bundle, radianceFilter);
    const resolvedRadianceTarget = makeRadianceTarget(bundle, radianceFilter);
    const reflectedApparentPositionTarget = makePositionTarget(bundle);
    const combinedRadianceTarget = makeRadianceTarget(bundle, THREE.NearestFilter);
    const finalDisplayTarget = makeDisplayTarget(bundle);
    const cocDiagnosticTarget = makeRadianceTarget(bundle, THREE.NearestFilter);
    const directLayer = makeContributionLayer(renderer, bundle, visibilityDepth, radianceFilter);
    const reflectedLayer = makeContributionLayer(renderer, bundle, visibilityDepth, radianceFilter);
    const reflectionLayers = [directLayer, reflectedLayer] as const;

    const paneFocusDistanceMm = FOCUS_CASES.paneFocus;
    const paneFocusSetup = makeConfiguredGroundGlassCamera(paneFocusDistanceMm);
    const initialLensOrigin = paneFocusSetup.camera.getWorldPosition(new THREE.Vector3());
    const canonicalSample = getSignSample(subject, pane, initialLensOrigin);
    const qVirtualMm = canonicalSample.virtualPoint.clone().multiplyScalar(1000);
    const virtualFocusAxisDistanceMm = qVirtualMm
      .sub(paneFocusSetup.optics.lensCenterWorld)
      .dot(paneFocusSetup.optics.opticalAxis.direction);
    const reflectionFocusDistanceMm = roundToStep(
      virtualFocusAxisDistanceMm,
      CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
    const publicRange = architectureRiseScene.focusDistanceRangeMm;
    if (!publicRange) throw new Error("Architecture Rise public focus range is not configured");
    if (
      reflectionFocusDistanceMm < publicRange.min ||
      reflectionFocusDistanceMm > publicRange.max
    ) {
      throw new Error(
        `Reflected optical-axis focus ${reflectionFocusDistanceMm} mm is outside the public focus range`,
      );
    }

    const quality = getRenderQualitySettings("standard");
    const visual = getGroundGlassDofVisualSettings(architectureRiseScene.id);
    const maximumBlurRadiusPx = Math.min(quality.maximumCoCRadiusPx, visual.maximumBlurRadiusPx);
    const cocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: maximumBlurRadiusPx,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: WIDTH,
    });
    const cocTolerance = (layer: ContributionLayer): number =>
      layer.cocStorageFormat === "half-float-mm" ? 0.001 : cocStorageMaxMm / 254;

    const mapContribution = (input: {
      camera: THREE.PerspectiveCamera;
      optics: DerivedOpticsState;
      sample: ReturnType<typeof getSignSample>;
    }): CapturedCase => {
      const { camera, optics, sample } = input;
      camera.updateMatrixWorld(true);
      const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
      const cameraSideNormal = cameraPosition.clone().sub(sample.panePoint).normalize();
      const clippedPanePoint = sample.panePoint.clone().addScaledVector(cameraSideNormal, 0.12);
      const cameraSideClipPlane = new THREE.Plane(
        cameraSideNormal,
        -cameraSideNormal.dot(clippedPanePoint),
      );
      const reflectionCamera = makePlanarReflectionCamera(camera, sample.plane);

      renderColorCapture(renderer, scene, camera, directRadianceTarget, null);
      renderPositionCapture(renderer, scene, camera, directWorldPositionTarget, positionMaterial, null);
      renderPaneWorldPosition(renderer, pane, camera, paneWorldPositionTarget, paneMaskMaterial);
      const directRadiancePixels = readFloatPixels(renderer, directRadianceTarget);
      const directPositionPixels = readFloatPixels(renderer, directWorldPositionTarget);
      const panePositionPixels = readFloatPixels(renderer, paneWorldPositionTarget);
      radianceValidityMaskMaterial.uniforms.tRadiance.value = directRadianceTarget.texture;
      radianceValidityMaskMaterial.uniforms.tWorldPosition.value = directWorldPositionTarget.texture;
      drawFullscreen(renderer, directContributionRadianceTarget, radianceValidityMaskMaterial, fullscreen);
      const directContributionRadiancePixels = readFloatPixels(renderer, directContributionRadianceTarget);
      assertInvalidRadianceIsZero(
        directPositionPixels,
        directContributionRadiancePixels,
        "Direct contribution",
      );
      const panePixel = selectPanePixel(camera, sample.panePoint, panePositionPixels, directPositionPixels);

      const previousPaneVisibility = pane.visible;
      let clippingPlaneSideViolations = 0;
      try {
        pane.visible = false;
        renderColorCapture(renderer, scene, reflectionCamera, planarRadianceTarget, cameraSideClipPlane);
        renderPositionCapture(
          renderer,
          scene,
          reflectionCamera,
          planarWorldPositionTarget,
          positionMaterial,
          cameraSideClipPlane,
        );
      } finally {
        pane.visible = previousPaneVisibility;
        renderer.clippingPlanes = [];
      }

      const reflectionPositionPixels = readFloatPixels(renderer, planarWorldPositionTarget);
      for (let offset = 0; offset < reflectionPositionPixels.length; offset += 4) {
        if (reflectionPositionPixels[offset + 3] < 0.5) continue;
        const captured = new THREE.Vector3(
          reflectionPositionPixels[offset],
          reflectionPositionPixels[offset + 1],
          reflectionPositionPixels[offset + 2],
        );
        if (cameraSideClipPlane.distanceToPoint(captured) < -0.002) clippingPlaneSideViolations += 1;
      }
      if (clippingPlaneSideViolations > 0) {
        throw new Error(
          `Planar camera-side clipping retained ${clippingPlaneSideViolations} world-position samples beyond the pane`,
        );
      }

      reflectionCamera.updateMatrixWorld(true);
      const viewProjection = reflectionCamera.projectionMatrix.clone()
        .multiply(reflectionCamera.matrixWorldInverse);
      mappingMaterial.uniforms.tPanePosition.value = paneWorldPositionTarget.texture;
      mappingMaterial.uniforms.tPlanarRadiance.value = planarRadianceTarget.texture;
      mappingMaterial.uniforms.tPlanarPosition.value = planarWorldPositionTarget.texture;
      (mappingMaterial.uniforms.reflectionViewProjection.value as THREE.Matrix4).copy(viewProjection);
      (mappingMaterial.uniforms.panePointWorld.value as THREE.Vector3).copy(sample.panePoint);
      (mappingMaterial.uniforms.paneNormalWorld.value as THREE.Vector3).copy(sample.normal);
      mappingMaterial.uniforms.reflectionWeight.value = REFLECTION_WEIGHT;
      mappingMaterial.uniforms.outputApparentPosition.value = 0;
      drawFullscreen(renderer, resolvedRadianceTarget, mappingMaterial, fullscreen);
      mappingMaterial.uniforms.outputApparentPosition.value = 1;
      drawFullscreen(renderer, reflectedApparentPositionTarget, mappingMaterial, fullscreen);
      const mappedRadiancePixels = readFloatPixels(renderer, resolvedRadianceTarget);
      const mappedPositionPixels = readFloatPixels(renderer, reflectedApparentPositionTarget);
      assertInvalidRadianceIsZero(mappedPositionPixels, mappedRadiancePixels, "Planar reflection contribution");

      const selectedPanePosition = panePixel.panePosition;
      const reflectionSample = findReflectedFaceSample(reflectionCamera, selectedPanePosition, sceneMeshes);
      if (reflectionSample.objectName !== TARGET_FACE_NAME) {
        throw new Error(
          `Known Architecture Rise pane sample reflected to ${reflectionSample.objectName}, expected ${TARGET_FACE_NAME}; ` +
          `uv=${JSON.stringify(reflectionSample.uv)} panePixel=${panePixel.x},${panePixel.yBottom} ` +
          `pane=${JSON.stringify(pointToTuple(panePixel.panePosition))} ` +
          `cpuPane=${JSON.stringify(pointToTuple(sample.panePoint))} ` +
          `reflectedRayDot=${reflectionSample.rayDirection.dot(sample.reflectedDirection).toFixed(6)} ` +
          `camera=${JSON.stringify(pointToTuple(reflectionCamera.position))}`,
        );
      }
      const directRaycaster = new THREE.Raycaster(
        cameraPosition,
        sample.panePoint.clone().sub(cameraPosition).normalize(),
      );
      const directHits = directRaycaster.intersectObjects(sceneMeshes.concat([pane]), false);
      const directRayFirstHit = directHits[0]?.object.name ?? "<no-hit>";
      const reflectionPixelPosition = pointFromTexture(
        reflectionPositionPixels,
        reflectionSample.pixel.x,
        reflectionSample.pixel.yBottom,
        "Planar scene world-position capture",
      );
      const planarHitPixelRay = getWorldPositionAt(
        reflectionCamera,
        reflectionSample.pixel.x,
        reflectionSample.pixel.yBottom,
        planarWorldPositionTarget,
      );
      const planarHitRayPosition = planarHitPixelRay.at(
        planarHitPixelRay.origin.distanceTo(reflectionPixelPosition),
        new THREE.Vector3(),
      );
      if (reflectionPixelPosition.distanceTo(planarHitRayPosition) > 0.12) {
        throw new Error("Planar world-position sample is not consistent with the reflected camera ray");
      }

      return {
        camera,
        optics,
        sample,
        plane: sample.plane,
        reflectionCamera,
        panePixel,
        reflectionUv: reflectionSample.uv,
        reflectionPixel: reflectionSample.pixel,
        planarHitObject: reflectionSample.objectName,
        panePositionPixels,
        directPositionPixels,
        reflectionPositionPixels,
        mappedPositionPixels,
        mappedRadiancePixels,
        directRadiancePixels,
        directRayFirstHit,
        clippingPlaneSideViolations,
        invalidPositionRadianceViolations: 0,
      };
    };

    const focusCases: Record<FocusCaseId, FocusCaseMeasurement> = {} as Record<FocusCaseId, FocusCaseMeasurement>;
    const capturedCases: Partial<Record<FocusCaseId, CapturedCase>> = {};
    const focusCaseInputs: readonly [FocusCaseId, number][] = [
      ["paneFocus", paneFocusDistanceMm],
      ["reflectionFocus", reflectionFocusDistanceMm],
    ];
    let totalDirectSceneRenders = 0;
    let totalPlanarSceneRenders = 0;
    let totalWorldPositionSceneRenders = 0;
    let totalPaneMaskRenders = 0;
    let totalMappingResolves = 0;
    let totalRadianceValidityMaskPasses = 0;
    let totalCocPasses = 0;
    let totalCocDiagnostics = 0;
    let totalGatherPasses = 0;
    let totalFocusResolvePasses = 0;
    let totalRadianceSums = 0;
    let totalCompositePasses = 0;
    let selectedGpuQ = new THREE.Vector3();
    let selectedGpuQv = new THREE.Vector3();
    let selectedPlanarRadiance: PointTuple = [0, 0, 0];
    let selectedReflectionUv = { x: 0, y: 0, z: 0 };
    let selectedReflectionPixel = { x: 0, yBottom: 0 };
    let selectedCamera: THREE.PerspectiveCamera | null = null;
    let selectedReflectionCamera: THREE.PerspectiveCamera | null = null;
    let selectedClippingPassed = false;
    let selectedReflectionFirstHit = "<no-hit>";

    for (const [caseId, focusDistanceMm] of focusCaseInputs) {
      const setup = makeConfiguredGroundGlassCamera(focusDistanceMm);
      const lensOrigin = setup.camera.getWorldPosition(new THREE.Vector3());
      const sample = getSignSample(subject, pane, lensOrigin);
      const captured = mapContribution({ camera: setup.camera, optics: setup.optics, sample });
      capturedCases[caseId] = captured;
      totalDirectSceneRenders += 1;
      totalPlanarSceneRenders += 1;
      totalWorldPositionSceneRenders += 2;
      totalPaneMaskRenders += 1;
      totalMappingResolves += 2;
      totalRadianceValidityMaskPasses += 1;

      const dofState = makeConfiguredDofState(captured.camera, captured.optics);
      const cocMax = resolveGroundGlassCocStorageMaxMm({
        maximumCoCRadiusPx: dofState.render.maximumBlurRadiusPx,
        filmWidthMm: dofState.film.sampledWidthMm,
        renderWidthPx: WIDTH,
      });
      const inputs = resolveGroundGlassRadianceContributions(
        {
          id: "direct-pane-radiance",
          radianceSemantics: "preweighted-linear-radiance",
          radiance: directContributionRadianceTarget.texture,
          apparentWorldPosition: directWorldPositionTarget.texture,
          gatherVisibilityDepth: visibilityDepth,
        },
        [{
          id: "architecture-rise-planar-reference",
          radianceSemantics: "preweighted-linear-radiance",
          radiance: resolvedRadianceTarget.texture,
          apparentWorldPosition: reflectedApparentPositionTarget.texture,
          gatherVisibilityDepth: visibilityDepth,
        }],
      );
      if (inputs.omittedOptionalIds.length !== 0 || inputs.contributions.length !== 2) {
        throw new Error("The renderer-local planar reflection contribution was rejected");
      }

      const inputPositionById = new Map<string, THREE.Texture>([
        ["direct-pane-radiance", directWorldPositionTarget.texture],
        ["architecture-rise-planar-reference", reflectedApparentPositionTarget.texture],
      ]);
      for (let index = 0; index < inputs.contributions.length; index += 1) {
        const input = inputs.contributions[index];
        const layer = reflectionLayers[index];
        bindGroundGlassDofStateToApparentWorldPositionCocMaterial(
          layer.cocMaterial,
          dofState,
          inputPositionById.get(input.id) ?? input.apparentWorldPosition,
        );
        const encodedStorage = layer.cocStorageFormat === "encoded-byte";
        layer.cocMaterial.uniforms.cocStorageEncoded.value = encodedStorage ? 1 : 0;
        layer.cocMaterial.uniforms.cocStorageMaxMm.value = cocMax;
        layer.cocMaterial.uniforms.footprintStorageMaxMm.value = cocMax * 0.5;
        drawFullscreen(renderer, layer.cocTarget, layer.cocMaterial, fullscreen);
        totalCocPasses += 1;

        bindGroundGlassDofStateToGatherMaterial(layer.gatherMaterial, dofState);
        layer.gatherMaterial.uniforms.tColor.value = input.radiance;
        layer.gatherMaterial.uniforms.tDepth.value = input.gatherVisibilityDepth ?? visibilityDepth;
        layer.gatherMaterial.uniforms.tCoC.value = layer.cocTarget.texture;
        layer.gatherMaterial.uniforms.sampleCount.value = quality.sampleCount;
        layer.gatherMaterial.uniforms.maximumCoCRadiusPx.value = dofState.render.maximumBlurRadiusPx;
        layer.gatherMaterial.uniforms.renderWidth.value = WIDTH;
        layer.gatherMaterial.uniforms.renderHeight.value = HEIGHT;
        layer.gatherMaterial.uniforms.gatherLayer.value = 0;
        layer.gatherMaterial.uniforms.cocStorageEncoded.value = encodedStorage ? 1 : 0;
        layer.gatherMaterial.uniforms.cocStorageMaxMm.value = cocMax;
        layer.gatherMaterial.uniforms.footprintStorageMaxMm.value = cocMax * 0.5;
        drawFullscreen(renderer, layer.farTarget, layer.gatherMaterial, fullscreen);
        totalGatherPasses += 1;
        layer.gatherMaterial.uniforms.gatherLayer.value = 1;
        drawFullscreen(renderer, layer.nearTarget, layer.gatherMaterial, fullscreen);
        totalGatherPasses += 1;

        layer.resolveMaterial.uniforms.tFar.value = layer.farTarget.texture;
        layer.resolveMaterial.uniforms.tNear.value = layer.nearTarget.texture;
        drawFullscreen(renderer, layer.focusedTarget, layer.resolveMaterial, fullscreen);
        totalFocusResolvePasses += 1;
      }

      const selectedX = captured.panePixel.x;
      const selectedY = captured.panePixel.yBottom;
      const directPosition = pointFromTexture(captured.directPositionPixels, selectedX, selectedY, "Direct scene world position");
      const virtualPosition = pointFromTexture(captured.mappedPositionPixels, selectedX, selectedY, "Mapped virtual image");
      const directCpu = physicalFootprintAt(setup.optics, directPosition);
      const reflectedCpu = physicalFootprintAt(setup.optics, captured.sample.virtualPoint);

      const decodeCocAtPixel = (
        layer: ContributionLayer,
        x: number,
        yBottom: number,
      ): CoCMeasurement => {
        const encodedStorage = layer.cocStorageFormat === "encoded-byte";
        cocDecodeMaterial.uniforms.tCoC.value = layer.cocTarget.texture;
        cocDecodeMaterial.uniforms.cocStorageEncoded.value = encodedStorage ? 1 : 0;
        cocDecodeMaterial.uniforms.cocStorageMaxMm.value = cocMax;
        cocDecodeMaterial.uniforms.footprintStorageMaxMm.value = cocMax * 0.5;
        drawFullscreen(renderer, cocDiagnosticTarget, cocDecodeMaterial, fullscreen);
        totalCocDiagnostics += 1;
        const decoded = readFloatAt(readFloatPixels(renderer, cocDiagnosticTarget), x, yBottom);
        const cpu = layer === directLayer ? directCpu : reflectedCpu;
        return {
          signedCoCDiameterMm: decoded[0],
          majorRadiusMm: decoded[1],
          minorRadiusMm: decoded[2],
          orientationRad: decoded[3],
          storageFormat: layer.cocStorageFormat,
          storageToleranceMm: cocTolerance(layer),
          absoluteCpuDifferenceMm: Math.abs(decoded[0] - cpu.signedCoCDiameterMm),
        };
      };
      const directCoC = decodeCocAtPixel(directLayer, selectedX, selectedY);
      const reflectedCoC = decodeCocAtPixel(reflectedLayer, selectedX, selectedY);
      const directFocusedPixels = readFloatPixels(renderer, directLayer.focusedTarget);
      const reflectedFocusedPixels = readFloatPixels(renderer, reflectedLayer.focusedTarget);

      radianceSumMaterial.uniforms.tDirect.value = directLayer.focusedTarget.texture;
      radianceSumMaterial.uniforms.tReflection.value = reflectedLayer.focusedTarget.texture;
      drawFullscreen(renderer, combinedRadianceTarget, radianceSumMaterial, fullscreen);
      totalRadianceSums += 1;
      const combinedLinearPixels = readFloatPixels(renderer, combinedRadianceTarget);
      let maxLinearSumDifference = 0;
      for (let offset = 0; offset < combinedLinearPixels.length; offset += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          maxLinearSumDifference = Math.max(
            maxLinearSumDifference,
            Math.abs(
              combinedLinearPixels[offset + channel] -
              directFocusedPixels[offset + channel] -
              reflectedFocusedPixels[offset + channel],
            ),
          );
        }
      }

      const coverageRenderState = resolveGroundGlassCoverageRenderState({
        state: setup.optics.groundGlassCoverage,
        rawDebug: false,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
        inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
        renderWidthPx: WIDTH,
        renderHeightPx: HEIGHT,
      });
      const naturalIlluminationRenderState = resolveGroundGlassNaturalIlluminationRenderState({
        state: setup.optics.groundGlassNaturalIllumination,
        rawDebug: false,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
        inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      });
      const relativeIlluminanceGain = resolveGroundGlassRelativeIlluminance({
        apertureFNumber: dofState.optics.apertureFNumber,
        focalLengthMm: dofState.optics.focalLengthMm,
        imageDistanceMm: setup.optics.diagnostics.fallbackApplied ? null : dofState.optics.imageDistanceMm,
      });
      bindGroundGlassPhysicalStateToComposite(compositeMaterial, {
        dof: dofState,
        coverage: coverageRenderState,
        naturalIllumination: naturalIlluminationRenderState,
        relativeIlluminanceGain,
      } satisfies GroundGlassPhysicalRenderState);
      const displayTransform = resolveGroundGlassRttDisplayTransform("raw");
      compositeMaterial.uniforms.flipDisplayX.value = displayTransform.flipDisplayX ? 1 : 0;
      compositeMaterial.uniforms.flipDisplayY.value = displayTransform.flipDisplayY ? 1 : 0;
      compositeMaterial.uniforms.tGather.value = combinedRadianceTarget.texture;
      compositeMaterial.uniforms.tNearGather.value = directLayer.nearTarget.texture;
      compositeMaterial.uniforms.useNearGather.value = 0;
      drawFullscreen(renderer, finalDisplayTarget, compositeMaterial, fullscreen);
      totalCompositePasses += 1;

      const combinedDisplayPixels = readBytePixels(renderer, finalDisplayTarget);
      const directRgb = readFloatAt(directFocusedPixels, selectedX, selectedY);
      const reflectedRgb = readFloatAt(reflectedFocusedPixels, selectedX, selectedY);
      const combinedRgb = readFloatAt(combinedLinearPixels, selectedX, selectedY);
      const displayX = displayTransform.flipDisplayX ? WIDTH - 1 - selectedX : selectedX;
      const displayY = displayTransform.flipDisplayY ? HEIGHT - 1 - selectedY : selectedY;
      const displayOffset = pixelOffset(displayX, displayY);
      const displayRgba = [
        combinedDisplayPixels[displayOffset],
        combinedDisplayPixels[displayOffset + 1],
        combinedDisplayPixels[displayOffset + 2],
        combinedDisplayPixels[displayOffset + 3],
      ] as const;
      const reflectionSourceImage = toDisplayBytes(captured.mappedRadiancePixels);
      const focusedReflectionImage = toDisplayBytes(reflectedFocusedPixels);
      const combinedDisplayImage = displayBytesFromTarget(combinedDisplayPixels);
      const signSharpness = measureSharpness(
        reflectedFocusedPixels,
        captured.mappedPositionPixels,
        captured.plane,
        new THREE.Box3().setFromObject(signFace),
      );
      caseImages[caseId] = {
        reflection: reflectionSourceImage,
        focused: focusedReflectionImage,
        combined: combinedDisplayImage,
      };
      focusCases[caseId] = {
        focusDistanceMm,
        sourcePixel: { x: selectedX, yBottom: selectedY },
        cpu: {
          reflectedCoC: {
            signedCoCDiameterMm: reflectedCpu.signedCoCDiameterMm,
            majorRadiusMm: reflectedCpu.majorRadiusMm,
            minorRadiusMm: reflectedCpu.minorRadiusMm,
            orientationRad: reflectedCpu.orientationRad,
            storageFormat: reflectedLayer.cocStorageFormat,
            storageToleranceMm: cocTolerance(reflectedLayer),
            absoluteCpuDifferenceMm: 0,
          },
          directCoC: {
            signedCoCDiameterMm: directCpu.signedCoCDiameterMm,
            majorRadiusMm: directCpu.majorRadiusMm,
            minorRadiusMm: directCpu.minorRadiusMm,
            orientationRad: directCpu.orientationRad,
            storageFormat: directLayer.cocStorageFormat,
            storageToleranceMm: cocTolerance(directLayer),
            absoluteCpuDifferenceMm: 0,
          },
        },
        gpu: {
          reflectedCoC,
          directCoC,
          directFocusedRgb: [directRgb[0], directRgb[1], directRgb[2]],
          reflectedFocusedRgb: [reflectedRgb[0], reflectedRgb[1], reflectedRgb[2]],
          combinedLinearRgb: [combinedRgb[0], combinedRgb[1], combinedRgb[2]],
          maxLinearSumDifference,
          finalDisplayRgba: displayRgba,
        },
        reflectedSignSharpness: signSharpness,
        reflectionSourceHash: hashDisplayPixels(reflectionSourceImage),
        reflectionOnlyHash: hashDisplayPixels(focusedReflectionImage),
        combinedDisplayHash: hashDisplayPixels(combinedDisplayImage),
      };

      if (caseId === "paneFocus") {
        selectedCamera = captured.camera;
        selectedReflectionCamera = captured.reflectionCamera;
        selectedGpuQv = virtualPosition;
        selectedGpuQ = reflectPointAcrossPlane(virtualPosition, captured.plane);
        selectedPlanarRadiance = [
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[0],
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[1],
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[2],
        ];
        selectedReflectionUv = captured.reflectionUv;
        selectedReflectionPixel = captured.reflectionPixel;
        selectedClippingPassed = captured.clippingPlaneSideViolations === 0;
        selectedReflectionFirstHit = captured.planarHitObject;
      }
    }

    if (!selectedCamera || !selectedReflectionCamera) {
      throw new Error("The pane-focus Architecture Rise planar reference was not captured");
    }

    const paneFocusCaptured = capturedCases.paneFocus;
    const reflectionFocusCaptured = capturedCases.reflectionFocus;
    if (!paneFocusCaptured || !reflectionFocusCaptured) throw new Error("A required focus case is missing");
    const exactCpuRangeMm = canonicalSample.virtualPoint.clone().sub(initialLensOrigin).length() * 1000;
    const gpuRangeMm = selectedGpuQv.clone().sub(initialLensOrigin).length() * 1000;
    const opticalAxisDistanceMm = selectedGpuQv.clone().multiplyScalar(1000)
      .sub(paneFocusSetup.optics.lensCenterWorld)
      .dot(paneFocusSetup.optics.opticalAxis.direction);
    const roundedOpticalFocusMm = roundToStep(
      opticalAxisDistanceMm,
      CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
    if (roundedOpticalFocusMm !== reflectionFocusDistanceMm) {
      throw new Error(
        `GPU reflected-focus estimate rounded to ${roundedOpticalFocusMm} mm, expected control ${reflectionFocusDistanceMm} mm`,
      );
    }
    const panePositionSample = pointFromTexture(
      paneFocusCaptured.panePositionPixels,
      paneFocusCaptured.panePixel.x,
      paneFocusCaptured.panePixel.yBottom,
      "Pane world-position mask",
    );
    const paneFocusMeasurement = focusCases.paneFocus;
    const directFirstHitIsPane = paneFocusCaptured.directRayFirstHit === TARGET_PANE_NAME;
    const directRayHitsSign = paneFocusCaptured.directRayFirstHit.startsWith("architecture-rise-street-sign");
    const reflectedKnownFace = paneFocusCaptured.planarHitObject === TARGET_FACE_NAME;
    const faceBounds = new THREE.Box3().setFromObject(signFace);
    const gpuQInsideSignFace = faceBounds.distanceToPoint(selectedGpuQ) < 0.05;
    const paneToQHitsExpectedFace = reflectedKnownFace && gpuQInsideSignFace;
    const paneToQPathClear = selectedReflectionFirstHit === TARGET_FACE_NAME;
    if (!paneFocusMeasurement || !paneToQHitsExpectedFace || !directFirstHitIsPane || directRayHitsSign) {
      throw new Error(
        `Architecture Rise pane/reflection sample failed: paneHit=${paneFocusCaptured.directRayFirstHit}, ` +
        `reflectionHit=${paneFocusCaptured.planarHitObject}, gpuQInsideFace=${gpuQInsideSignFace}`,
      );
    }

    const directRay = new THREE.Raycaster(
      selectedCamera.getWorldPosition(new THREE.Vector3()),
      canonicalSample.panePoint.clone().sub(selectedCamera.getWorldPosition(new THREE.Vector3())).normalize(),
    );
    const directHits = directRay.intersectObjects(sceneMeshes.concat([pane]), false);
    const paneToQDirection = canonicalSample.realPoint.clone().sub(canonicalSample.panePoint).normalize();
    const paneToQRay = new THREE.Raycaster(
      canonicalSample.panePoint.clone().addScaledVector(paneToQDirection, 0.12),
      paneToQDirection,
    );
    const paneToQHit = paneToQRay.intersectObjects(sceneMeshes, false)[0];
    const paneToQFirstHit = paneToQHit?.object.name ?? "<no-hit>";
    const directPaneFirstHit = directHits[0]?.object.name ?? "<no-hit>";
    const exactReflectedObject = paneToQFirstHit;
    if (directPaneFirstHit !== TARGET_PANE_NAME || exactReflectedObject !== TARGET_FACE_NAME) {
      throw new Error(
        `Direct/reflected ray safety regression: direct=${directPaneFirstHit}, reflected=${exactReflectedObject}`,
      );
    }

    const reflectionFocusMeasurement = focusCases.reflectionFocus;
    if (!reflectionFocusMeasurement) throw new Error("Reflected-focus evidence is absent");
    const paneFilmUv = {
      x: (paneFocusCaptured.panePixel.x + 0.5) / WIDTH,
      y: (paneFocusCaptured.panePixel.yBottom + 0.5) / HEIGHT,
    };
    const sourceFilmPointMm: readonly [number, number] = [
      (paneFilmUv.x - 0.5) * CAMERA_CONSTANTS.filmWidthMm,
      (0.5 - paneFilmUv.y) * CAMERA_CONSTANTS.filmHeightMm,
    ];
    const coverageGain = calculateGroundGlassCoverageGain(
      paneFocusSetup.optics.groundGlassCoverage,
      sourceFilmPointMm[0],
      sourceFilmPointMm[1],
    );
    const naturalIlluminationGain = calculateGroundGlassNaturalIlluminationGain(
      paneFocusSetup.optics.groundGlassNaturalIllumination,
      sourceFilmPointMm[0],
      sourceFilmPointMm[1],
    );
    const relativeIlluminanceGain = resolveGroundGlassRelativeIlluminance({
      apertureFNumber: architectureRiseScene.cameraPreset.aperture ?? DEFAULT_CAMERA_STATE.aperture,
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      imageDistanceMm: paneFocusSetup.optics.diagnostics.fallbackApplied
        ? null
        : paneFocusSetup.optics.diagnostics.imageDistanceMm ?? null,
    });
    const reflectionCameraPose = readGroundGlassCameraPose(selectedReflectionCamera);
    const nominalPayload = bundle.targets.reduce(
      (sum, target) => sum + target.width * target.height * bytesPerTexel(target.texture.type),
      0,
    );
    const targetDescriptor = (target: THREE.WebGLRenderTarget) => ({
      dimensions: [target.width, target.height] as const,
      format: formatName(target.texture.format),
      type: formatName(target.texture.type),
      colorSpace: colorSpaceName(target.texture.colorSpace),
      filter: formatName(target.texture.magFilter),
    });

    proof = {
      baseSha: "9bf1739a0d73e6650621dd32a55a53f311e09e8d",
      backend,
      sample: {
        pane: TARGET_PANE_NAME,
        uv: { u: PANE_U, v: PANE_V },
        panePoint: pointToTuple(canonicalSample.panePoint),
        normal: pointToTuple(canonicalSample.normal),
        reflectedPoint: pointToTuple(canonicalSample.realPoint),
        virtualPoint: pointToTuple(canonicalSample.virtualPoint),
        sourcePixel: {
          x: paneFocusCaptured.panePixel.x,
          yBottom: paneFocusCaptured.panePixel.yBottom,
        },
        reflectedUv: selectedReflectionUv,
        reflectedPixel: selectedReflectionPixel,
        paneMaskActive: panePositionSample.distanceTo(canonicalSample.panePoint) < 0.035,
        paneWorldPosition: pointToTuple(panePositionSample),
        directWorldPosition: pointToTuple(paneFocusCaptured.panePixel.directPosition),
        reflectionObject: paneFocusCaptured.planarHitObject,
        cpuQ: pointToTuple(canonicalSample.realPoint),
        gpuQ: pointToTuple(selectedGpuQ),
        cpuQVirtual: pointToTuple(canonicalSample.virtualPoint),
        gpuQVirtual: pointToTuple(selectedGpuQv),
        gpuQInsideSignFace,
        gpuQDistanceFromCpuM: selectedGpuQ.distanceTo(canonicalSample.realPoint),
        gpuQVirtualDistanceFromCpuM: selectedGpuQv.distanceTo(canonicalSample.virtualPoint),
        reflectedRadiance: selectedPlanarRadiance,
        euclideanGeometricRangeMm: exactCpuRangeMm,
        opticalAxisFocusDistanceMm: virtualFocusAxisDistanceMm,
        roundedReflectionFocusMm: roundedOpticalFocusMm,
        gpuGeometricRangeMm: gpuRangeMm,
        reflectionCameraPosition: reflectionCameraPose.positionWorld,
        reflectionCameraForward: reflectionCameraPose.forwardWorld,
      },
      groundGlassCamera: {
        pose: readGroundGlassCameraPose(selectedCamera),
        lensCenterWorldM: vecToWorld(paneFocusSetup.optics.lensCenterWorld),
        opticalAxisOriginWorldM: vecToWorld(paneFocusSetup.optics.opticalAxis.origin),
        opticalAxisDirection: pointToTuple(paneFocusSetup.optics.opticalAxis.direction),
        projectionMatrix: Array.from(selectedCamera.projectionMatrix.elements),
        frustum: {
          left: paneFocusSetup.config.left,
          right: paneFocusSetup.config.right,
          top: paneFocusSetup.config.top,
          bottom: paneFocusSetup.config.bottom,
          near: paneFocusSetup.config.near,
          far: paneFocusSetup.config.far,
          determinant: paneFocusSetup.config.determinant,
        },
      },
      contributionContract: {
        directId: "direct-pane-radiance",
        reflectedId: "architecture-rise-planar-reference",
        radianceSemantics: "preweighted-linear-radiance",
        resolvedContributionCount: reflectionLayers.length,
        gatherVisibility: {
          dimensions: [1, 1],
          purpose: "visibility-only",
          neutral: true,
        },
      },
      directViewSafety: {
        paneFirstHit: directPaneFirstHit,
        directRayHitsStreetSign: directRayHitsSign,
        paneToQFirstHit,
        paneToQPathClear,
      },
      cases: focusCases,
      sharedFilmEffects: {
        namedSample: {
          coverageActive: paneFocusSetup.optics.groundGlassCoverage.kind !== "unbounded" &&
            paneFocusSetup.optics.groundGlassCoverage.kind !== "neutral",
          coverageGain,
          naturalIlluminationGain,
          relativeIlluminanceGain,
          sourceFilmPointMm,
          displayTransform: {
            flipDisplayX: resolveGroundGlassRttDisplayTransform("raw").flipDisplayX,
            flipDisplayY: resolveGroundGlassRttDisplayTransform("raw").flipDisplayY,
          },
        },
        sharedCompositePasses: totalCompositePasses,
      },
      resources: {
        resolution: [WIDTH, HEIGHT],
        targetCount: bundle.targets.length,
        sceneRadianceTargets: {
          count: 2,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(directRadianceTarget.texture.format),
          type: formatName(directRadianceTarget.texture.type),
          colorSpace: colorSpaceName(directRadianceTarget.texture.colorSpace),
          toneMapping: "NoToneMapping",
        },
        worldPositionTargets: {
          count: 2,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(directWorldPositionTarget.texture.format),
          type: formatName(directWorldPositionTarget.texture.type),
          colorSpace: colorSpaceName(directWorldPositionTarget.texture.colorSpace),
          filter: formatName(directWorldPositionTarget.texture.magFilter),
        },
        paneMaskTarget: {
          dimensions: [WIDTH, HEIGHT],
          format: formatName(paneWorldPositionTarget.texture.format),
          type: formatName(paneWorldPositionTarget.texture.type),
        },
        paneWorldPositionTarget: targetDescriptor(paneWorldPositionTarget),
        visibilityDepthInput: {
          dimensions: [1, 1],
          format: formatName(visibilityDepth.format),
          type: formatName(visibilityDepth.type),
        },
        resolvedRadianceTargets: {
          count: 1,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(resolvedRadianceTarget.texture.format),
          type: formatName(resolvedRadianceTarget.texture.type),
          filter: formatName(resolvedRadianceTarget.texture.magFilter),
        },
        directContributionRadianceTarget: targetDescriptor(directContributionRadianceTarget),
        apparentPositionTargets: {
          count: 2,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(reflectedApparentPositionTarget.texture.format),
          type: formatName(reflectedApparentPositionTarget.texture.type),
        },
        cocTargets: {
          count: 2,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(directLayer.cocTarget.texture.format),
          type: formatName(directLayer.cocTarget.texture.type),
          storageFormat: directLayer.cocStorageFormat,
        },
        gatherTargets: {
          count: 4,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(directLayer.farTarget.texture.format),
          type: formatName(directLayer.farTarget.texture.type),
          filter: formatName(directLayer.farTarget.texture.magFilter),
        },
        focusedTargets: {
          count: 2,
          dimensions: [WIDTH, HEIGHT],
          format: formatName(directLayer.focusedTarget.texture.format),
          type: formatName(directLayer.focusedTarget.texture.type),
          filter: formatName(directLayer.focusedTarget.texture.magFilter),
        },
        combinedRadianceTarget: {
          dimensions: [WIDTH, HEIGHT],
          format: formatName(combinedRadianceTarget.texture.format),
          type: formatName(combinedRadianceTarget.texture.type),
          colorSpace: colorSpaceName(combinedRadianceTarget.texture.colorSpace),
          toneMapping: "NoToneMapping",
        },
        finalDisplayTarget: {
          dimensions: [WIDTH, HEIGHT],
          format: formatName(finalDisplayTarget.texture.format),
          type: formatName(finalDisplayTarget.texture.type),
        },
        nominalTexelPayloadBytes: nominalPayload,
        passCounts: {
          directSceneRenders: totalDirectSceneRenders,
          planarReflectionSceneRenders: totalPlanarSceneRenders,
          worldPositionSceneRenders: totalWorldPositionSceneRenders,
          paneMaskRenders: totalPaneMaskRenders,
          fullScreenMappingResolves: totalMappingResolves,
          radianceValidityMaskPasses: totalRadianceValidityMaskPasses,
          cocPasses: totalCocPasses,
          cocDecodeDiagnostics: totalCocDiagnostics,
          gatherPasses: totalGatherPasses,
          focusResolvePasses: totalFocusResolvePasses,
          linearRadianceSums: totalRadianceSums,
          sharedCompositePasses: totalCompositePasses,
        },
        rendererTextureCountBeforeDispose: renderer.info.memory.textures,
        invalidPositionRadianceViolations: 0,
        lifecycle: lifecycleEvidence(bundle, false),
      },
      production: {
        passOrder: GROUND_GLASS_PASS_ORDER,
      },
      fixtureConfiguration: {
        reflectionWeight: REFLECTION_WEIGHT,
      },
      planarCapture: {
        cameraSideClippingPassed: selectedClippingPassed,
      },
    };
    textureCountBeforeDispose = renderer.info.memory.textures;
  } catch (error) {
    proofFailed = true;
    proofError = error;
  } finally {
    const attemptCleanup = (operation: () => void): void => {
      try {
        operation();
      } catch (error) {
        cleanupErrors.push(error);
      }
    };
    attemptCleanup(() => restoreRendererState(renderer, rendererState));
    attemptCleanup(() => bundle.dispose());
    rendererDisposeCalled = true;
    attemptCleanup(() => renderer.dispose());
  }

  if (proofFailed || cleanupErrors.length > 0) {
    const errors = proofFailed ? [proofError, ...cleanupErrors] : cleanupErrors;
    throw new AggregateError(errors, "Planar focus proof or owned-resource teardown failed");
  }
  if (!proof) throw new Error("Planar focus reference produced no evidence");
  proof.resources.rendererTextureCountBeforeDispose = textureCountBeforeDispose;
  proof.resources.lifecycle = lifecycleEvidence(bundle, rendererDisposeCalled);
  return proof;
};

const bodyElement = document.body;
bodyElement.dataset.proofReady = "false";
try {
  const proof = runPlanarFocusReference();
  window.__architectureRisePlanarFocusProof = {
    ...proof,
    showCase: (id) => displayCase(id, proof),
  };
  displayCase("paneFocus", proof);
  document.querySelectorAll<HTMLButtonElement>("button[data-case]").forEach((button) => {
    button.addEventListener("click", () => displayCase(button.dataset.case as FocusCaseId, proof));
  });
  bodyElement.dataset.proofReady = "true";
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  bodyElement.dataset.proofError = message;
  const measurements = document.getElementById("measurements");
  if (measurements) measurements.textContent = `Proof failed: ${message}`;
  console.error("Architecture Rise planar focus proof failed", error);
}
