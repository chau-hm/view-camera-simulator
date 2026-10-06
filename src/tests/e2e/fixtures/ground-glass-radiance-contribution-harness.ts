import * as THREE from "three";
import {
  decodeGroundGlassFootprintAxesMm,
  decodeGroundGlassSignedCoCByte,
} from "../../../render/groundGlassCocTarget";
import {
  groundGlassApertureGatherFragmentShader,
  groundGlassApparentWorldPositionCocFragmentShader,
  groundGlassCompositeFragmentShader,
  groundGlassVertexShader,
} from "../../../render/groundGlassDofShaderSources";
import {
  bindGroundGlassDofStateToApparentWorldPositionCocMaterial,
  bindGroundGlassDofStateToGatherMaterial,
} from "../../../render/groundGlassShaderBindings";
import type { GroundGlassDofRenderState } from "../../../render/groundGlassDofRenderState";
import {
  resolveGroundGlassRadianceContributions,
  type GroundGlassRadianceContribution,
} from "../../../render/groundGlassRadianceContribution";

const WIDTH = 128;
const HEIGHT = 128;
const FOCAL_LENGTH_MM = 150;
const APERTURE_F_NUMBER = 2.8;
const FILM_WIDTH_MM = 127;
const FILM_HEIGHT_MM = 127;
const MAXIMUM_COC_MM = 20;
const MAXIMUM_FOOTPRINT_RADIUS_MM = 20;
const MAXIMUM_GATHER_RADIUS_PX = 16;
const SAMPLE_COUNT = 64;
const CAMERA_NEAR_M = 0.01;
const CAMERA_FAR_M = 5;
const RADIOMETRIC_PROBE_X = WIDTH >> 1;
const RADIOMETRIC_PROBE_Y = HEIGHT >> 1;
const RADIOMETRIC_PROBE_HALF_EXTENT = 5;
const RADIOMETRIC_PROBE_VALUE = 0.75;
const RADIOMETRIC_PROBE_TOLERANCE = 1e-4;

type FocusCaseId = "A" | "B" | "C";

type FocusMap = {
  radiance: THREE.DataTexture;
  worldPositions: THREE.DataTexture;
  visibilityDepth: THREE.DataTexture;
};

type ContributionLayer = {
  cocMaterial: THREE.ShaderMaterial;
  gatherMaterial: THREE.ShaderMaterial;
  resolveMaterial: THREE.ShaderMaterial;
  cocTarget: THREE.WebGLRenderTarget;
  farTarget: THREE.WebGLRenderTarget;
  nearTarget: THREE.WebGLRenderTarget;
  focusedTarget: THREE.WebGLRenderTarget;
};

type ContributionMeasurement = {
  id: string;
  centerSignedCoCDiameterMm: number;
  centerMajorRadiusMm: number;
  changedPixelsFromEqualFocusReference: number;
  displayHash: string;
};

type FocusCaseMeasurement = {
  focusDistanceMm: number;
  direct: ContributionMeasurement;
  secondary: ContributionMeasurement;
  combinedDisplayHash: string;
  singleContributionDisplayHash?: string;
  singleContributionPassCount?: number;
  contributionPassCount: number;
  cpuSubmitMs: number;
};

type RadiometricProbeMeasurement = {
  xPx: number;
  yPx: number;
  channel: "R";
  directFocusedValue: number;
  secondaryFocusedValue: number;
  expectedLinearSum: number;
  measuredCombinedLinearValue: number;
  combinedValueExceedsOne: boolean;
  tolerance: number;
  finalDisplayRedByte: number;
  legacyRgba8AccumulatorRedByte: number;
};

type FocusCaseImages = {
  direct: Uint8Array;
  secondary: Uint8Array;
  combined: Uint8Array;
};

declare global {
  interface Window {
    __groundGlassContributionProof?: {
      backend: string;
      floatingRadianceCapability: FloatingRadianceCapability;
      resourceSummary: {
        targetCount: number;
        cocTargets: { count: number; dimensions: readonly [number, number]; format: string; type: string };
        contributionRadianceTargets: {
          farCount: number;
          nearCount: number;
          focusedCount: number;
          dimensions: readonly [number, number];
          format: string;
          type: string;
          filter: string;
        };
        combinedRadianceTarget: { dimensions: readonly [number, number]; format: string; type: string };
        finalDisplayTarget: { dimensions: readonly [number, number]; format: string; type: string };
        legacyByteAccumulatorControl: { dimensions: readonly [number, number]; format: string; type: string };
        radianceInputTextures: { count: number; dimensions: readonly [number, number]; format: string; type: string };
        apparentPositionTextures: { count: number; dimensions: readonly [number, number]; format: string; type: string };
        visibilityDepthInput: { dimensions: readonly [number, number]; format: string; type: string };
        nominalTargetTexelBytes: number;
        nominalInputTexelBytes: number;
        fullResolutionPassesPerTwoContributionFrame: number;
        rendererTextureCount: number;
      };
      cases: Record<FocusCaseId, FocusCaseMeasurement>;
      radiometricProbe: RadiometricProbeMeasurement;
      showCase: (id: FocusCaseId) => void;
    };
  }
}

const makeTarget = (
  width: number,
  height: number,
  type: THREE.TextureDataType,
  filter: THREE.MagnificationTextureFilter,
): THREE.WebGLRenderTarget => {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return target;
};

const makeCocTarget = (): THREE.WebGLRenderTarget =>
  makeTarget(WIDTH, HEIGHT, THREE.UnsignedByteType, THREE.LinearFilter);

const makeRadianceTarget = (width = WIDTH, height = HEIGHT): THREE.WebGLRenderTarget =>
  makeTarget(width, height, THREE.FloatType, THREE.NearestFilter);

const makeDisplayTarget = (): THREE.WebGLRenderTarget =>
  makeTarget(WIDTH, HEIGHT, THREE.UnsignedByteType, THREE.LinearFilter);

const makeLegacyByteAccumulatorControl = (): THREE.WebGLRenderTarget =>
  makeTarget(1, 1, THREE.UnsignedByteType, THREE.NearestFilter);

type FloatingRadianceCapability = {
  webgl2: boolean;
  extensionName: string;
  extensionSupported: boolean;
  framebufferComplete: boolean;
  framebufferStatus: string;
  readbackArrayType: "Float32Array";
};

const verifyFloatRadianceTargetCapability = (
  renderer: THREE.WebGLRenderer,
): FloatingRadianceCapability => {
  const gl = renderer.getContext();
  const extensionName = "EXT_color_buffer_float";
  const extensionSupported = Boolean(gl.getExtension(extensionName));
  if (!renderer.capabilities.isWebGL2 || !extensionSupported) {
    throw new Error(
      `Float32 radiance targets require WebGL2 and ${extensionName}; ` +
      `webgl2=${renderer.capabilities.isWebGL2}, extension=${extensionSupported}`,
    );
  }

  const probeTarget = makeRadianceTarget(2, 2);
  let framebufferStatus = "not-checked";
  try {
    renderer.setRenderTarget(probeTarget);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    framebufferStatus = `0x${status.toString(16)}`;
    const framebufferComplete = status === gl.FRAMEBUFFER_COMPLETE;
    if (!framebufferComplete) {
      throw new Error(
        `Float32 radiance framebuffer is incomplete: ${framebufferStatus}`,
      );
    }
    return {
      webgl2: renderer.capabilities.isWebGL2,
      extensionName,
      extensionSupported,
      framebufferComplete,
      framebufferStatus,
      readbackArrayType: "Float32Array",
    };
  } finally {
    renderer.setRenderTarget(null);
    probeTarget.dispose();
  }
};

const makeDataTexture = (
  data: Uint8Array | Float32Array,
  width: number,
  height: number,
  type: THREE.TextureDataType,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
};

const makePattern = (kind: "direct" | "secondary"): THREE.DataTexture => {
  const data = new Float32Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      const diagonal = ((x + 2 * y) % 12) < 6;
      const level = (kind === "direct" ? checker ? 0.82 : 0.08 : diagonal ? 0.68 : 0.06);
      const offset = (y * WIDTH + x) * 4;
      if (kind === "direct") data[offset] = level;
      else {
        data[offset + 1] = level;
        data[offset + 2] = level;
      }
      data[offset + 3] = 1;
    }
  }
  for (
    let y = RADIOMETRIC_PROBE_Y - RADIOMETRIC_PROBE_HALF_EXTENT;
    y < RADIOMETRIC_PROBE_Y + RADIOMETRIC_PROBE_HALF_EXTENT;
    y += 1
  ) {
    for (
      let x = RADIOMETRIC_PROBE_X - RADIOMETRIC_PROBE_HALF_EXTENT;
      x < RADIOMETRIC_PROBE_X + RADIOMETRIC_PROBE_HALF_EXTENT;
      x += 1
    ) {
      const offset = (y * WIDTH + x) * 4;
      data[offset] = RADIOMETRIC_PROBE_VALUE;
      if (kind === "secondary") {
        data[offset + 1] = 0;
        data[offset + 2] = 0;
      }
    }
  }
  return makeDataTexture(data, WIDTH, HEIGHT, THREE.FloatType);
};

const makeApparentWorldPositionMap = (
  camera: THREE.PerspectiveCamera,
  objectDistanceM: number,
): THREE.DataTexture => {
  const data = new Float32Array(WIDTH * HEIGHT * 4);
  const projectedPoint = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const cameraOrigin = camera.position;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      projectedPoint
        .set(((x + 0.5) / WIDTH) * 2 - 1, ((y + 0.5) / HEIGHT) * 2 - 1, 0.5)
        .unproject(camera);
      rayDirection.copy(projectedPoint).sub(cameraOrigin).normalize();
      const rayScale = (objectDistanceM - cameraOrigin.z) / rayDirection.z;
      const worldX = cameraOrigin.x + rayDirection.x * rayScale;
      const worldY = cameraOrigin.y + rayDirection.y * rayScale;
      const worldZ = cameraOrigin.z + rayDirection.z * rayScale;
      const offset = (y * WIDTH + x) * 4;
      data[offset] = worldX;
      data[offset + 1] = worldY;
      data[offset + 2] = worldZ;
      data[offset + 3] = 1;
    }
  }
  return makeDataTexture(data, WIDTH, HEIGHT, THREE.FloatType);
};

const makeGatherVisibilityDepth = (): THREE.DataTexture =>
  // A constant fallback depth keeps this proof about independent focus, with
  // no cross-contribution occlusion inferred from the two apparent points.
  makeDataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.UnsignedByteType);

const imageDistanceForObjectMm = (objectDistanceMm: number): number =>
  (FOCAL_LENGTH_MM * objectDistanceMm) / (objectDistanceMm - FOCAL_LENGTH_MM);

const makeDofState = (
  camera: THREE.PerspectiveCamera,
  focusDistanceMm: number,
): GroundGlassDofRenderState => {
  const imageDistanceMm = imageDistanceForObjectMm(focusDistanceMm);
  const cocBoundaryPx = (0.1 * WIDTH) / FILM_WIDTH_MM;
  return {
    model: "parallel-thin-lens",
    camera: {
      inverseProjectionMatrixElements: Array.from(camera.projectionMatrixInverse.elements),
      worldMatrixElements: Array.from(camera.matrixWorld.elements),
    },
    lens: {
      centerWorldM: { x: 0, y: 0, z: 0 },
      planeNormal: { x: 0, y: 0, z: 1 },
      planeBasisX: { x: 1, y: 0, z: 0 },
      planeBasisY: { x: 0, y: 1, z: 0 },
    },
    film: {
      planePointWorldM: { x: 0, y: 0, z: -imageDistanceMm * 0.001 },
      planeNormal: { x: 0, y: 0, z: 1 },
      planeBasisX: { x: 1, y: 0, z: 0 },
      planeBasisY: { x: 0, y: 1, z: 0 },
      widthMm: FILM_WIDTH_MM,
      heightMm: FILM_HEIGHT_MM,
      sampledWidthMm: FILM_WIDTH_MM,
      sampledHeightMm: FILM_HEIGHT_MM,
    },
    focus: { plane: null, nearPlane: null, farPlane: null },
    optics: {
      imageDistanceMm,
      focalLengthMm: FOCAL_LENGTH_MM,
      apertureFNumber: APERTURE_F_NUMBER,
      acceptableCoCDiameterMm: 0.1,
    },
    render: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      maximumBlurRadiusPx: MAXIMUM_GATHER_RADIUS_PX,
      displayWidthPx: WIDTH,
    },
    physicalCoC: {
      boundaryDiameterPx: cocBoundaryPx,
      boundaryRadiusPx: cocBoundaryPx * 0.5,
      visibleBoundaryRadiusPx: cocBoundaryPx * 0.5,
    },
  };
};

const createDofUniforms = (): Record<string, THREE.IUniform> => ({
  near: { value: CAMERA_NEAR_M },
  far: { value: CAMERA_FAR_M },
  imageDistanceMm: { value: imageDistanceForObjectMm(1000) },
  focalLengthMm: { value: FOCAL_LENGTH_MM },
  fNumber: { value: APERTURE_F_NUMBER },
  renderWidth: { value: WIDTH },
  renderHeight: { value: HEIGHT },
  useRaw: { value: 0 },
  dofMode: { value: 0 },
  lensCenterWorld: { value: new THREE.Vector3(0, 0, 0) },
  lensPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  lensPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
  lensPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
  filmPlanePoint: { value: new THREE.Vector3(0, 0, -0.1764705882) },
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
  maximumCoCRadiusPx: { value: MAXIMUM_GATHER_RADIUS_PX },
  circleOfConfusionMm: { value: 0.1 },
  sampledFilmWidthMm: { value: FILM_WIDTH_MM },
  sampledFilmHeightMm: { value: FILM_HEIGHT_MM },
  sampleCount: { value: SAMPLE_COUNT },
  cocStorageEncoded: { value: 1 },
  cocStorageMaxMm: { value: MAXIMUM_COC_MM },
  footprintStorageMaxMm: { value: MAXIMUM_FOOTPRINT_RADIUS_MM },
});

const createLayerResolveMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tFar;
    uniform sampler2D tNear;
    void main(){
      vec4 farRadiance = texture2D(tFar, vUv);
      vec4 nearRadiance = texture2D(tNear, vUv);
      gl_FragColor = vec4(
        mix(farRadiance.rgb, nearRadiance.rgb, clamp(nearRadiance.a, 0.0, 1.0)),
        farRadiance.a
      );
    }
  `,
  uniforms: { tFar: { value: null }, tNear: { value: null } },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const createRadianceCombineMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tFirst;
    uniform sampler2D tSecond;
    void main(){
      vec4 first = texture2D(tFirst, vUv);
      vec4 second = texture2D(tSecond, vUv);
      gl_FragColor = vec4(first.rgb + second.rgb, max(first.a, second.a));
    }
  `,
  uniforms: { tFirst: { value: null }, tSecond: { value: null } },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const createCompositeMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader: groundGlassCompositeFragmentShader,
  uniforms: {
    tGather: { value: null },
    tNearGather: { value: null },
    useNearGather: { value: 0 },
    flipDisplayX: { value: 0 },
    flipDisplayY: { value: 0 },
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
    groundGlassFilmWindowWidthMm: { value: FILM_WIDTH_MM },
    groundGlassFilmWindowHeightMm: { value: FILM_HEIGHT_MM },
    renderWidth: { value: WIDTH },
    renderHeight: { value: HEIGHT },
  },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const readBytePixels = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
): Uint8Array => {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  renderer.readRenderTargetPixels(target, 0, 0, WIDTH, HEIGHT, pixels);
  return pixels;
};

const readFloatRadiancePixels = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
): Float32Array => {
  const pixels = new Float32Array(WIDTH * HEIGHT * 4);
  renderer.readRenderTargetPixels(target, 0, 0, WIDTH, HEIGHT, pixels);
  return pixels;
};

const toDisplayBytes = (pixels: Float32Array): Uint8Array => {
  const display = new Uint8Array(pixels.length);
  for (let index = 0; index < pixels.length; index += 1) {
    display[index] = Math.round(THREE.MathUtils.clamp(pixels[index], 0, 1) * 255);
  }
  return display;
};

const readFloatRadianceAt = (
  pixels: Float32Array,
  x: number,
  y: number,
  channel: number,
): number => pixels[(y * WIDTH + x) * 4 + channel];

const readRedByteAt = (
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  x: number,
  y: number,
): number => {
  const pixel = new Uint8Array(4);
  renderer.readRenderTargetPixels(target, x, y, 1, 1, pixel);
  return pixel[0];
};

const hashDisplayPixels = (pixels: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of pixels) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const countDisplayPixelsChanged = (pixels: Uint8Array, reference: Uint8Array): number => {
  let changed = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      Math.abs(pixels[index] - reference[index]) > 2 ||
      Math.abs(pixels[index + 1] - reference[index + 1]) > 2 ||
      Math.abs(pixels[index + 2] - reference[index + 2]) > 2
    ) changed += 1;
  }
  return changed;
};

const setProofImage = (canvasId: string, pixels: Uint8Array): void => {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Missing 2D output context for ${canvasId}`);
  const data = new Uint8ClampedArray(pixels.length);
  data.set(pixels);
  context.putImageData(new ImageData(data, WIDTH, HEIGHT), 0, 0);
};

const caseImages: Partial<Record<FocusCaseId, FocusCaseImages>> = {};

const displayCase = (
  id: FocusCaseId,
  result: FocusCaseMeasurement,
  images: FocusCaseImages | undefined,
): void => {
  const proof = window.__groundGlassContributionProof;
  if (!proof) return;
  const measurements = document.getElementById("measurements");
  const button = document.querySelector<HTMLButtonElement>(`button[data-case="${id}"]`);
  if (!measurements || !button || !images) return;
  setProofImage("direct-output", images.direct);
  setProofImage("secondary-output", images.secondary);
  setProofImage("combined-output", images.combined);
  document.querySelectorAll<HTMLButtonElement>("button[data-case]").forEach((item) => {
    item.setAttribute("aria-pressed", item === button ? "true" : "false");
  });
  measurements.textContent = JSON.stringify({ case: id, ...result }, null, 2);
};

const createLayer = (
  gatherDepth: THREE.Texture,
): ContributionLayer => {
  const cocMaterial = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: groundGlassApparentWorldPositionCocFragmentShader,
    uniforms: {
      ...createDofUniforms(),
      tApparentWorldPosition: { value: null },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const gatherMaterial = new THREE.ShaderMaterial({
    vertexShader: groundGlassVertexShader,
    fragmentShader: groundGlassApertureGatherFragmentShader,
    uniforms: {
      ...createDofUniforms(),
      tColor: { value: null },
      tDepth: { value: gatherDepth },
      tCoC: { value: null },
      gatherLayer: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const resolveMaterial = createLayerResolveMaterial();
  return {
    cocMaterial,
    gatherMaterial,
    resolveMaterial,
    cocTarget: makeCocTarget(),
    farTarget: makeRadianceTarget(),
    nearTarget: makeRadianceTarget(),
    focusedTarget: makeRadianceTarget(),
  };
};

const imageDistanceForObject = (objectDistanceMm: number): number =>
  imageDistanceForObjectMm(objectDistanceMm);

const makeContribution = (
  id: string,
  focusMap: FocusMap,
): GroundGlassRadianceContribution => ({
  id,
  radianceSemantics: "preweighted-linear-radiance",
  radiance: focusMap.radiance,
  apparentWorldPosition: focusMap.worldPositions,
  gatherVisibilityDepth: focusMap.visibilityDepth,
});

const pageBody = document.body;
const outputButton = document.querySelector<HTMLButtonElement>("button[data-case='A']");
if (!outputButton) throw new Error("The Ground Glass proof controls are missing");

const gpuCanvas = document.getElementById("gpu-source") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas: gpuCanvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NoToneMapping;
const floatingRadianceCapability = verifyFloatRadianceTargetCapability(renderer);

const nominalImageDistance = imageDistanceForObject(1000);
const fieldOfView = (2 * Math.atan(FILM_WIDTH_MM / (2 * nominalImageDistance)) * 180) / Math.PI;
const sceneCamera = new THREE.PerspectiveCamera(
  fieldOfView,
  WIDTH / HEIGHT,
  CAMERA_NEAR_M,
  CAMERA_FAR_M,
);
sceneCamera.position.set(0, 0, 0);
sceneCamera.lookAt(0, 0, 1);
sceneCamera.updateProjectionMatrix();
sceneCamera.updateMatrixWorld(true);

const sharedVisibilityDepth = makeGatherVisibilityDepth();
const directPattern = makePattern("direct");
const secondaryPattern = makePattern("secondary");
const directAtOneM = makeApparentWorldPositionMap(sceneCamera, 1.0);
const secondaryAtHalfM = makeApparentWorldPositionMap(sceneCamera, 0.5);
const layers = [
  createLayer(sharedVisibilityDepth),
  createLayer(sharedVisibilityDepth),
];
const combinedTarget = makeRadianceTarget();
const finalTarget = makeDisplayTarget();
const legacyByteAccumulatorControl = makeLegacyByteAccumulatorControl();
const radianceCombineMaterial = createRadianceCombineMaterial();
const compositeMaterial = createCompositeMaterial();
const quadGeometry = new THREE.PlaneGeometry(2, 2);
const quadScene = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quadCamera.position.z = 0.5;
quadCamera.lookAt(0, 0, 0);
const quad = new THREE.Mesh(quadGeometry, layers[0].cocMaterial);
quad.frustumCulled = false;
quadScene.add(quad);

const drawToTarget = (
  target: THREE.WebGLRenderTarget,
  material: THREE.ShaderMaterial,
): number => {
  const startedAt = performance.now();
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(quadScene, quadCamera);
  return performance.now() - startedAt;
};

const decodeCenterFootprint = (
  rendererInstance: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
) => {
  const pixels = readBytePixels(rendererInstance, target);
  const centerOffset = ((HEIGHT >> 1) * WIDTH + (WIDTH >> 1)) * 4;
  return {
    signedCoCDiameterMm: decodeGroundGlassSignedCoCByte(
      pixels[centerOffset],
      MAXIMUM_COC_MM,
    ),
    majorRadiusMm: decodeGroundGlassFootprintAxesMm({
      encodedMajorRadius: pixels[centerOffset + 1] / 255,
      encodedMinorRadius: pixels[centerOffset + 2] / 255,
      storageFormat: "encoded-byte",
      maximumRadiusMm: MAXIMUM_FOOTPRINT_RADIUS_MM,
    }).majorRadiusMm,
  };
};

type RenderedContribution = {
  measurement: ContributionMeasurement;
  displayPixels: Uint8Array;
  radiancePixels: Float32Array;
};

const runCase = (
  id: FocusCaseId,
  includeSecondary: boolean,
): {
  focusDistanceMm: number;
  direct: RenderedContribution;
  secondary: RenderedContribution | null;
  combinedDisplayPixels: Uint8Array;
  combinedRadiancePixels: Float32Array | null;
  contributionPassCount: number;
  cpuSubmitMs: number;
} => {
  const focusDistanceMm = id === "B" ? 500 : 1000;
  const state = makeDofState(sceneCamera, focusDistanceMm);
  const secondaryPositions = id === "C" ? directAtOneM : secondaryAtHalfM;
  const inputs = resolveGroundGlassRadianceContributions(
    makeContribution("direct-pane", {
      radiance: directPattern,
      worldPositions: directAtOneM,
      visibilityDepth: sharedVisibilityDepth,
    }),
    includeSecondary
      ? [makeContribution("secondary-radiance", {
          radiance: secondaryPattern,
          worldPositions: secondaryPositions,
          visibilityDepth: sharedVisibilityDepth,
        })]
      : [],
  );
  if (inputs.omittedOptionalIds.length > 0) {
    throw new Error(`Optional Ground Glass input was rejected: ${inputs.omittedOptionalIds.join(", ")}`);
  }

  let cpuSubmitMs = 0;
  const layerResults: RenderedContribution[] = [];
  inputs.contributions.forEach((input, index) => {
    const layer = layers[index];
    bindGroundGlassDofStateToApparentWorldPositionCocMaterial(
      layer.cocMaterial,
      state,
      input.apparentWorldPosition,
    );
    cpuSubmitMs += drawToTarget(layer.cocTarget, layer.cocMaterial);

    bindGroundGlassDofStateToGatherMaterial(layer.gatherMaterial, state);
    layer.gatherMaterial.uniforms.tColor.value = input.radiance;
    layer.gatherMaterial.uniforms.tDepth.value =
      input.gatherVisibilityDepth ?? sharedVisibilityDepth;
    layer.gatherMaterial.uniforms.tCoC.value = layer.cocTarget.texture;
    layer.gatherMaterial.uniforms.sampleCount.value = SAMPLE_COUNT;
    layer.gatherMaterial.uniforms.maximumCoCRadiusPx.value = MAXIMUM_GATHER_RADIUS_PX;
    layer.gatherMaterial.uniforms.renderWidth.value = WIDTH;
    layer.gatherMaterial.uniforms.renderHeight.value = HEIGHT;
    layer.gatherMaterial.uniforms.gatherLayer.value = 0;
    cpuSubmitMs += drawToTarget(layer.farTarget, layer.gatherMaterial);

    layer.gatherMaterial.uniforms.gatherLayer.value = 1;
    cpuSubmitMs += drawToTarget(layer.nearTarget, layer.gatherMaterial);

    layer.resolveMaterial.uniforms.tFar.value = layer.farTarget.texture;
    layer.resolveMaterial.uniforms.tNear.value = layer.nearTarget.texture;
    cpuSubmitMs += drawToTarget(layer.focusedTarget, layer.resolveMaterial);

    const center = decodeCenterFootprint(renderer, layer.cocTarget);
    const radiancePixels = readFloatRadiancePixels(renderer, layer.focusedTarget);
    const displayPixels = toDisplayBytes(radiancePixels);
    const metric = {
      id: input.id,
      centerSignedCoCDiameterMm: center.signedCoCDiameterMm,
      centerMajorRadiusMm: center.majorRadiusMm,
      changedPixelsFromEqualFocusReference: 0,
      displayHash: hashDisplayPixels(displayPixels),
    };
    layerResults.push({ measurement: metric, displayPixels, radiancePixels });
  });

  const direct = layerResults[0];
  const secondary = layerResults[1] ?? null;
  let radianceInput: THREE.Texture = layers[0].focusedTarget.texture;
  let combinedRadiancePixels: Float32Array | null = null;
  if (secondary) {
    radianceCombineMaterial.uniforms.tFirst.value = layers[0].focusedTarget.texture;
    radianceCombineMaterial.uniforms.tSecond.value = layers[1].focusedTarget.texture;
    cpuSubmitMs += drawToTarget(combinedTarget, radianceCombineMaterial);
    combinedRadiancePixels = readFloatRadiancePixels(renderer, combinedTarget);
    radianceInput = combinedTarget.texture;
  }

  compositeMaterial.uniforms.tGather.value = radianceInput;
  compositeMaterial.uniforms.tNearGather.value = layers[0].nearTarget.texture;
  compositeMaterial.uniforms.useNearGather.value = 0;
  cpuSubmitMs += drawToTarget(finalTarget, compositeMaterial);

  return {
    focusDistanceMm,
    direct,
    secondary,
    combinedDisplayPixels: readBytePixels(renderer, finalTarget),
    combinedRadiancePixels,
    contributionPassCount: inputs.contributions.length * 4 +
      (secondary ? 1 : 0) + 1,
    cpuSubmitMs,
  };
};

const sourceInputs = [directPattern, secondaryPattern];
const dispose = (): void => {
  layers.forEach((layer) => {
    layer.cocMaterial.dispose();
    layer.gatherMaterial.dispose();
    layer.resolveMaterial.dispose();
    layer.cocTarget.dispose();
    layer.farTarget.dispose();
    layer.nearTarget.dispose();
    layer.focusedTarget.dispose();
  });
  [combinedTarget, finalTarget, legacyByteAccumulatorControl].forEach((target) => target.dispose());
  [radianceCombineMaterial, compositeMaterial].forEach((material) => material.dispose());
  quadGeometry.dispose();
  sourceInputs.forEach((texture) => texture.dispose());
  [directAtOneM, secondaryAtHalfM, sharedVisibilityDepth].forEach((texture) => texture.dispose());
  renderer.dispose();
};

try {
  const resultA = runCase("A", true);
  const resultB = runCase("B", true);
  const caseCSingle = runCase("C", false);
  const resultC = runCase("C", true);
  if (!resultA.secondary || !resultB.secondary || !resultC.secondary) {
    throw new Error("The synthetic secondary contribution was not retained");
  }
  resultA.direct.measurement.changedPixelsFromEqualFocusReference = countDisplayPixelsChanged(
    resultA.direct.displayPixels,
    resultC.direct.displayPixels,
  );
  resultA.secondary.measurement.changedPixelsFromEqualFocusReference = countDisplayPixelsChanged(
    resultA.secondary.displayPixels,
    resultC.secondary.displayPixels,
  );
  resultB.direct.measurement.changedPixelsFromEqualFocusReference = countDisplayPixelsChanged(
    resultB.direct.displayPixels,
    resultC.direct.displayPixels,
  );
  resultB.secondary.measurement.changedPixelsFromEqualFocusReference = countDisplayPixelsChanged(
    resultB.secondary.displayPixels,
    resultC.secondary.displayPixels,
  );

  const resultCCombinedRadiance = resultC.combinedRadiancePixels;
  if (!resultCCombinedRadiance) {
    throw new Error("Case C did not produce a floating-point combined-radiance target");
  }
  const probeOffset = (RADIOMETRIC_PROBE_Y * WIDTH + RADIOMETRIC_PROBE_X) * 4;
  const directFocusedValue = readFloatRadianceAt(
    resultC.direct.radiancePixels,
    RADIOMETRIC_PROBE_X,
    RADIOMETRIC_PROBE_Y,
    0,
  );
  const secondaryFocusedValue = readFloatRadianceAt(
    resultC.secondary.radiancePixels,
    RADIOMETRIC_PROBE_X,
    RADIOMETRIC_PROBE_Y,
    0,
  );
  const expectedLinearSum = directFocusedValue + secondaryFocusedValue;
  const measuredCombinedLinearValue = resultCCombinedRadiance[probeOffset];
  if (
    Math.abs(directFocusedValue - RADIOMETRIC_PROBE_VALUE) > RADIOMETRIC_PROBE_TOLERANCE ||
    Math.abs(secondaryFocusedValue - RADIOMETRIC_PROBE_VALUE) > RADIOMETRIC_PROBE_TOLERANCE ||
    Math.abs(measuredCombinedLinearValue - expectedLinearSum) > RADIOMETRIC_PROBE_TOLERANCE ||
    measuredCombinedLinearValue <= 1
  ) {
    throw new Error(
      `Unclamped Case C radiance proof failed: direct=${directFocusedValue}, ` +
      `secondary=${secondaryFocusedValue}, sum=${expectedLinearSum}, ` +
      `combined=${measuredCombinedLinearValue}`,
    );
  }

  radianceCombineMaterial.uniforms.tFirst.value = layers[0].focusedTarget.texture;
  radianceCombineMaterial.uniforms.tSecond.value = layers[1].focusedTarget.texture;
  drawToTarget(legacyByteAccumulatorControl, radianceCombineMaterial);
  const legacyRgba8AccumulatorRedByte = readRedByteAt(
    renderer,
    legacyByteAccumulatorControl,
    0,
    0,
  );
  const radiometricProbe: RadiometricProbeMeasurement = {
    xPx: RADIOMETRIC_PROBE_X,
    yPx: RADIOMETRIC_PROBE_Y,
    channel: "R",
    directFocusedValue,
    secondaryFocusedValue,
    expectedLinearSum,
    measuredCombinedLinearValue,
    combinedValueExceedsOne: measuredCombinedLinearValue > 1,
    tolerance: RADIOMETRIC_PROBE_TOLERANCE,
    finalDisplayRedByte: resultC.combinedDisplayPixels[probeOffset],
    legacyRgba8AccumulatorRedByte,
  };

  const measurements: Record<FocusCaseId, FocusCaseMeasurement> = {
    A: {
      focusDistanceMm: resultA.focusDistanceMm,
      direct: resultA.direct.measurement,
      secondary: resultA.secondary.measurement,
      combinedDisplayHash: hashDisplayPixels(resultA.combinedDisplayPixels),
      contributionPassCount: resultA.contributionPassCount,
      cpuSubmitMs: resultA.cpuSubmitMs,
    },
    B: {
      focusDistanceMm: resultB.focusDistanceMm,
      direct: resultB.direct.measurement,
      secondary: resultB.secondary.measurement,
      combinedDisplayHash: hashDisplayPixels(resultB.combinedDisplayPixels),
      contributionPassCount: resultB.contributionPassCount,
      cpuSubmitMs: resultB.cpuSubmitMs,
    },
    C: {
      focusDistanceMm: resultC.focusDistanceMm,
      direct: resultC.direct.measurement,
      secondary: resultC.secondary.measurement,
      combinedDisplayHash: hashDisplayPixels(resultC.combinedDisplayPixels),
      singleContributionDisplayHash: caseCSingle.direct.measurement.displayHash,
      singleContributionPassCount: caseCSingle.contributionPassCount,
      contributionPassCount: resultC.contributionPassCount,
      cpuSubmitMs: resultC.cpuSubmitMs,
    },
  };

  caseImages.A = {
    direct: resultA.direct.displayPixels,
    secondary: resultA.secondary.displayPixels,
    combined: resultA.combinedDisplayPixels,
  };
  caseImages.B = {
    direct: resultB.direct.displayPixels,
    secondary: resultB.secondary.displayPixels,
    combined: resultB.combinedDisplayPixels,
  };
  caseImages.C = {
    direct: resultC.direct.displayPixels,
    secondary: resultC.secondary.displayPixels,
    combined: resultC.combinedDisplayPixels,
  };

  const debugInfo = renderer.getContext().getExtension("WEBGL_debug_renderer_info") as {
    UNMASKED_RENDERER_WEBGL: number;
  } | null;
  const backend = debugInfo
    ? String(renderer.getContext().getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    : String(renderer.getContext().getParameter(renderer.getContext().RENDERER));

  const rgba8FullResolutionBytes = WIDTH * HEIGHT * 4;
  const rgba32fFullResolutionBytes = WIDTH * HEIGHT * 16;
  const nominalTargetTexelBytes =
    2 * rgba8FullResolutionBytes +
    6 * rgba32fFullResolutionBytes +
    rgba32fFullResolutionBytes +
    rgba8FullResolutionBytes +
    4;
  const nominalInputTexelBytes =
    2 * rgba32fFullResolutionBytes +
    2 * rgba32fFullResolutionBytes +
    4;

  window.__groundGlassContributionProof = {
    backend,
    floatingRadianceCapability,
    resourceSummary: {
      targetCount: 11,
      cocTargets: {
        count: 2,
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "UnsignedByteType",
      },
      contributionRadianceTargets: {
        farCount: 2,
        nearCount: 2,
        focusedCount: 2,
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "FloatType",
        filter: "NearestFilter",
      },
      combinedRadianceTarget: {
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "FloatType",
      },
      finalDisplayTarget: {
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "UnsignedByteType",
      },
      legacyByteAccumulatorControl: {
        dimensions: [1, 1],
        format: "RGBAFormat",
        type: "UnsignedByteType",
      },
      radianceInputTextures: {
        count: 2,
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "FloatType",
      },
      apparentPositionTextures: {
        count: 2,
        dimensions: [WIDTH, HEIGHT],
        format: "RGBAFormat",
        type: "FloatType",
      },
      visibilityDepthInput: {
        dimensions: [1, 1],
        format: "RGBAFormat",
        type: "UnsignedByteType",
      },
      nominalTargetTexelBytes,
      nominalInputTexelBytes,
      fullResolutionPassesPerTwoContributionFrame: resultA.contributionPassCount,
      rendererTextureCount: renderer.info.memory.textures,
    },
    cases: measurements,
    radiometricProbe,
    showCase: (id) => displayCase(id, measurements[id], caseImages[id]),
  };

  document.querySelectorAll<HTMLButtonElement>("button[data-case]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.case as FocusCaseId;
      window.__groundGlassContributionProof?.showCase(id);
    });
  });
  pageBody.dataset.proofReady = "true";
  displayCase("A", measurements.A, caseImages.A);
  window.addEventListener("pagehide", dispose, { once: true });
} catch (error) {
  dispose();
  pageBody.dataset.proofError = error instanceof Error ? error.message : String(error);
  throw error;
}
