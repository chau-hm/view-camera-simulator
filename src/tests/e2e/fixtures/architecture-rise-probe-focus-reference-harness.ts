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
const PROBE_RESOLUTION = 128;
const PROBE_NEAR = 0.05;
const PROBE_FAR = 100;
const BASE_SHA = "3952bc1684db74693861e15cacd11fb2e7aefa1b";
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
  gpuRenderer: string;
  gpuVendor: string;
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
  halfFloatColorBufferExtension: string;
  halfFloatColorBufferSupported: boolean;
  colorCubeFramebufferStatuses: readonly string[];
  distanceCubeFramebufferStatuses: readonly string[];
  allCubeFacesFramebufferComplete: boolean;
  halfFloatLinearFilteringSupported: boolean;
  colorCubeFilter: "NearestFilter";
  distanceCubeFilter: "NearestFilter";
  cubeResolveReadbackStrategy: "samplerCube to RGBA32F 2D target, Float32Array readback";
};

type FloatBackendCapability = Omit<BackendCapability,
  | "halfFloatColorBufferExtension"
  | "halfFloatColorBufferSupported"
  | "colorCubeFramebufferStatuses"
  | "distanceCubeFramebufferStatuses"
  | "allCubeFacesFramebufferComplete"
  | "halfFloatLinearFilteringSupported"
  | "colorCubeFilter"
  | "distanceCubeFilter"
  | "cubeResolveReadbackStrategy"
>;

type ProbeOriginMetrics = {
  origin: PointTuple;
  planarSignFaceSampleCount: number;
  probeSameSignFaceHitCount: number;
  wrongObjectCount: number;
  noHitCount: number;
  sameSignFaceCoverage: number;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianQVirtualErrorM: number | null;
  p95QVirtualErrorM: number | null;
  medianFocusAxisErrorMm: number | null;
  p95FocusAxisErrorMm: number | null;
  medianAngularParallaxDeg: number | null;
  p95AngularParallaxDeg: number | null;
  maximumAdjacent2x2SignCluster: number;
};

type DistanceCubeCpuIterationMetrics = {
  iterations: number;
  sampleCount: number;
  sameTargetFaceHitCount: number;
  wrongObjectCount: number;
  noHitCount: number;
  sameTargetFaceCoverage: number;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianQVirtualErrorM: number | null;
  p95QVirtualErrorM: number | null;
  medianAngularParallaxDeg: number | null;
  p95AngularParallaxDeg: number | null;
  medianFocusAxisErrorMm: number | null;
  p95FocusAxisErrorMm: number | null;
  medianFinalDirectionChangeDeg: number | null;
  p95FinalDirectionChangeDeg: number | null;
  invalidDuringIterationCount: number;
  oscillatingSampleCount: number;
  notStabilizedAfterFinalIterationCount: number;
  samples: readonly DistanceCubeCpuSampleResult[];
  namedSample: {
    pane: string;
    uv: { u: number; v: number };
    q: PointTuple | null;
    qVirtual: PointTuple | null;
    qErrorM: number | null;
    qVirtualErrorM: number | null;
    angularParallaxDeg: number | null;
    projectedVirtualImageDisplacementPx: number | null;
    focusAxisDistanceMm: number | null;
    focusAxisErrorMm: number | null;
    roundedFocusControlMm: number | null;
  };
};

type DistanceCubeCpuSampleResult = {
  pane: string;
  row: number;
  column: number;
  u: number;
  v: number;
  panePoint: PointTuple;
  paneNormal: PointTuple;
  planarQ: PointTuple;
  planarQVirtual: PointTuple;
  q: PointTuple | null;
  qVirtual: PointTuple | null;
  hitObject: string | null;
  qErrorM: number | null;
  qVirtualErrorM: number | null;
  angularParallaxDeg: number | null;
  focusAxisErrorMm: number | null;
  finalDirectionChangeDeg: number | null;
  invalidDuringIteration: boolean;
  oscillated: boolean;
};

type DistanceCubeGpuSampleResult = {
  pane: string;
  row: number;
  column: number;
  u: number;
  v: number;
  q: PointTuple | null;
  qVirtual: PointTuple | null;
  hitObject: string | null;
  qErrorM: number | null;
  qVirtualErrorM: number | null;
  cpuToGpuQErrorM: number | null;
  cpuToGpuQVirtualErrorM: number | null;
  angularParallaxDeg: number | null;
  focusAxisErrorMm: number | null;
};

type DistanceCubeGpuCorrectionStudy = {
  iterations: number;
  sampleCount: number;
  sameTargetFaceHitCount: number;
  wrongObjectCount: number;
  noHitCount: number;
  sameTargetFaceCoverage: number;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianQVirtualErrorM: number | null;
  p95QVirtualErrorM: number | null;
  medianAngularParallaxDeg: number | null;
  p95AngularParallaxDeg: number | null;
  medianFocusAxisErrorMm: number | null;
  p95FocusAxisErrorMm: number | null;
  medianCpuToGpuQErrorM: number | null;
  p95CpuToGpuQErrorM: number | null;
  medianCpuToGpuQVirtualErrorM: number | null;
  p95CpuToGpuQVirtualErrorM: number | null;
  samples: readonly DistanceCubeGpuSampleResult[];
  extraDistanceCubeSamplesPerOutputPixel: number;
  extraDistanceCubeSamplesPerPanePixelAcrossBothMappingOutputsPerFocusCase: number;
  extraColorCubeSamplesPerPanePixelPerFocusCase: number;
  additionalCandidateFullscreenPasses: number;
  regionDiagnosticFullscreenPasses: number;
  regionDiagnosticFramebufferStatus: string;
  regionDiagnosticReadbackArrayType: "Float32Array";
  regionDiagnosticResources: {
    panePositionTexture: { dimensions: readonly [number, number]; format: string; type: string; filter: string };
    paneNormalTexture: { dimensions: readonly [number, number]; format: string; type: string; filter: string };
    correctedPointTarget: { dimensions: readonly [number, number]; format: string; type: string; filter: string };
    shaderMaterialCount: number;
  };
};

type DistanceCubeCpuCorrectionStudy = {
  method: "ideal infinite-resolution radial-distance raycasts";
  probeOrigin: PointTuple;
  physicalRayProjectionOnly: true;
  comparisonAuthority: "Planar Q/Q_virtual used only after final Probe ray hit";
  directionStabilityThresholdDeg: number;
  iterations: readonly DistanceCubeCpuIterationMetrics[];
};

type ProbeProof = {
  baseSha: string;
  backend: BackendCapability;
  sample: {
    pane: string;
    uv: { u: number; v: number };
    panePoint: PointTuple;
    normal: PointTuple;
    reflectedDirection: PointTuple;
    planarQ: PointTuple;
    planarQVirtual: PointTuple;
    probeOrigin: PointTuple;
    probeCpuQ: PointTuple;
    probeGpuQ: PointTuple;
    probeCpuQVirtual: PointTuple;
    probeGpuQVirtual: PointTuple;
    probeCpuHitObject: string;
    probeGpuQInsideSignFace: boolean;
    sourcePixel: { x: number; yBottom: number };
    paneMaskActive: boolean;
    paneWorldPosition: PointTuple;
    directWorldPosition: PointTuple;
    probeRadiance: PointTuple;
    qErrorDecompositionM: {
      planarToProbeCpu: number;
      probeCpuToProbeGpu: number;
      probeGpuToPlanar: number;
      planarToProbeCpuVirtual: number;
      probeCpuToProbeGpuVirtual: number;
      probeGpuToPlanarVirtual: number;
    };
    focusAxis: {
      planarMm: number;
      probeCpuMm: number;
      probeGpuMm: number;
      absoluteProbeErrorMm: number;
      roundedProbeFocusMm: number;
      roundedControlOffsetMm: number;
    };
    angularParallaxDeg: number;
    projectedVirtualImageDisplacementPx: number;
  };
  originStudy: {
    planarSignFaceSampleCount: number;
    allPaneSampleCount: number;
    maximumAdjacent2x2SignCluster: number;
    boundedRegionM: { min: PointTuple; max: PointTuple };
    candidateCount: number;
    historical: ProbeOriginMetrics;
    selected: ProbeOriginMetrics;
    rankedCandidates: readonly ProbeOriginMetrics[];
  };
  distanceCubeCpuCorrectionStudy?: DistanceCubeCpuCorrectionStudy;
  distanceCubeGpuCorrectionStudy?: DistanceCubeGpuCorrectionStudy;
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
      probeColorCubeFaceRenders: number;
      probeDistanceCubeFaceRenders: number;
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
    probeColorCube: { resolution: number; faces: number; format: string; type: string; colorSpace: string; filter: string; nominalTexelPayloadBytes: number };
    probeDistanceCube: { resolution: number; faces: number; format: string; type: string; colorSpace: string; filter: string; nominalTexelPayloadBytes: number };
    probeCaptureNominalTexelPayloadBytes: number;
    probeCaptureRenders: { colorFaces: number; distanceFaces: number; total: number; recapturesForFocusChange: number };
  };
  production: {
    passOrder: readonly string[];
  };
  fixtureConfiguration: {
    reflectionWeight: number;
  };
  probeCapture: {
    origin: PointTuple;
    excludedGlazingNames: readonly string[];
    colorFaceFramebufferStatuses: readonly string[];
    distanceFaceFramebufferStatuses: readonly string[];
    allFacesComplete: boolean;
    colorSamplingFilter: "NearestFilter";
    distanceSamplingFilter: "NearestFilter";
    localBackgroundIncluded: false;
    captureToneMapping: "NoToneMapping";
    captureReusedAcrossFocusStates: true;
  };
};

declare global {
  interface Window {
    __architectureRiseProbeFocusProof?: ProbeProof & { showCase: (id: FocusCaseId) => void };
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
        throw new AggregateError(errors, "One or more Probe fixture resources failed to dispose");
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

const makeProbeCubeTarget = (bundle: OwnedBundle): THREE.WebGLCubeRenderTarget => {
  const target = new THREE.WebGLCubeRenderTarget(PROBE_RESOLUTION, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return registerOwnedTarget(bundle, target) as THREE.WebGLCubeRenderTarget;
};

const verifyProbeCubeCapability = (
  renderer: THREE.WebGLRenderer,
  colorTarget: THREE.WebGLCubeRenderTarget,
  distanceTarget: THREE.WebGLCubeRenderTarget,
): Pick<BackendCapability,
  | "halfFloatColorBufferExtension"
  | "halfFloatColorBufferSupported"
  | "colorCubeFramebufferStatuses"
  | "distanceCubeFramebufferStatuses"
  | "allCubeFacesFramebufferComplete"
  | "halfFloatLinearFilteringSupported"
  | "colorCubeFilter"
  | "distanceCubeFilter"
  | "cubeResolveReadbackStrategy"
> => {
  const gl = renderer.getContext();
  const extensionName = "EXT_color_buffer_float";
  const extensionSupported = Boolean(gl.getExtension(extensionName));
  if (!renderer.capabilities.isWebGL2 || !extensionSupported) {
    throw new Error(
      `RGBA16F cubemap proof requires WebGL2 and ${extensionName}; ` +
      `webgl2=${renderer.capabilities.isWebGL2}, extension=${extensionSupported}`,
    );
  }
  for (const [label, target] of [["color", colorTarget], ["distance", distanceTarget]] as const) {
    if (
      target.width !== PROBE_RESOLUTION || target.height !== PROBE_RESOLUTION ||
      target.texture.format !== THREE.RGBAFormat || target.texture.type !== THREE.HalfFloatType ||
      target.texture.colorSpace !== THREE.NoColorSpace ||
      target.texture.minFilter !== THREE.NearestFilter || target.texture.magFilter !== THREE.NearestFilter
    ) throw new Error(`${label} cube target does not match the required linear RGBA16F nearest-sampled contract`);
  }

  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMipmap = renderer.getActiveMipmapLevel();
  const faceStatuses = (target: THREE.WebGLCubeRenderTarget, label: string): string[] => {
    const statuses: string[] = [];
    for (let face = 0; face < 6; face += 1) {
      renderer.setRenderTarget(target, face);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const encoded = `0x${status.toString(16)}`;
      statuses.push(encoded);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`${label} RGBA16F cube face ${face} framebuffer is incomplete (${encoded})`);
      }
    }
    return statuses;
  };
  let colorCubeFramebufferStatuses: string[] = [];
  let distanceCubeFramebufferStatuses: string[] = [];
  try {
    colorCubeFramebufferStatuses = faceStatuses(colorTarget, "Color");
    distanceCubeFramebufferStatuses = faceStatuses(distanceTarget, "Radial-distance");
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousMipmap);
  }
  const halfFloatLinearFilteringSupported = Boolean(
    gl.getExtension("OES_texture_float_linear") || gl.getExtension("OES_texture_half_float_linear"),
  );
  const allCubeFacesFramebufferComplete =
    colorCubeFramebufferStatuses.length === 6 &&
    distanceCubeFramebufferStatuses.length === 6 &&
    colorCubeFramebufferStatuses.every((status) => status === "0x8cd5") &&
    distanceCubeFramebufferStatuses.every((status) => status === "0x8cd5");
  if (!allCubeFacesFramebufferComplete) throw new Error("All twelve RGBA16F cube faces must be framebuffer-complete");
  return {
    halfFloatColorBufferExtension: extensionName,
    halfFloatColorBufferSupported: extensionSupported,
    colorCubeFramebufferStatuses,
    distanceCubeFramebufferStatuses,
    allCubeFacesFramebufferComplete,
    halfFloatLinearFilteringSupported,
    colorCubeFilter: "NearestFilter",
    distanceCubeFilter: "NearestFilter",
    cubeResolveReadbackStrategy: "samplerCube to RGBA32F 2D target, Float32Array readback",
  };
};

const verifyFloatTargetCapability = (
  renderer: THREE.WebGLRenderer,
  bundle: OwnedBundle,
  quadScene: THREE.Scene,
  quadCamera: THREE.OrthographicCamera,
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>,
): FloatBackendCapability => {
  const gl = renderer.getContext();
  const extensionName = "EXT_color_buffer_float";
  const extensionSupported = Boolean(gl.getExtension(extensionName));
  if (!renderer.capabilities.isWebGL2 || !extensionSupported) {
    throw new Error(
      `Local Probe float radiance/position proof requires WebGL2 and ${extensionName}; ` +
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
  let capability: FloatBackendCapability | null = null;
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
    const debugRendererInfo = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_RENDERER_WEBGL: number;
      UNMASKED_VENDOR_WEBGL: number;
    } | null;
    capability = {
      renderer: "Three.js WebGLRenderer",
      gpuRenderer: String(gl.getParameter(debugRendererInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
      gpuVendor: String(gl.getParameter(debugRendererInfo?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR)),
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

type PaneReflectionSample = {
  paneName: string;
  row: number;
  column: number;
  u: number;
  v: number;
  panePoint: THREE.Vector3;
  normal: THREE.Vector3;
  reflectedDirection: THREE.Vector3;
  plane: THREE.Plane;
  planarQ: THREE.Vector3;
  planarQVirtual: THREE.Vector3;
  planarObjectName: string;
};

const PROBE_REGION_FRACTIONS = [0.1, 0.3, 0.7, 0.9] as const;

const isFrontGlazing = (mesh: THREE.Mesh): boolean =>
  mesh.name.startsWith("architecture-rise-facade-window-bay-") && mesh.name.endsWith("-glazing");

const createProbeSceneMeshes = (root: THREE.Group): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.visible && !object.name.endsWith("-glazing")) meshes.push(object);
  });
  return meshes;
};

const createPlanarSampleMeshes = (root: THREE.Group): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      !object.name.startsWith("architecture-rise-facade-window-bay-") &&
      !object.name.startsWith("architecture-rise-side-return-window-bay-")
    ) meshes.push(object);
  });
  return meshes;
};

const maxAdjacentSignCluster = (samples: readonly PaneReflectionSample[], signKeys: ReadonlySet<string>): number => {
  const paneNames = [...new Set(samples.map((sample) => sample.paneName))];
  let maximum = 0;
  for (const paneName of paneNames) {
    for (let row = 0; row < PROBE_REGION_FRACTIONS.length - 1; row += 1) {
      for (let column = 0; column < PROBE_REGION_FRACTIONS.length - 1; column += 1) {
        const keys = [
          `${paneName}|${row}|${column}`,
          `${paneName}|${row + 1}|${column}`,
          `${paneName}|${row}|${column + 1}`,
          `${paneName}|${row + 1}|${column + 1}`,
        ];
        maximum = Math.max(maximum, keys.filter((key) => signKeys.has(key)).length);
      }
    }
  }
  return maximum;
};

const collectPlanarSignSamples = (
  root: THREE.Group,
  lensOrigin: THREE.Vector3,
): { allPaneSampleCount: number; samples: PaneReflectionSample[] } => {
  root.updateMatrixWorld(true);
  const paneMeshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && isFrontGlazing(object)) paneMeshes.push(object);
  });
  const sceneMeshes = createPlanarSampleMeshes(root);
  const paneRay = new THREE.Raycaster();
  const reflectedRay = new THREE.Raycaster();
  const samples: PaneReflectionSample[] = [];
  let allPaneSampleCount = 0;

  for (const pane of paneMeshes) {
    pane.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(pane);
    const paneSize = bounds.getSize(new THREE.Vector3());
    for (let row = 0; row < PROBE_REGION_FRACTIONS.length; row += 1) {
      for (let column = 0; column < PROBE_REGION_FRACTIONS.length; column += 1) {
        const u = PROBE_REGION_FRACTIONS[column];
        const v = PROBE_REGION_FRACTIONS[row];
        const expectedPoint = new THREE.Vector3(
          bounds.min.x + u * paneSize.x,
          bounds.min.y + v * paneSize.y,
          bounds.min.z,
        );
        paneRay.set(lensOrigin, expectedPoint.clone().sub(lensOrigin).normalize());
        const paneHit = paneRay.intersectObject(pane, false)[0];
        if (!paneHit?.face) continue;
        allPaneSampleCount += 1;
        const normal = paneHit.face.normal.clone().applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(pane.matrixWorld),
        ).normalize();
        if (normal.dot(lensOrigin.clone().sub(paneHit.point)) < 0) normal.negate();
        const incident = paneHit.point.clone().sub(lensOrigin).normalize();
        const reflectedDirection = incident.clone().reflect(normal).normalize();
        reflectedRay.set(paneHit.point.clone().addScaledVector(reflectedDirection, 0.12), reflectedDirection);
        reflectedRay.near = 0;
        reflectedRay.far = 100;
        const planarHit = reflectedRay.intersectObjects(sceneMeshes, false)[0];
        if (!planarHit || planarHit.object.name !== TARGET_FACE_NAME) continue;
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, paneHit.point);
        const planarQVirtual = planarHit.point.clone().addScaledVector(
          normal,
          -2 * plane.distanceToPoint(planarHit.point),
        );
        samples.push({
          paneName: pane.name,
          row,
          column,
          u,
          v,
          panePoint: paneHit.point.clone(),
          normal,
          reflectedDirection,
          plane,
          planarQ: planarHit.point.clone(),
          planarQVirtual,
          planarObjectName: planarHit.object.name,
        });
      }
    }
  }
  return { allPaneSampleCount, samples };
};

const percentile = (values: readonly number[], fraction: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

const probeOriginMetrics = (
  origin: THREE.Vector3,
  samples: readonly PaneReflectionSample[],
  sceneMeshes: THREE.Mesh[],
  lensOrigin: THREE.Vector3,
  opticalAxis: THREE.Vector3,
): ProbeOriginMetrics => {
  const raycaster = new THREE.Raycaster();
  const qErrors: number[] = [];
  const qVirtualErrors: number[] = [];
  const focusErrors: number[] = [];
  const angularErrors: number[] = [];
  const signKeys = new Set<string>();
  let probeSameSignFaceHitCount = 0;
  let wrongObjectCount = 0;
  let noHitCount = 0;
  for (const sample of samples) {
    raycaster.set(origin, sample.reflectedDirection);
    raycaster.near = 0;
    raycaster.far = 100;
    const hit = raycaster.intersectObjects(sceneMeshes, false)[0];
    if (!hit) {
      noHitCount += 1;
      continue;
    }
    const isTargetFace = hit.object.name === TARGET_FACE_NAME;
    if (isTargetFace) {
      probeSameSignFaceHitCount += 1;
      signKeys.add(`${sample.paneName}|${sample.row}|${sample.column}`);
    } else {
      wrongObjectCount += 1;
    }
    const qVirtual = hit.point.clone().addScaledVector(
      sample.normal,
      -2 * sample.plane.distanceToPoint(hit.point),
    );
    qErrors.push(hit.point.distanceTo(sample.planarQ));
    qVirtualErrors.push(qVirtual.distanceTo(sample.planarQVirtual));
    const probeAxisMm = qVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
    const planarAxisMm = sample.planarQVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
    focusErrors.push(Math.abs(probeAxisMm - planarAxisMm));
    const paneToProbe = hit.point.clone().sub(sample.panePoint).normalize();
    angularErrors.push(THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(
      paneToProbe.dot(sample.reflectedDirection), -1, 1,
    ))));
  }
  return {
    origin: pointToTuple(origin),
    planarSignFaceSampleCount: samples.length,
    probeSameSignFaceHitCount,
    wrongObjectCount,
    noHitCount,
    sameSignFaceCoverage: samples.length > 0 ? probeSameSignFaceHitCount / samples.length : 0,
    medianQErrorM: percentile(qErrors, 0.5),
    p95QErrorM: percentile(qErrors, 0.95),
    medianQVirtualErrorM: percentile(qVirtualErrors, 0.5),
    p95QVirtualErrorM: percentile(qVirtualErrors, 0.95),
    medianFocusAxisErrorMm: percentile(focusErrors, 0.5),
    p95FocusAxisErrorMm: percentile(focusErrors, 0.95),
    medianAngularParallaxDeg: percentile(angularErrors, 0.5),
    p95AngularParallaxDeg: percentile(angularErrors, 0.95),
    maximumAdjacent2x2SignCluster: maxAdjacentSignCluster(samples, signKeys),
  };
};

const studyProbeOrigins = (
  root: THREE.Group,
  lensOrigin: THREE.Vector3,
  opticalAxis: THREE.Vector3,
): ProbeProof["originStudy"] => {
  const { allPaneSampleCount, samples } = collectPlanarSignSamples(root, lensOrigin);
  if (samples.length === 0) throw new Error("The current Planar sign sample set is empty");
  const sceneMeshes = createProbeSceneMeshes(root);
  const signFace = findMesh(root, TARGET_FACE_NAME);
  const signBounds = new THREE.Box3().setFromObject(signFace);
  const facade = findMesh(root, "architecture-rise-primary-facade");
  const facadeBounds = new THREE.Box3().setFromObject(facade);
  const paneBounds = new THREE.Box3().makeEmpty();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && isFrontGlazing(object)) paneBounds.union(new THREE.Box3().setFromObject(object));
  });
  const signSize = signBounds.getSize(new THREE.Vector3());
  const xPadding = Math.max(signSize.x, 0.35);
  const yPadding = Math.max(signSize.y * 0.5, 0.35);
  const zMinimum = signBounds.max.z + Math.max(0.35, signSize.z * 3);
  const zMaximum = Math.min(paneBounds.min.z, facadeBounds.min.z) - 0.35;
  if (zMaximum <= zMinimum) throw new Error("The derived open search corridor between sign and facade is empty");
  const regionMin = new THREE.Vector3(
    Math.min(signBounds.min.x, paneBounds.min.x) - xPadding,
    Math.max(signBounds.min.y - yPadding, lensOrigin.y - 0.75),
    zMinimum,
  );
  const regionMax = new THREE.Vector3(
    Math.max(signBounds.max.x, paneBounds.max.x) + xPadding,
    Math.min(signBounds.max.y + yPadding, lensOrigin.y + 3.0),
    zMaximum,
  );
  const solidBounds = sceneMeshes.map((mesh) => new THREE.Box3().setFromObject(mesh));
  const insideSolid = (origin: THREE.Vector3): boolean => solidBounds.some((bounds) => bounds.containsPoint(origin));
  const axisValues = (minimum: number, maximum: number, count: number): number[] =>
    Array.from({ length: count }, (_, index) => minimum + (maximum - minimum) * index / (count - 1));
  const candidates: THREE.Vector3[] = [];
  for (const x of axisValues(regionMin.x, regionMax.x, 5)) {
    for (const y of axisValues(regionMin.y, regionMax.y, 3)) {
      for (const z of axisValues(regionMin.z, regionMax.z, 4)) {
        const origin = new THREE.Vector3(x, y, z);
        if (!insideSolid(origin)) candidates.push(origin);
      }
    }
  }
  if (candidates.length === 0) throw new Error("No physically clear probe origins remained in the derived search region");
  const historicalOrigin = new THREE.Vector3(1.45, 8.8, 8.55);
  const historical = probeOriginMetrics(historicalOrigin, samples, sceneMeshes, lensOrigin, opticalAxis);
  const measured = candidates.map((origin) => ({
    origin,
    metrics: probeOriginMetrics(origin, samples, sceneMeshes, lensOrigin, opticalAxis),
  }));
  const ascending = (a: number | null, b: number | null): number =>
    (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
  measured.sort((a, b) =>
    b.metrics.probeSameSignFaceHitCount - a.metrics.probeSameSignFaceHitCount ||
    b.metrics.maximumAdjacent2x2SignCluster - a.metrics.maximumAdjacent2x2SignCluster ||
    ascending(a.metrics.p95QVirtualErrorM, b.metrics.p95QVirtualErrorM) ||
    ascending(a.metrics.p95FocusAxisErrorMm, b.metrics.p95FocusAxisErrorMm) ||
    ascending(a.metrics.p95AngularParallaxDeg, b.metrics.p95AngularParallaxDeg) ||
    ascending(a.metrics.p95QErrorM, b.metrics.p95QErrorM),
  );
  const selected = measured[0];
  if (selected.metrics.probeSameSignFaceHitCount < 10 || selected.metrics.maximumAdjacent2x2SignCluster < 3) {
    throw new Error(
      `SINGLE-PROBE GEOMETRY INADEQUATE: best clear origin retained ` +
      `${selected.metrics.probeSameSignFaceHitCount}/${samples.length} same-face samples and ` +
      `cluster ${selected.metrics.maximumAdjacent2x2SignCluster}/4`,
    );
  }
  return {
    planarSignFaceSampleCount: samples.length,
    allPaneSampleCount,
    maximumAdjacent2x2SignCluster: maxAdjacentSignCluster(samples, new Set(
      samples.map((sample) => `${sample.paneName}|${sample.row}|${sample.column}`),
    )),
    boundedRegionM: { min: pointToTuple(regionMin), max: pointToTuple(regionMax) },
    candidateCount: candidates.length,
    historical,
    selected: selected.metrics,
    rankedCandidates: measured.slice(0, 10).map(({ metrics }) => metrics),
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

const makeFloatDataTexture = (
  bundle: OwnedBundle,
  data: Float32Array,
  width: number,
  height: number,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
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

const PROBE_DISTANCE_CUBE_CORRECTION_GLSL = `
  bool resolveProbePoint(
    samplerCube tProbeDistance,
    vec3 panePosition,
    vec3 paneNormal,
    vec3 physicalReflectedDirection,
    vec3 probeOrigin,
    int correctionIterations,
    out vec3 correctedDirection,
    out vec3 correctedPoint
  ){
    vec3 direction = normalize(physicalReflectedDirection);
    for(int iteration = 0; iteration < 8; iteration++){
      if(iteration >= correctionIterations) break;
      vec4 distanceSample = textureCube(tProbeDistance, direction);
      if(distanceSample.a < 0.5 || distanceSample.r <= 0.0) return false;
      vec3 sampledPoint = probeOrigin + direction * distanceSample.r;
      float rayDistance = dot(sampledPoint - panePosition, physicalReflectedDirection);
      vec3 pointOnPhysicalRay = panePosition + physicalReflectedDirection * max(rayDistance, 0.0001);
      vec3 originToProjectedPoint = pointOnPhysicalRay - probeOrigin;
      float directionLengthSquared = dot(originToProjectedPoint, originToProjectedPoint);
      if(directionLengthSquared <= 0.00000001) return false;
      direction = originToProjectedPoint * inversesqrt(directionLengthSquared);
    }
    vec4 finalDistanceSample = textureCube(tProbeDistance, direction);
    if(finalDistanceSample.a < 0.5 || finalDistanceSample.r <= 0.0) return false;
    correctedDirection = direction;
    correctedPoint = probeOrigin + direction * finalDistanceSample.r;
    return true;
  }
`;

const makeProbeMappingMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tPanePosition;
      uniform samplerCube tProbeRadiance;
      uniform samplerCube tProbeDistance;
      uniform vec3 lensCenterWorld;
      uniform vec3 paneNormalWorld;
      uniform vec3 probeOriginWorld;
      uniform float reflectionWeight;
      uniform int correctionIterations;
      uniform float outputApparentPosition;
      ${PROBE_DISTANCE_CUBE_CORRECTION_GLSL}
      void main(){
        vec4 pane = texture2D(tPanePosition, vUv);
        if(pane.a < 0.5){ gl_FragColor = vec4(0.0); return; }
        vec3 paneNormal = normalize(paneNormalWorld);
        vec3 incident = normalize(pane.xyz - lensCenterWorld);
        vec3 reflectedDirection = normalize(reflect(incident, paneNormal));
        vec3 correctedDirection;
        vec3 probePoint;
        if(!resolveProbePoint(
          tProbeDistance,
          pane.xyz,
          paneNormal,
          reflectedDirection,
          probeOriginWorld,
          correctionIterations,
          correctedDirection,
          probePoint
        )){ gl_FragColor = vec4(0.0); return; }
        vec3 virtualPoint = probePoint - 2.0 * paneNormal * dot(probePoint - pane.xyz, paneNormal);
        if(outputApparentPosition > 0.5){
          gl_FragColor = vec4(virtualPoint, 1.0);
        } else {
          vec4 radianceSample = textureCube(tProbeRadiance, correctedDirection);
          if(radianceSample.a < 0.5){ gl_FragColor = vec4(0.0); return; }
          gl_FragColor = vec4(radianceSample.rgb * reflectionWeight, 1.0);
        }
      }
    `,
    uniforms: {
      tPanePosition: { value: null },
      tProbeRadiance: { value: null },
      tProbeDistance: { value: null },
      lensCenterWorld: { value: new THREE.Vector3() },
      paneNormalWorld: { value: new THREE.Vector3(0, 0, -1) },
      probeOriginWorld: { value: new THREE.Vector3() },
      reflectionWeight: { value: REFLECTION_WEIGHT },
      correctionIterations: { value: 0 },
      outputApparentPosition: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeProbeCorrectionRegionDiagnosticMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tPanePosition;
      uniform sampler2D tPaneNormal;
      uniform samplerCube tProbeDistance;
      uniform vec3 lensCenterWorld;
      uniform vec3 probeOriginWorld;
      uniform int correctionIterations;
      ${PROBE_DISTANCE_CUBE_CORRECTION_GLSL}
      void main(){
        vec4 pane = texture2D(tPanePosition, vUv);
        vec4 normalSample = texture2D(tPaneNormal, vUv);
        if(pane.a < 0.5 || normalSample.a < 0.5){ gl_FragColor = vec4(0.0); return; }
        vec3 paneNormal = normalize(normalSample.xyz);
        vec3 incident = normalize(pane.xyz - lensCenterWorld);
        vec3 physicalReflectedDirection = normalize(reflect(incident, paneNormal));
        vec3 correctedDirection;
        vec3 correctedPoint;
        if(!resolveProbePoint(
          tProbeDistance,
          pane.xyz,
          paneNormal,
          physicalReflectedDirection,
          probeOriginWorld,
          correctionIterations,
          correctedDirection,
          correctedPoint
        )){ gl_FragColor = vec4(0.0); return; }
        gl_FragColor = vec4(correctedPoint, 1.0);
      }
    `,
    uniforms: {
      tPanePosition: { value: null },
      tPaneNormal: { value: null },
      tProbeDistance: { value: null },
      lensCenterWorld: { value: new THREE.Vector3() },
      probeOriginWorld: { value: new THREE.Vector3() },
      correctionIterations: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  bundle.materials.push(material);
  return material;
};

const makeRadialDistanceMaterial = (bundle: OwnedBundle): THREE.ShaderMaterial => {
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vWorldPosition;
      void main(){
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorldPosition;
      uniform vec3 probeOriginWorld;
      void main(){
        gl_FragColor = vec4(length(vWorldPosition - probeOriginWorld), 0.0, 0.0, 1.0);
      }
    `,
    uniforms: { probeOriginWorld: { value: new THREE.Vector3() } },
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
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

const runProbeCorrectionRegionGpuStudy = (input: {
  renderer: THREE.WebGLRenderer;
  bundle: OwnedBundle;
  fullscreen: ReturnType<typeof makeFullscreenScene>;
  samples: readonly PaneReflectionSample[];
  cpuReference: DistanceCubeCpuIterationMetrics;
  sceneMeshes: THREE.Mesh[];
  probeOrigin: THREE.Vector3;
  lensOrigin: THREE.Vector3;
  opticalAxis: THREE.Vector3;
  probeDistanceCube: THREE.WebGLCubeRenderTarget;
  iterations: number;
}): DistanceCubeGpuCorrectionStudy => {
  const {
    renderer,
    bundle,
    fullscreen,
    samples,
    cpuReference,
    sceneMeshes,
    probeOrigin,
    lensOrigin,
    opticalAxis,
    probeDistanceCube,
    iterations,
  } = input;
  const positions = new Float32Array(samples.length * 4);
  const normals = new Float32Array(samples.length * 4);
  samples.forEach((sample, index) => {
    const offset = index * 4;
    positions.set([...pointToTuple(sample.panePoint), 1], offset);
    normals.set([...pointToTuple(sample.normal), 1], offset);
  });
  const positionTexture = makeFloatDataTexture(bundle, positions, samples.length, 1);
  const normalTexture = makeFloatDataTexture(bundle, normals, samples.length, 1);
  const target = makeTarget(bundle, samples.length, 1, {
    type: THREE.FloatType,
    filter: THREE.NearestFilter,
  });
  const material = makeProbeCorrectionRegionDiagnosticMaterial(bundle);
  material.uniforms.tPanePosition.value = positionTexture;
  material.uniforms.tPaneNormal.value = normalTexture;
  material.uniforms.tProbeDistance.value = probeDistanceCube.texture;
  (material.uniforms.lensCenterWorld.value as THREE.Vector3).copy(lensOrigin);
  (material.uniforms.probeOriginWorld.value as THREE.Vector3).copy(probeOrigin);
  material.uniforms.correctionIterations.value = iterations;
  const previousTarget = renderer.getRenderTarget();
  let framebufferStatus = "not-checked";
  try {
    renderer.setRenderTarget(target);
    framebufferStatus = `0x${renderer.getContext().checkFramebufferStatus(renderer.getContext().FRAMEBUFFER).toString(16)}`;
  } finally {
    renderer.setRenderTarget(previousTarget);
  }
  if (framebufferStatus !== "0x8cd5") {
    throw new Error(`The Float32 correction-region target is not framebuffer-complete (${framebufferStatus})`);
  }
  drawFullscreen(renderer, target, material, fullscreen);
  const pixels = readFloatPixels(renderer, target);
  if (pixels.length !== samples.length * 4) throw new Error("Correction-region Float32 readback has an unexpected size");

  const cpuByIndex = cpuReference.samples;
  const raycaster = new THREE.Raycaster();
  const qErrors: number[] = [];
  const qVirtualErrors: number[] = [];
  const angularErrors: number[] = [];
  const focusAxisErrors: number[] = [];
  const cpuToGpuQErrors: number[] = [];
  const cpuToGpuQVirtualErrors: number[] = [];
  let sameTargetFaceHitCount = 0;
  let wrongObjectCount = 0;
  let noHitCount = 0;

  const gpuSamples: DistanceCubeGpuSampleResult[] = samples.map((sample, index) => {
    const offset = index * 4;
    const pixel = [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
    const cpuSample = cpuByIndex[index];
    if (!cpuSample) throw new Error(`CPU correction reference omitted region sample ${index}`);
    if (pixel[3] < 0.5 || !pixel.slice(0, 3).every(Number.isFinite)) {
      noHitCount += 1;
      return {
        pane: sample.paneName,
        row: sample.row,
        column: sample.column,
        u: sample.u,
        v: sample.v,
        q: null,
        qVirtual: null,
        hitObject: null,
        qErrorM: null,
        qVirtualErrorM: null,
        cpuToGpuQErrorM: null,
        cpuToGpuQVirtualErrorM: null,
        angularParallaxDeg: null,
        focusAxisErrorMm: null,
      };
    }

    const q = new THREE.Vector3(pixel[0], pixel[1], pixel[2]);
    const panePoint = sample.panePoint;
    const paneNormal = sample.normal;
    const qVirtual = q.clone().addScaledVector(
      paneNormal,
      -2 * q.clone().sub(panePoint).dot(paneNormal),
    );
    const probeDirection = q.clone().sub(probeOrigin);
    if (probeDirection.lengthSq() <= 1e-12) {
      noHitCount += 1;
      return {
        pane: sample.paneName,
        row: sample.row,
        column: sample.column,
        u: sample.u,
        v: sample.v,
        q: pointToTuple(q),
        qVirtual: pointToTuple(qVirtual),
        hitObject: null,
        qErrorM: null,
        qVirtualErrorM: null,
        cpuToGpuQErrorM: null,
        cpuToGpuQVirtualErrorM: null,
        angularParallaxDeg: null,
        focusAxisErrorMm: null,
      };
    }
    raycaster.set(probeOrigin, probeDirection.normalize());
    raycaster.near = 0;
    raycaster.far = PROBE_FAR;
    const hit = raycaster.intersectObjects(sceneMeshes, false)[0];
    if (!hit) noHitCount += 1;
    else if (hit.object.name === TARGET_FACE_NAME) sameTargetFaceHitCount += 1;
    else wrongObjectCount += 1;

    const qErrorM = q.distanceTo(sample.planarQ);
    const qVirtualErrorM = qVirtual.distanceTo(sample.planarQVirtual);
    const angularParallaxDeg = directionAngleDegrees(
      q.clone().sub(panePoint).normalize(),
      sample.reflectedDirection,
    );
    const focusAxisDistanceMm = qVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
    const planarFocusAxisDistanceMm = sample.planarQVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
    const focusAxisErrorMm = Math.abs(focusAxisDistanceMm - planarFocusAxisDistanceMm);
    const cpuToGpuQErrorM = cpuSample.q ? q.distanceTo(new THREE.Vector3(...cpuSample.q)) : null;
    const cpuToGpuQVirtualErrorM = cpuSample.qVirtual
      ? qVirtual.distanceTo(new THREE.Vector3(...cpuSample.qVirtual))
      : null;
    qErrors.push(qErrorM);
    qVirtualErrors.push(qVirtualErrorM);
    angularErrors.push(angularParallaxDeg);
    focusAxisErrors.push(focusAxisErrorMm);
    if (cpuToGpuQErrorM !== null) cpuToGpuQErrors.push(cpuToGpuQErrorM);
    if (cpuToGpuQVirtualErrorM !== null) cpuToGpuQVirtualErrors.push(cpuToGpuQVirtualErrorM);

    return {
      pane: sample.paneName,
      row: sample.row,
      column: sample.column,
      u: sample.u,
      v: sample.v,
      q: pointToTuple(q),
      qVirtual: pointToTuple(qVirtual),
      hitObject: hit?.object.name ?? null,
      qErrorM,
      qVirtualErrorM,
      cpuToGpuQErrorM,
      cpuToGpuQVirtualErrorM,
      angularParallaxDeg,
      focusAxisErrorMm,
    };
  });

  return {
    iterations,
    sampleCount: samples.length,
    sameTargetFaceHitCount,
    wrongObjectCount,
    noHitCount,
    sameTargetFaceCoverage: samples.length > 0 ? sameTargetFaceHitCount / samples.length : 0,
    medianQErrorM: percentile(qErrors, 0.5),
    p95QErrorM: percentile(qErrors, 0.95),
    medianQVirtualErrorM: percentile(qVirtualErrors, 0.5),
    p95QVirtualErrorM: percentile(qVirtualErrors, 0.95),
    medianAngularParallaxDeg: percentile(angularErrors, 0.5),
    p95AngularParallaxDeg: percentile(angularErrors, 0.95),
    medianFocusAxisErrorMm: percentile(focusAxisErrors, 0.5),
    p95FocusAxisErrorMm: percentile(focusAxisErrors, 0.95),
    medianCpuToGpuQErrorM: percentile(cpuToGpuQErrors, 0.5),
    p95CpuToGpuQErrorM: percentile(cpuToGpuQErrors, 0.95),
    medianCpuToGpuQVirtualErrorM: percentile(cpuToGpuQVirtualErrors, 0.5),
    p95CpuToGpuQVirtualErrorM: percentile(cpuToGpuQVirtualErrors, 0.95),
    samples: gpuSamples,
    extraDistanceCubeSamplesPerOutputPixel: iterations,
    extraDistanceCubeSamplesPerPanePixelAcrossBothMappingOutputsPerFocusCase: iterations * 2,
    extraColorCubeSamplesPerPanePixelPerFocusCase: 0,
    additionalCandidateFullscreenPasses: 0,
    regionDiagnosticFullscreenPasses: 1,
    regionDiagnosticFramebufferStatus: framebufferStatus,
    regionDiagnosticReadbackArrayType: "Float32Array",
    regionDiagnosticResources: {
      panePositionTexture: {
        dimensions: [positionTexture.image.width, positionTexture.image.height],
        format: formatName(positionTexture.format),
        type: formatName(positionTexture.type),
        filter: formatName(positionTexture.magFilter),
      },
      paneNormalTexture: {
        dimensions: [normalTexture.image.width, normalTexture.image.height],
        format: formatName(normalTexture.format),
        type: formatName(normalTexture.type),
        filter: formatName(normalTexture.magFilter),
      },
      correctedPointTarget: {
        dimensions: [target.width, target.height],
        format: formatName(target.texture.format),
        type: formatName(target.texture.type),
        filter: formatName(target.texture.magFilter),
      },
      shaderMaterialCount: 1,
    },
  };
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

const displayCase = (id: FocusCaseId, proof: ProbeProof): void => {
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

const DISTANCE_CUBE_CPU_ITERATIONS = [0, 1, 2, 4, 8] as const;
const DISTANCE_CUBE_DIRECTION_STABILITY_THRESHOLD_DEG = 0.01;
const DISTANCE_CUBE_RAY_EPSILON_M = 1e-4;

const directionAngleDegrees = (a: THREE.Vector3, b: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));

/**
 * CPU ideal study for the existing one-origin radial-distance representation.
 * Each distance lookup is a raycast from the fixed Probe origin. The Planar
 * points are read only after the final Probe hit, for error measurement.
 */
const studyDistanceCubeCpuCorrection = (
  probeOrigin: THREE.Vector3,
  samples: readonly PaneReflectionSample[],
  sceneMeshes: THREE.Mesh[],
  lensOrigin: THREE.Vector3,
  opticalAxis: THREE.Vector3,
  comparisonCamera: THREE.Camera,
): DistanceCubeCpuCorrectionStudy => {
  const iterationMetrics = DISTANCE_CUBE_CPU_ITERATIONS.map((iterations): DistanceCubeCpuIterationMetrics => {
    const qErrors: number[] = [];
    const qVirtualErrors: number[] = [];
    const angularErrors: number[] = [];
    const focusAxisErrors: number[] = [];
    const finalDirectionChanges: number[] = [];
    const sampleResults: DistanceCubeCpuSampleResult[] = [];
    let sameTargetFaceHitCount = 0;
    let wrongObjectCount = 0;
    let noHitCount = 0;
    let invalidDuringIterationCount = 0;
    let oscillatingSampleCount = 0;
    let notStabilizedAfterFinalIterationCount = 0;
    let namedSample: DistanceCubeCpuIterationMetrics["namedSample"] | null = null;

    for (const sample of samples) {
      let direction = sample.reflectedDirection.clone().normalize();
      const directionHistory = [direction.clone()];
      let lastDirectionChangeDeg: number | null = null;
      let becameInvalidDuringIteration = false;
      let oscillated = false;
      let invalid = false;

      // d_0 is the uncorrected PR Q direction. Each following radial sample
      // is raycast from O; only its projection scalar is evaluated from P.
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const distanceRay = new THREE.Raycaster(probeOrigin, direction);
        distanceRay.near = 0;
        distanceRay.far = PROBE_FAR;
        const distanceHit = distanceRay.intersectObjects(sceneMeshes, false)[0];
        if (!distanceHit) {
          invalid = true;
          becameInvalidDuringIteration = true;
          break;
        }

        const projectedDistance = distanceHit.point.clone()
          .sub(sample.panePoint)
          .dot(sample.reflectedDirection);
        const pointOnPhysicalRay = sample.panePoint.clone().addScaledVector(
          sample.reflectedDirection,
          Math.max(projectedDistance, DISTANCE_CUBE_RAY_EPSILON_M),
        );
        const nextDirection = pointOnPhysicalRay.sub(probeOrigin);
        if (!Number.isFinite(nextDirection.lengthSq()) || nextDirection.lengthSq() <= 1e-12) {
          invalid = true;
          becameInvalidDuringIteration = true;
          break;
        }
        nextDirection.normalize();
        lastDirectionChangeDeg = directionAngleDegrees(direction, nextDirection);

        if (directionHistory.length >= 2) {
          const twoStepsBack = directionHistory[directionHistory.length - 2];
          const returnsToPreviousDirection = directionAngleDegrees(twoStepsBack, nextDirection) <=
            DISTANCE_CUBE_DIRECTION_STABILITY_THRESHOLD_DEG;
          const stepRemainsMaterial = lastDirectionChangeDeg > DISTANCE_CUBE_DIRECTION_STABILITY_THRESHOLD_DEG;
          if (returnsToPreviousDirection && stepRemainsMaterial) oscillated = true;
        }

        direction = nextDirection;
        directionHistory.push(direction.clone());
      }

      let finalHit: THREE.Intersection<THREE.Object3D> | undefined;
      if (!invalid) {
        const finalRay = new THREE.Raycaster(probeOrigin, direction);
        finalRay.near = 0;
        finalRay.far = PROBE_FAR;
        finalHit = finalRay.intersectObjects(sceneMeshes, false)[0];
      }
      if (becameInvalidDuringIteration) invalidDuringIterationCount += 1;
      if (oscillated) oscillatingSampleCount += 1;
      if (iterations > 0 && lastDirectionChangeDeg !== null) {
        finalDirectionChanges.push(lastDirectionChangeDeg);
        if (lastDirectionChangeDeg > DISTANCE_CUBE_DIRECTION_STABILITY_THRESHOLD_DEG) {
          notStabilizedAfterFinalIterationCount += 1;
        }
      }

      if (!finalHit) {
        noHitCount += 1;
        sampleResults.push({
          pane: sample.paneName,
          row: sample.row,
          column: sample.column,
          u: sample.u,
          v: sample.v,
          panePoint: pointToTuple(sample.panePoint),
          paneNormal: pointToTuple(sample.normal),
          planarQ: pointToTuple(sample.planarQ),
          planarQVirtual: pointToTuple(sample.planarQVirtual),
          q: null,
          qVirtual: null,
          hitObject: null,
          qErrorM: null,
          qVirtualErrorM: null,
          angularParallaxDeg: null,
          focusAxisErrorMm: null,
          finalDirectionChangeDeg: lastDirectionChangeDeg,
          invalidDuringIteration: becameInvalidDuringIteration,
          oscillated,
        });
        if (
          sample.paneName === TARGET_PANE_NAME &&
          Math.abs(sample.u - PANE_U) < 1e-9 &&
          Math.abs(sample.v - PANE_V) < 1e-9
        ) {
          namedSample = {
            pane: sample.paneName,
            uv: { u: sample.u, v: sample.v },
            q: null,
            qVirtual: null,
            qErrorM: null,
            qVirtualErrorM: null,
            angularParallaxDeg: null,
            projectedVirtualImageDisplacementPx: null,
            focusAxisDistanceMm: null,
            focusAxisErrorMm: null,
            roundedFocusControlMm: null,
          };
        }
        continue;
      }

      const q = finalHit.point.clone();
      const qVirtual = q.clone().addScaledVector(
        sample.normal,
        -2 * sample.plane.distanceToPoint(q),
      );
      const qErrorM = q.distanceTo(sample.planarQ);
      const qVirtualErrorM = qVirtual.distanceTo(sample.planarQVirtual);
      const angularParallaxDeg = directionAngleDegrees(
        q.clone().sub(sample.panePoint).normalize(),
        sample.reflectedDirection,
      );
      const focusAxisDistanceMm = qVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
      const planarFocusAxisDistanceMm = sample.planarQVirtual.clone().sub(lensOrigin).dot(opticalAxis) * 1000;
      const focusAxisErrorMm = Math.abs(focusAxisDistanceMm - planarFocusAxisDistanceMm);
      qErrors.push(qErrorM);
      qVirtualErrors.push(qVirtualErrorM);
      angularErrors.push(angularParallaxDeg);
      focusAxisErrors.push(focusAxisErrorMm);
      sampleResults.push({
        pane: sample.paneName,
        row: sample.row,
        column: sample.column,
        u: sample.u,
        v: sample.v,
        panePoint: pointToTuple(sample.panePoint),
        paneNormal: pointToTuple(sample.normal),
        planarQ: pointToTuple(sample.planarQ),
        planarQVirtual: pointToTuple(sample.planarQVirtual),
        q: pointToTuple(q),
        qVirtual: pointToTuple(qVirtual),
        hitObject: finalHit.object.name,
        qErrorM,
        qVirtualErrorM,
        angularParallaxDeg,
        focusAxisErrorMm,
        finalDirectionChangeDeg: lastDirectionChangeDeg,
        invalidDuringIteration: becameInvalidDuringIteration,
        oscillated,
      });

      if (finalHit.object.name === TARGET_FACE_NAME) sameTargetFaceHitCount += 1;
      else wrongObjectCount += 1;

      if (
        sample.paneName === TARGET_PANE_NAME &&
        Math.abs(sample.u - PANE_U) < 1e-9 &&
        Math.abs(sample.v - PANE_V) < 1e-9
      ) {
        const planarUv = projectToUv(comparisonCamera, sample.planarQVirtual);
        const correctedUv = projectToUv(comparisonCamera, qVirtual);
        namedSample = {
          pane: sample.paneName,
          uv: { u: sample.u, v: sample.v },
          q: pointToTuple(q),
          qVirtual: pointToTuple(qVirtual),
          qErrorM,
          qVirtualErrorM,
          angularParallaxDeg,
          projectedVirtualImageDisplacementPx: Math.hypot(
            (correctedUv.x - planarUv.x) * WIDTH,
            (correctedUv.y - planarUv.y) * HEIGHT,
          ),
          focusAxisDistanceMm,
          focusAxisErrorMm: Math.abs(focusAxisDistanceMm - planarFocusAxisDistanceMm),
          roundedFocusControlMm: roundToStep(
            focusAxisDistanceMm,
            CAMERA_CONTROL_STEPS.focusDistanceMm,
          ),
        };
      }
    }

    if (!namedSample) throw new Error(`Distance-cube CPU study lost the named ${PANE_U}/${PANE_V} pane sample`);
    return {
      iterations,
      sampleCount: samples.length,
      sameTargetFaceHitCount,
      wrongObjectCount,
      noHitCount,
      sameTargetFaceCoverage: samples.length > 0 ? sameTargetFaceHitCount / samples.length : 0,
      medianQErrorM: percentile(qErrors, 0.5),
      p95QErrorM: percentile(qErrors, 0.95),
      medianQVirtualErrorM: percentile(qVirtualErrors, 0.5),
      p95QVirtualErrorM: percentile(qVirtualErrors, 0.95),
      medianAngularParallaxDeg: percentile(angularErrors, 0.5),
      p95AngularParallaxDeg: percentile(angularErrors, 0.95),
      medianFocusAxisErrorMm: percentile(focusAxisErrors, 0.5),
      p95FocusAxisErrorMm: percentile(focusAxisErrors, 0.95),
      medianFinalDirectionChangeDeg: percentile(finalDirectionChanges, 0.5),
      p95FinalDirectionChangeDeg: percentile(finalDirectionChanges, 0.95),
      invalidDuringIterationCount,
      oscillatingSampleCount,
      notStabilizedAfterFinalIterationCount,
      samples: sampleResults,
      namedSample,
    };
  });

  return {
    method: "ideal infinite-resolution radial-distance raycasts",
    probeOrigin: pointToTuple(probeOrigin),
    physicalRayProjectionOnly: true,
    comparisonAuthority: "Planar Q/Q_virtual used only after final Probe ray hit",
    directionStabilityThresholdDeg: DISTANCE_CUBE_DIRECTION_STABILITY_THRESHOLD_DEG,
    iterations: iterationMetrics,
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

const renderProbeCubeCapture = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  cubeCamera: THREE.CubeCamera,
  origin: THREE.Vector3,
  overrideMaterial: THREE.Material | null,
): number => {
  const previousOverride = scene.overrideMaterial;
  const previousBackground = scene.background;
  const previousAutoClear = renderer.autoClear;
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  const previousRender = renderer.render;
  const renderBound = previousRender.bind(renderer);
  let sceneRenderCount = 0;
  renderer.render = ((renderScene: THREE.Scene, camera: THREE.Camera) => {
    if (renderScene === scene) sceneRenderCount += 1;
    return renderBound(renderScene, camera);
  }) as typeof renderer.render;
  try {
    scene.overrideMaterial = overrideMaterial;
    scene.background = null;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    cubeCamera.position.copy(origin);
    cubeCamera.updateMatrixWorld(true);
    cubeCamera.update(renderer, scene);
  } finally {
    renderer.render = previousRender;
    scene.overrideMaterial = previousOverride;
    scene.background = previousBackground;
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.clippingPlanes = [];
    renderer.setRenderTarget(null);
  }
  if (sceneRenderCount !== 6) {
    throw new Error(`CubeCamera produced ${sceneRenderCount} actual scene renders; exactly six face renders were required`);
  }
  return sceneRenderCount;
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
  panePixel: ReturnType<typeof selectPanePixel>;
  panePositionPixels: Float32Array;
  directPositionPixels: Float32Array;
  mappedPositionPixels: Float32Array;
  mappedRadiancePixels: Float32Array;
  directRadiancePixels: Float32Array;
  directRayFirstHit: string;
  invalidPositionRadianceViolations: number;
};

const runProbeFocusReference = (): ProbeProof => {
  const query = new URLSearchParams(window.location.search);
  const correctionParameter = query.get("parallaxCorrectionIterations");
  const correctionIterations = correctionParameter === null ? 0 : Number(correctionParameter);
  if (!DISTANCE_CUBE_CPU_ITERATIONS.includes(correctionIterations as (typeof DISTANCE_CUBE_CPU_ITERATIONS)[number])) {
    throw new Error(`Unsupported distance-cube correction iteration count: ${correctionParameter}`);
  }
  const distanceCpuStudyRequested = query.get("cpuCorrectionStudy") === "1" || correctionParameter !== null;
  const canvas = document.getElementById("gpu-source") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Probe reference WebGL canvas is missing");
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
  let proof: ProbeProof | null = null;
  let distanceCubeCpuCorrectionStudy: DistanceCubeCpuCorrectionStudy | undefined;
  let distanceCubeGpuCorrectionStudy: DistanceCubeGpuCorrectionStudy | undefined;
  let correctionSamples: PaneReflectionSample[] | undefined;
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
    const probeMappingMaterial = makeProbeMappingMaterial(bundle);
    const radialDistanceMaterial = makeRadialDistanceMaterial(bundle);
    const radianceValidityMaskMaterial = makeRadianceValidityMaskMaterial(bundle);
    const radianceSumMaterial = makeRadianceSumMaterial(bundle);
    const compositeMaterial = makeCompositeMaterial(bundle);
    const cocDecodeMaterial = makeCocDecodeMaterial(bundle);

    const floatBackend = verifyFloatTargetCapability(
      renderer,
      bundle,
      fullscreen.scene,
      fullscreen.camera,
      fullscreen.quad,
    );
    const radianceFilter: THREE.MagnificationTextureFilter = floatBackend.radianceFilter === "LinearFilter"
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
    const probeSceneMeshes = createProbeSceneMeshes(subject);
    const visibilityDepth = makeDataTexture(bundle, new Uint8Array([255, 255, 255, 255]), 1, 1);

    const paneFocusDistanceMm = FOCUS_CASES.paneFocus;
    const paneFocusSetup = makeConfiguredGroundGlassCamera(paneFocusDistanceMm);
    const initialLensOrigin = paneFocusSetup.camera.getWorldPosition(new THREE.Vector3());
    const canonicalSample = getSignSample(subject, pane, initialLensOrigin);
    const opticalAxis = new THREE.Vector3(
      paneFocusSetup.optics.opticalAxis.direction.x,
      paneFocusSetup.optics.opticalAxis.direction.y,
      paneFocusSetup.optics.opticalAxis.direction.z,
    ).normalize();
    const originStudy = studyProbeOrigins(subject, initialLensOrigin, opticalAxis);
    const probeOrigin = new THREE.Vector3(...originStudy.selected.origin);
    const probeColorCubeTarget = makeProbeCubeTarget(bundle);
    const probeDistanceCubeTarget = makeProbeCubeTarget(bundle);
    const cubeCapability = verifyProbeCubeCapability(renderer, probeColorCubeTarget, probeDistanceCubeTarget);
    const backend: BackendCapability = { ...floatBackend, ...cubeCapability };

    const excludedGlazing: THREE.Mesh[] = [];
    subject.traverse((object) => {
      if (object instanceof THREE.Mesh && object.name.endsWith("-glazing")) excludedGlazing.push(object);
    });
    if (excludedGlazing.length === 0) throw new Error("Probe capture could not identify the scene glazing to exclude");
    const glazingVisibility = excludedGlazing.map((mesh) => mesh.visible);
    const colorCubeCamera = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, probeColorCubeTarget);
    const distanceCubeCamera = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, probeDistanceCubeTarget);
    radialDistanceMaterial.uniforms.probeOriginWorld.value.copy(probeOrigin);
    let probeColorCaptureRenders = 0;
    let probeDistanceCaptureRenders = 0;
    try {
      excludedGlazing.forEach((mesh) => { mesh.visible = false; });
      probeColorCaptureRenders = renderProbeCubeCapture(renderer, scene, colorCubeCamera, probeOrigin, null);
      probeDistanceCaptureRenders = renderProbeCubeCapture(
        renderer,
        scene,
        distanceCubeCamera,
        probeOrigin,
        radialDistanceMaterial,
      );
    } finally {
      excludedGlazing.forEach((mesh, index) => { mesh.visible = glazingVisibility[index]; });
      scene.overrideMaterial = null;
      scene.background = SKY_COLOR.clone();
      renderer.clippingPlanes = [];
    }
    if (probeColorCaptureRenders !== 6 || probeDistanceCaptureRenders !== 6) {
      throw new Error("Probe color and radial-distance captures must each render six cube faces");
    }

    const directRadianceTarget = makeRadianceTarget(bundle, radianceFilter, true);
    const directWorldPositionTarget = makePositionTarget(bundle, true);
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

      probeMappingMaterial.uniforms.tPanePosition.value = paneWorldPositionTarget.texture;
      probeMappingMaterial.uniforms.tProbeRadiance.value = probeColorCubeTarget.texture;
      probeMappingMaterial.uniforms.tProbeDistance.value = probeDistanceCubeTarget.texture;
      (probeMappingMaterial.uniforms.lensCenterWorld.value as THREE.Vector3).copy(cameraPosition);
      (probeMappingMaterial.uniforms.paneNormalWorld.value as THREE.Vector3).copy(sample.normal);
      (probeMappingMaterial.uniforms.probeOriginWorld.value as THREE.Vector3).copy(probeOrigin);
      probeMappingMaterial.uniforms.reflectionWeight.value = REFLECTION_WEIGHT;
      probeMappingMaterial.uniforms.correctionIterations.value = correctionIterations;
      probeMappingMaterial.uniforms.outputApparentPosition.value = 0;
      drawFullscreen(renderer, resolvedRadianceTarget, probeMappingMaterial, fullscreen);
      probeMappingMaterial.uniforms.outputApparentPosition.value = 1;
      drawFullscreen(renderer, reflectedApparentPositionTarget, probeMappingMaterial, fullscreen);
      const mappedRadiancePixels = readFloatPixels(renderer, resolvedRadianceTarget);
      const mappedPositionPixels = readFloatPixels(renderer, reflectedApparentPositionTarget);
      assertInvalidRadianceIsZero(mappedPositionPixels, mappedRadiancePixels, "Probe reflection contribution");

      const directRaycaster = new THREE.Raycaster(
        cameraPosition,
        sample.panePoint.clone().sub(cameraPosition).normalize(),
      );
      const directHits = directRaycaster.intersectObjects(sceneMeshes.concat([pane]), false);
      const directRayFirstHit = directHits[0]?.object.name ?? "<no-hit>";

      return {
        camera,
        optics,
        sample,
        plane: sample.plane,
        panePixel,
        panePositionPixels,
        directPositionPixels,
        mappedPositionPixels,
        mappedRadiancePixels,
        directRadiancePixels,
        directRayFirstHit,
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
    const totalProbeColorCubeFaceRenders = probeColorCaptureRenders;
    const totalProbeDistanceCubeFaceRenders = probeDistanceCaptureRenders;
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
    let selectedProbeRadiance: PointTuple = [0, 0, 0];
    let selectedPanePixel = { x: 0, yBottom: 0 };
    let selectedCamera: THREE.PerspectiveCamera | null = null;

    for (const [caseId, focusDistanceMm] of focusCaseInputs) {
      const setup = makeConfiguredGroundGlassCamera(focusDistanceMm);
      const lensOrigin = setup.camera.getWorldPosition(new THREE.Vector3());
      const sample = getSignSample(subject, pane, lensOrigin);
      const captured = mapContribution({ camera: setup.camera, optics: setup.optics, sample });
      capturedCases[caseId] = captured;
      totalDirectSceneRenders += 1;
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
          id: "architecture-rise-local-probe-reference",
          radianceSemantics: "preweighted-linear-radiance",
          radiance: resolvedRadianceTarget.texture,
          apparentWorldPosition: reflectedApparentPositionTarget.texture,
          gatherVisibilityDepth: visibilityDepth,
        }],
      );
      if (inputs.omittedOptionalIds.length !== 0 || inputs.contributions.length !== 2) {
        throw new Error("The renderer-local Probe reflection contribution was rejected");
      }

      const inputPositionById = new Map<string, THREE.Texture>([
        ["direct-pane-radiance", directWorldPositionTarget.texture],
        ["architecture-rise-local-probe-reference", reflectedApparentPositionTarget.texture],
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
      const reflectedCpu = physicalFootprintAt(setup.optics, virtualPosition);

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
        selectedPanePixel = captured.panePixel;
        selectedGpuQv = virtualPosition;
        selectedGpuQ = reflectPointAcrossPlane(virtualPosition, captured.plane);
        selectedProbeRadiance = [
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[0],
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[1],
          readFloatAt(captured.mappedRadiancePixels, selectedX, selectedY)[2],
        ];
      }
    }

    if (!selectedCamera) {
      throw new Error("The pane-focus Architecture Rise Probe reference was not captured");
    }

    const paneFocusCaptured = capturedCases.paneFocus;
    const reflectionFocusCaptured = capturedCases.reflectionFocus;
    if (!paneFocusCaptured || !reflectionFocusCaptured) throw new Error("A required focus case is missing");
    if (distanceCpuStudyRequested) {
      correctionSamples = collectPlanarSignSamples(subject, initialLensOrigin).samples;
      distanceCubeCpuCorrectionStudy = studyDistanceCubeCpuCorrection(
        probeOrigin,
        correctionSamples,
        probeSceneMeshes,
        initialLensOrigin,
        opticalAxis,
        selectedCamera,
      );
    }
    const activeCpuCorrectionIteration = distanceCubeCpuCorrectionStudy?.iterations.find(
      (iteration) => iteration.iterations === correctionIterations,
    );
    if (distanceCpuStudyRequested && !activeCpuCorrectionIteration) {
      throw new Error(`The selected correction count ${correctionIterations} has no CPU reference`);
    }
    const activeCpuNamedSample = activeCpuCorrectionIteration?.namedSample;
    let probeCpuQ: THREE.Vector3;
    let probeCpuQVirtual: THREE.Vector3;
    let probeCpuHitObject: string;
    let angularParallaxDeg: number;
    if (activeCpuNamedSample) {
      const namedCpuHit = activeCpuCorrectionIteration?.samples.find((sample) =>
        sample.pane === TARGET_PANE_NAME &&
        Math.abs(sample.u - PANE_U) < 1e-9 &&
        Math.abs(sample.v - PANE_V) < 1e-9,
      );
      if (!activeCpuNamedSample.q || !activeCpuNamedSample.qVirtual || !namedCpuHit?.hitObject) {
        throw new Error(`The CPU correction study has no valid named hit at iteration ${correctionIterations}`);
      }
      probeCpuQ = new THREE.Vector3(...activeCpuNamedSample.q);
      probeCpuQVirtual = new THREE.Vector3(...activeCpuNamedSample.qVirtual);
      probeCpuHitObject = namedCpuHit.hitObject;
      if (activeCpuNamedSample.angularParallaxDeg === null) {
        throw new Error(`The CPU correction study has no named angular parallax at iteration ${correctionIterations}`);
      }
      angularParallaxDeg = activeCpuNamedSample.angularParallaxDeg;
    } else {
      const namedProbeRay = new THREE.Raycaster(probeOrigin, canonicalSample.reflectedDirection);
      namedProbeRay.near = 0;
      namedProbeRay.far = PROBE_FAR;
      const namedProbeHit = namedProbeRay.intersectObjects(probeSceneMeshes, false)[0];
      if (!namedProbeHit) throw new Error("The selected local Probe has no radial-distance hit at the named pane sample");
      probeCpuQ = namedProbeHit.point.clone();
      probeCpuQVirtual = reflectPointAcrossPlane(probeCpuQ, canonicalSample.plane);
      probeCpuHitObject = namedProbeHit.object.name;
      const paneToProbeDirection = probeCpuQ.clone().sub(canonicalSample.panePoint).normalize();
      angularParallaxDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(
        paneToProbeDirection.dot(canonicalSample.reflectedDirection), -1, 1,
      )));
    }
    const planarFocusAxisDistanceMm = canonicalSample.virtualPoint.clone()
      .sub(initialLensOrigin)
      .dot(opticalAxis) * 1000;
    const probeCpuFocusAxisDistanceMm = probeCpuQVirtual.clone()
      .sub(initialLensOrigin)
      .dot(opticalAxis) * 1000;
    const probeGpuFocusAxisDistanceMm = selectedGpuQv.clone()
      .sub(initialLensOrigin)
      .dot(opticalAxis) * 1000;
    const roundedProbeFocusMm = roundToStep(
      probeGpuFocusAxisDistanceMm,
      CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
    if (!publicRange || roundedProbeFocusMm < publicRange.min || roundedProbeFocusMm > publicRange.max) {
      throw new Error(`Probe focus diagnostic ${roundedProbeFocusMm} mm is outside Architecture Rise's public focus range`);
    }
    const panePositionSample = pointFromTexture(
      paneFocusCaptured.panePositionPixels,
      selectedPanePixel.x,
      selectedPanePixel.yBottom,
      "Pane world-position mask",
    );
    const paneFocusMeasurement = focusCases.paneFocus;
    const faceBounds = new THREE.Box3().setFromObject(signFace);
    const gpuQInsideSignFace = faceBounds.distanceToPoint(selectedGpuQ) < 0.05;
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
    const directRayHitsSign = directPaneFirstHit.startsWith("architecture-rise-street-sign-");
    const paneToQPathClear = paneToQFirstHit === TARGET_FACE_NAME;
    if (!paneFocusMeasurement || directPaneFirstHit !== TARGET_PANE_NAME || directRayHitsSign || !paneToQPathClear) {
      throw new Error(
        `Direct/Planar reference ray safety regression: direct=${directPaneFirstHit}, reflected=${paneToQFirstHit}`,
      );
    }
    const planarProjection = projectToUv(selectedCamera, canonicalSample.virtualPoint);
    const probeProjection = projectToUv(selectedCamera, selectedGpuQv);
    const projectedVirtualImageDisplacementPx = Math.hypot(
      (probeProjection.x - planarProjection.x) * WIDTH,
      (probeProjection.y - planarProjection.y) * HEIGHT,
    );

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
    let nominalPayload = bundle.targets.reduce(
      (sum, target) => sum + target.width * target.height * bytesPerTexel(target.texture.type) *
        (target instanceof THREE.WebGLCubeRenderTarget ? 6 : 1),
      0,
    );
    const probeCubeFacePayloadBytes = PROBE_RESOLUTION * PROBE_RESOLUTION * bytesPerTexel(THREE.HalfFloatType);
    const probeColorCubePayloadBytes = probeCubeFacePayloadBytes * 6;
    const probeDistanceCubePayloadBytes = probeCubeFacePayloadBytes * 6;
    const targetDescriptor = (target: THREE.WebGLRenderTarget) => ({
      dimensions: [target.width, target.height] as const,
      format: formatName(target.texture.format),
      type: formatName(target.texture.type),
      colorSpace: colorSpaceName(target.texture.colorSpace),
      filter: formatName(target.texture.magFilter),
    });
    if (distanceCubeCpuCorrectionStudy && correctionSamples && correctionIterations > 0) {
      if (!activeCpuCorrectionIteration) throw new Error("The selected GPU correction count has no CPU reference");
      distanceCubeGpuCorrectionStudy = runProbeCorrectionRegionGpuStudy({
        renderer,
        bundle,
        fullscreen,
        samples: correctionSamples,
        cpuReference: activeCpuCorrectionIteration,
        sceneMeshes: probeSceneMeshes,
        probeOrigin,
        lensOrigin: initialLensOrigin,
        opticalAxis,
        probeDistanceCube: probeDistanceCubeTarget,
        iterations: correctionIterations,
      });
    }
    nominalPayload = bundle.targets.reduce(
      (sum, target) => sum + target.width * target.height * bytesPerTexel(target.texture.type) *
        (target instanceof THREE.WebGLCubeRenderTarget ? 6 : 1),
      0,
    );

    proof = {
      baseSha: BASE_SHA,
      backend,
      sample: {
        pane: TARGET_PANE_NAME,
        uv: { u: PANE_U, v: PANE_V },
        panePoint: pointToTuple(canonicalSample.panePoint),
        normal: pointToTuple(canonicalSample.normal),
        reflectedDirection: pointToTuple(canonicalSample.reflectedDirection),
        planarQ: pointToTuple(canonicalSample.realPoint),
        planarQVirtual: pointToTuple(canonicalSample.virtualPoint),
        probeOrigin: pointToTuple(probeOrigin),
        probeCpuQ: pointToTuple(probeCpuQ),
        probeGpuQ: pointToTuple(selectedGpuQ),
        probeCpuQVirtual: pointToTuple(probeCpuQVirtual),
        probeGpuQVirtual: pointToTuple(selectedGpuQv),
        probeCpuHitObject,
        probeGpuQInsideSignFace: gpuQInsideSignFace,
        sourcePixel: {
          x: selectedPanePixel.x,
          yBottom: selectedPanePixel.yBottom,
        },
        paneMaskActive: panePositionSample.distanceTo(canonicalSample.panePoint) < 0.035,
        paneWorldPosition: pointToTuple(panePositionSample),
        directWorldPosition: pointToTuple(paneFocusCaptured.panePixel.directPosition),
        probeRadiance: selectedProbeRadiance,
        qErrorDecompositionM: {
          planarToProbeCpu: probeCpuQ.distanceTo(canonicalSample.realPoint),
          probeCpuToProbeGpu: selectedGpuQ.distanceTo(probeCpuQ),
          probeGpuToPlanar: selectedGpuQ.distanceTo(canonicalSample.realPoint),
          planarToProbeCpuVirtual: probeCpuQVirtual.distanceTo(canonicalSample.virtualPoint),
          probeCpuToProbeGpuVirtual: selectedGpuQv.distanceTo(probeCpuQVirtual),
          probeGpuToPlanarVirtual: selectedGpuQv.distanceTo(canonicalSample.virtualPoint),
        },
        focusAxis: {
          planarMm: planarFocusAxisDistanceMm,
          probeCpuMm: probeCpuFocusAxisDistanceMm,
          probeGpuMm: probeGpuFocusAxisDistanceMm,
          absoluteProbeErrorMm: Math.abs(probeGpuFocusAxisDistanceMm - planarFocusAxisDistanceMm),
          roundedProbeFocusMm,
          roundedControlOffsetMm: roundedProbeFocusMm - reflectionFocusDistanceMm,
        },
        angularParallaxDeg,
        projectedVirtualImageDisplacementPx,
      },
      originStudy,
      ...(distanceCubeCpuCorrectionStudy ? { distanceCubeCpuCorrectionStudy } : {}),
      ...(distanceCubeGpuCorrectionStudy ? { distanceCubeGpuCorrectionStudy } : {}),
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
        reflectedId: "architecture-rise-local-probe-reference",
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
          probeColorCubeFaceRenders: totalProbeColorCubeFaceRenders,
          probeDistanceCubeFaceRenders: totalProbeDistanceCubeFaceRenders,
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
        probeColorCube: {
          resolution: PROBE_RESOLUTION,
          faces: 6,
          format: formatName(probeColorCubeTarget.texture.format),
          type: formatName(probeColorCubeTarget.texture.type),
          colorSpace: colorSpaceName(probeColorCubeTarget.texture.colorSpace),
          filter: formatName(probeColorCubeTarget.texture.magFilter),
          nominalTexelPayloadBytes: probeColorCubePayloadBytes,
        },
        probeDistanceCube: {
          resolution: PROBE_RESOLUTION,
          faces: 6,
          format: formatName(probeDistanceCubeTarget.texture.format),
          type: formatName(probeDistanceCubeTarget.texture.type),
          colorSpace: colorSpaceName(probeDistanceCubeTarget.texture.colorSpace),
          filter: formatName(probeDistanceCubeTarget.texture.magFilter),
          nominalTexelPayloadBytes: probeDistanceCubePayloadBytes,
        },
        probeCaptureNominalTexelPayloadBytes: probeColorCubePayloadBytes + probeDistanceCubePayloadBytes,
        probeCaptureRenders: {
          colorFaces: probeColorCaptureRenders,
          distanceFaces: probeDistanceCaptureRenders,
          total: probeColorCaptureRenders + probeDistanceCaptureRenders,
          recapturesForFocusChange: 0,
        },
      },
      production: {
        passOrder: GROUND_GLASS_PASS_ORDER,
      },
      fixtureConfiguration: {
        reflectionWeight: REFLECTION_WEIGHT,
      },
      probeCapture: {
        origin: pointToTuple(probeOrigin),
        excludedGlazingNames: excludedGlazing.map((mesh) => mesh.name),
        colorFaceFramebufferStatuses: backend.colorCubeFramebufferStatuses,
        distanceFaceFramebufferStatuses: backend.distanceCubeFramebufferStatuses,
        allFacesComplete: backend.allCubeFacesFramebufferComplete,
        colorSamplingFilter: backend.colorCubeFilter,
        distanceSamplingFilter: backend.distanceCubeFilter,
        localBackgroundIncluded: false,
        captureToneMapping: "NoToneMapping",
        captureReusedAcrossFocusStates: true,
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
    throw new AggregateError(errors, "Probe focus proof or owned-resource teardown failed");
  }
  if (!proof) throw new Error("Probe focus reference produced no evidence");
  proof.resources.rendererTextureCountBeforeDispose = textureCountBeforeDispose;
  proof.resources.lifecycle = lifecycleEvidence(bundle, rendererDisposeCalled);
  return proof;
};

const bodyElement = document.body;
bodyElement.dataset.proofReady = "false";
try {
  const proof = runProbeFocusReference();
  window.__architectureRiseProbeFocusProof = {
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
  console.error("Architecture Rise Probe focus proof failed", error);
}
