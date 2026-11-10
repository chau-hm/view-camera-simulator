import * as THREE from "three";
import {
  groundGlassApertureGatherFragmentShader,
  groundGlassPhysicalCocFragmentShader,
  groundGlassVertexShader,
} from "../../../render/groundGlassDofShaderSources";
import {
  bindGroundGlassDofStateToCocMaterial,
  bindGroundGlassDofStateToGatherMaterial,
  synchronizeGroundGlassDofClipRange,
} from "../../../render/groundGlassShaderBindings";
import type { GroundGlassDofRenderState } from "../../../render/groundGlassDofRenderState";

const WIDTH = 512;
const HEIGHT = 384;
const FOCAL_LENGTH_MM = 150;
const FILM_WIDTH_MM = 127;
const FILM_HEIGHT_MM = 127;
const NEAR_M = 0.01;
const FAR_M = 4;
const FRONT_DISTANCE_MM = 400;
const BACK_DISTANCE_MM = 410;
const FRONT_EDGE_X = WIDTH >> 1;
const SAMPLE_COUNT = 32;
const MAX_COC_RADIUS_PX = 16;
const COC_STORAGE_MAX_MM = 12;
const FOOTPRINT_STORAGE_MAX_MM = 6;

type VariantName = "candidate" | "legacy";
type FixtureCase = "focus-near-far-390-f2_8" | "focus-foreground-400-f2_8" |
  "focus-background-410-f1_4" | "stopped-down-400-f32";

type FixtureMeasurement = {
  focusDistanceMm: number;
  fNumber: number;
  candidateEdgeRedIncrease: number;
  legacyEdgeRedIncrease: number;
  candidateForegroundContrast: number;
  legacyForegroundContrast: number;
  sourceForegroundContrast: number;
  candidateBackgroundContrast: number;
  legacyBackgroundContrast: number;
  sourceBackgroundContrast: number;
  candidateForegroundNearAlpha: number;
  legacyForegroundNearAlpha: number;
  candidateZeroBlurMeanAbsDifference: number;
  legacyZeroBlurMeanAbsDifference: number;
  backgroundCoCDiameterMm: number;
  foregroundCoCDiameterMm: number;
  backgroundMajorRadiusPx: number;
  foregroundMajorRadiusPx: number;
  candidatePixels: Uint8Array;
  legacyPixels: Uint8Array;
  sourcePixels: Uint8Array;
};
type FixtureRenderedMeasurement = FixtureMeasurement & { cocPixels: Uint8Array };

declare global {
  interface Window {
    __groundGlassDofEdgeProof?: {
      backend: string;
      renderer: string;
      sourceDepthFormat: string;
      scene: Readonly<{
        frontDistanceMm: number;
        backDistanceMm: number;
        frontCardBoundsMm: readonly [number, number, number, number];
        edgePixelX: number;
      }>;
      cases: Record<FixtureCase, Omit<FixtureRenderedMeasurement,
        "candidatePixels" | "legacyPixels" | "sourcePixels" | "cocPixels">>;
      showCase: (id: FixtureCase) => void;
    };
  }
}

const body = document.body;
const measurementsElement = document.getElementById("measurements");
const gpuCanvas = document.getElementById("gpu-source") as HTMLCanvasElement | null;
const sourceCanvas = document.getElementById("source-output") as HTMLCanvasElement | null;
const candidateCanvas = document.getElementById("candidate-output") as HTMLCanvasElement | null;
const legacyCanvas = document.getElementById("legacy-output") as HTMLCanvasElement | null;
if (!measurementsElement || !gpuCanvas || !sourceCanvas || !candidateCanvas || !legacyCanvas) {
  throw new Error("Ground Glass depth-edge fixture controls are incomplete");
}

const farDepthToleranceFunction = (bodySource: string): string =>
  `float farDepthToleranceMm(float centerDistanceMm){\n${bodySource}\n}`;

const legacyToleranceBody = `  if(!isFiniteFloat(centerDistanceMm) || centerDistanceMm <= 0.0) return 0.0;
  return max(20.0, centerDistanceMm * 0.015);`;

const withDepthTolerance = (shader: string, replacementBody: string): string => {
  const start = shader.indexOf("float farDepthToleranceMm(float centerDistanceMm)");
  const openBrace = shader.indexOf("{", start);
  if (start < 0 || openBrace < 0) throw new Error("The Far gather depth tolerance could not be found");
  let braceDepth = 0;
  let end = -1;
  for (let index = openBrace; index < shader.length; index += 1) {
    if (shader[index] === "{") braceDepth += 1;
    if (shader[index] === "}") {
      braceDepth -= 1;
      if (braceDepth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error("The Far gather depth tolerance has unbalanced braces");
  return `${shader.slice(0, start)}${farDepthToleranceFunction(replacementBody)}${shader.slice(end)}`;
};

const candidateGatherShader = groundGlassApertureGatherFragmentShader;
const legacyGatherShader = withDepthTolerance(
  groundGlassApertureGatherFragmentShader,
  legacyToleranceBody,
);

const makeSourceTarget = (): THREE.WebGLRenderTarget => {
  const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  const depthTexture = new THREE.DepthTexture(WIDTH, HEIGHT, THREE.UnsignedShortType);
  depthTexture.format = THREE.DepthFormat;
  depthTexture.type = THREE.UnsignedShortType;
  depthTexture.minFilter = THREE.NearestFilter;
  depthTexture.magFilter = THREE.NearestFilter;
  target.depthTexture = depthTexture;
  return target;
};

const makeTarget = (): THREE.WebGLRenderTarget => {
  const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return target;
};

const sourceTarget = makeSourceTarget();
const cocTarget = makeTarget();
const farTargets: Record<VariantName, THREE.WebGLRenderTarget> = {
  candidate: makeTarget(),
  legacy: makeTarget(),
};
const nearTargets: Record<VariantName, THREE.WebGLRenderTarget> = {
  candidate: makeTarget(),
  legacy: makeTarget(),
};
const finalTargets: Record<VariantName, THREE.WebGLRenderTarget> = {
  candidate: makeTarget(),
  legacy: makeTarget(),
};

const colorMaterial = (fragmentShader: string): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader,
  side: THREE.DoubleSide,
  depthTest: true,
  depthWrite: true,
  toneMapped: false,
});

const backgroundMaterial = colorMaterial(`
  precision highp float;
  varying vec2 vUv;
  void main(){
    float stripe = step(0.5, fract(vUv.x * 24.0));
    vec3 darkBlue = vec3(0.015, 0.055, 0.82);
    vec3 lightCyan = vec3(0.015, 0.72, 0.66);
    gl_FragColor = vec4(mix(darkBlue, lightCyan, stripe), 1.0);
  }
`);

const foregroundMaterial = colorMaterial(`
  precision highp float;
  varying vec2 vUv;
  void main(){
    float stripe = step(0.5, fract(vUv.x * 32.0));
    vec3 darkRed = vec3(0.72, 0.012, 0.008);
    vec3 gold = vec3(0.98, 0.62, 0.025);
    gl_FragColor = vec4(mix(darkRed, gold, stripe), 1.0);
  }
`);

const sourceScene = new THREE.Scene();
const background = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), backgroundMaterial);
background.position.set(0, 0, BACK_DISTANCE_MM * 0.001);
const foreground = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.14), foregroundMaterial);
foreground.position.set(-0.055, 0, FRONT_DISTANCE_MM * 0.001);
sourceScene.add(background, foreground);

const focusForFNumber = 400;
const nominalImageDistanceMm =
  (FOCAL_LENGTH_MM * focusForFNumber) / (focusForFNumber - FOCAL_LENGTH_MM);
const fieldOfViewDeg =
  (2 * Math.atan(FILM_WIDTH_MM / (2 * nominalImageDistanceMm)) * 180) / Math.PI;
const camera = new THREE.PerspectiveCamera(fieldOfViewDeg, WIDTH / HEIGHT, NEAR_M, FAR_M);
camera.position.set(0, 0, 0);
camera.lookAt(0, 0, 1);
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

const makeDofState = (focusDistanceMm: number, fNumber: number): GroundGlassDofRenderState => {
  const imageDistanceMm =
    (FOCAL_LENGTH_MM * focusDistanceMm) / (focusDistanceMm - FOCAL_LENGTH_MM);
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
      apertureFNumber: fNumber,
      acceptableCoCDiameterMm: 0.1,
    },
    render: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      maximumBlurRadiusPx: MAX_COC_RADIUS_PX,
      displayWidthPx: WIDTH,
    },
    physicalCoC: {
      boundaryDiameterPx: (0.1 * WIDTH) / FILM_WIDTH_MM,
      boundaryRadiusPx: (0.1 * WIDTH) / FILM_WIDTH_MM / 2,
      visibleBoundaryRadiusPx: (0.1 * WIDTH) / FILM_WIDTH_MM / 2,
    },
  };
};

const createDofUniforms = (): Record<string, THREE.IUniform> => ({
  near: { value: NEAR_M },
  far: { value: FAR_M },
  imageDistanceMm: { value: nominalImageDistanceMm },
  focalLengthMm: { value: FOCAL_LENGTH_MM },
  fNumber: { value: 2.8 },
  renderWidth: { value: WIDTH },
  renderHeight: { value: HEIGHT },
  useRaw: { value: 0 },
  dofMode: { value: 0 },
  lensCenterWorld: { value: new THREE.Vector3() },
  lensPlaneNormal: { value: new THREE.Vector3(0, 0, 1) },
  lensPlaneBasisX: { value: new THREE.Vector3(1, 0, 0) },
  lensPlaneBasisY: { value: new THREE.Vector3(0, 1, 0) },
  filmPlanePoint: { value: new THREE.Vector3(0, 0, -nominalImageDistanceMm * 0.001) },
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
  maximumCoCRadiusPx: { value: MAX_COC_RADIUS_PX },
  circleOfConfusionMm: { value: 0.1 },
  sampledFilmWidthMm: { value: FILM_WIDTH_MM },
  sampledFilmHeightMm: { value: FILM_HEIGHT_MM },
  cocStorageEncoded: { value: 1 },
  cocStorageMaxMm: { value: COC_STORAGE_MAX_MM },
  footprintStorageMaxMm: { value: FOOTPRINT_STORAGE_MAX_MM },
});

const cocMaterial = new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader: groundGlassPhysicalCocFragmentShader,
  uniforms: { ...createDofUniforms(), tDepth: { value: sourceTarget.depthTexture } },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const createGatherMaterial = (fragmentShader: string): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader,
  uniforms: {
    ...createDofUniforms(),
    tColor: { value: sourceTarget.texture },
    tDepth: { value: sourceTarget.depthTexture },
    tCoC: { value: cocTarget.texture },
    gatherLayer: { value: 0 },
    sampleCount: { value: SAMPLE_COUNT },
  },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const gatherMaterials: Record<VariantName, THREE.ShaderMaterial> = {
  candidate: createGatherMaterial(candidateGatherShader),
  legacy: createGatherMaterial(legacyGatherShader),
};

const compositeMaterial = new THREE.ShaderMaterial({
  vertexShader: groundGlassVertexShader,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tFar;
    uniform sampler2D tNear;
    void main(){
      vec4 farLayer = texture2D(tFar, vUv);
      vec4 nearLayer = texture2D(tNear, vUv);
      gl_FragColor = vec4(mix(farLayer.rgb, nearLayer.rgb, clamp(nearLayer.a, 0.0, 1.0)), 1.0);
    }
  `,
  uniforms: {
    tFar: { value: null },
    tNear: { value: null },
  },
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const quadGeometry = new THREE.PlaneGeometry(2, 2);
const quad = new THREE.Mesh(quadGeometry, cocMaterial);
quad.frustumCulled = false;
const quadScene = new THREE.Scene();
quadScene.add(quad);
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quadCamera.position.z = 0.5;
quadCamera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  canvas: gpuCanvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const draw = (target: THREE.WebGLRenderTarget, material: THREE.ShaderMaterial): void => {
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(quadScene, quadCamera);
};

const readBytes = (target: THREE.WebGLRenderTarget): Uint8Array => {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  renderer.readRenderTargetPixels(target, 0, 0, WIDTH, HEIGHT, pixels);
  return pixels;
};

const showPixels = (canvas: HTMLCanvasElement, pixels: Uint8Array): void => {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The fixture could not create an output 2D context");
  const image = context.createImageData(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const sourceY = HEIGHT - y - 1;
    const sourceOffset = sourceY * WIDTH * 4;
    image.data.set(pixels.subarray(sourceOffset, sourceOffset + WIDTH * 4), y * WIDTH * 4);
  }
  context.putImageData(image, 0, 0);
};

const meanRedIncrease = (
  before: Uint8Array,
  after: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number => {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      sum += Math.max(0, after[offset] - before[offset]);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
};

const meanAbsoluteRgbDifference = (
  first: Uint8Array,
  second: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number => {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      sum += Math.abs(first[offset] - second[offset]);
      sum += Math.abs(first[offset + 1] - second[offset + 1]);
      sum += Math.abs(first[offset + 2] - second[offset + 2]);
      count += 3;
    }
  }
  return count > 0 ? sum / count : 0;
};

const meanAlpha = (
  pixels: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number => {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      sum += pixels[(y * WIDTH + x) * 4 + 3] ?? 0;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
};

const luminanceContrast = (
  pixels: Uint8Array,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number => {
  let sum = 0;
  let squaredSum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      const value = 0.2126 * pixels[offset] +
        0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2];
      sum += value;
      squaredSum += value * value;
      count += 1;
    }
  }
  const mean = count > 0 ? sum / count : 0;
  return count > 0 ? Math.sqrt(Math.max(0, squaredSum / count - mean * mean)) : 0;
};

const decodeCoC = (pixels: Uint8Array, x: number, y: number): number => {
  const offset = (y * WIDTH + x) * 4;
  const code = pixels[offset];
  return code < 128
    ? ((code - 128) / 128) * COC_STORAGE_MAX_MM
    : code > 128
      ? ((code - 128) / 127) * COC_STORAGE_MAX_MM
      : 0;
};

const decodeRadius = (pixels: Uint8Array, x: number, y: number): number => {
  const offset = (y * WIDTH + x) * 4;
  return Math.max(pixels[offset + 1], pixels[offset + 2]) / 255 * FOOTPRINT_STORAGE_MAX_MM;
};

const results = {} as Record<FixtureCase, FixtureRenderedMeasurement>;
const summarizeResult = (result: FixtureRenderedMeasurement) => Object.fromEntries(
  Object.entries(result).filter(([key]) => !key.endsWith("Pixels") && key !== "cocPixels"),
);
const caseInputs: ReadonlyArray<Readonly<{ id: FixtureCase; focus: number; fNumber: number }>> = [
  { id: "focus-near-far-390-f2_8", focus: 390, fNumber: 2.8 },
  { id: "focus-foreground-400-f2_8", focus: 400, fNumber: 2.8 },
  { id: "focus-background-410-f1_4", focus: 410, fNumber: 1.4 },
  { id: "stopped-down-400-f32", focus: 400, fNumber: 32 },
];

const renderCase = (
  focusDistanceMm: number,
  fNumber: number,
): FixtureRenderedMeasurement => {
  const state = makeDofState(focusDistanceMm, fNumber);
  const sourcePixels = readBytes(sourceTarget);
  bindGroundGlassDofStateToCocMaterial(cocMaterial, state);
  synchronizeGroundGlassDofClipRange([cocMaterial], NEAR_M, FAR_M);
  cocMaterial.uniforms.tDepth.value = sourceTarget.depthTexture;
  draw(cocTarget, cocMaterial);
  const cocPixels = readBytes(cocTarget);

  const outputPixels = {} as Record<VariantName, Uint8Array>;
  const nearLayerPixels = {} as Record<VariantName, Uint8Array>;
  for (const variant of ["candidate", "legacy"] as const) {
    const gatherMaterial = gatherMaterials[variant];
    bindGroundGlassDofStateToGatherMaterial(gatherMaterial, state);
    synchronizeGroundGlassDofClipRange([gatherMaterial], NEAR_M, FAR_M);
    gatherMaterial.uniforms.tColor.value = sourceTarget.texture;
    gatherMaterial.uniforms.tDepth.value = sourceTarget.depthTexture;
    gatherMaterial.uniforms.tCoC.value = cocTarget.texture;
    gatherMaterial.uniforms.sampleCount.value = SAMPLE_COUNT;
    gatherMaterial.uniforms.maximumCoCRadiusPx.value = MAX_COC_RADIUS_PX;
    gatherMaterial.uniforms.renderWidth.value = WIDTH;
    gatherMaterial.uniforms.renderHeight.value = HEIGHT;
    gatherMaterial.uniforms.cocStorageEncoded.value = 1;
    gatherMaterial.uniforms.cocStorageMaxMm.value = COC_STORAGE_MAX_MM;
    gatherMaterial.uniforms.footprintStorageMaxMm.value = FOOTPRINT_STORAGE_MAX_MM;
    gatherMaterial.uniforms.gatherLayer.value = 0;
    draw(farTargets[variant], gatherMaterial);
    gatherMaterial.uniforms.gatherLayer.value = 1;
    draw(nearTargets[variant], gatherMaterial);
    nearLayerPixels[variant] = readBytes(nearTargets[variant]);
    compositeMaterial.uniforms.tFar.value = farTargets[variant].texture;
    compositeMaterial.uniforms.tNear.value = nearTargets[variant].texture;
    draw(finalTargets[variant], compositeMaterial);
    outputPixels[variant] = readBytes(finalTargets[variant]);
  }

  const edgeX = FRONT_EDGE_X;
  const edgeY0 = 144;
  const edgeY1 = 240;
  // Predeclared geometry-based ROIs: outside the sharp card boundary, within
  // the adjacent background gather support; and interior stripe patches away
  // from the depth edge. The same pixels are used for both variants/states.
  // The test camera looks along +Z, so Three.js's projected X is mirrored:
  // the card at negative world X lies right of the center edge in the output.
  const edgeRoi = focusDistanceMm === 400 && fNumber === 2.8
    ? { x0: edgeX - 1, x1: edgeX, y0: edgeY0, y1: edgeY1 }
    : { x0: edgeX - 3, x1: edgeX - 1, y0: edgeY0, y1: edgeY1 };
  const foregroundRoi = { x0: 300, x1: 420, y0: 150, y1: 234 };
  const backgroundRoi = { x0: 84, x1: 212, y0: 150, y1: 234 };
  const nearForegroundRoi = { x0: 300, x1: 420, y0: 150, y1: 234 };
  const zeroBlurRoi = { x0: 84, x1: 212, y0: 150, y1: 234 };
  const candidate = outputPixels.candidate;
  const legacy = outputPixels.legacy;
  return {
    focusDistanceMm,
    fNumber,
    candidateEdgeRedIncrease: meanRedIncrease(sourcePixels, candidate, edgeRoi.x0, edgeRoi.x1, edgeRoi.y0, edgeRoi.y1),
    legacyEdgeRedIncrease: meanRedIncrease(sourcePixels, legacy, edgeRoi.x0, edgeRoi.x1, edgeRoi.y0, edgeRoi.y1),
    candidateForegroundContrast: luminanceContrast(candidate, foregroundRoi.x0, foregroundRoi.x1, foregroundRoi.y0, foregroundRoi.y1),
    legacyForegroundContrast: luminanceContrast(legacy, foregroundRoi.x0, foregroundRoi.x1, foregroundRoi.y0, foregroundRoi.y1),
    sourceForegroundContrast: luminanceContrast(sourcePixels, foregroundRoi.x0, foregroundRoi.x1, foregroundRoi.y0, foregroundRoi.y1),
    candidateBackgroundContrast: luminanceContrast(candidate, backgroundRoi.x0, backgroundRoi.x1, backgroundRoi.y0, backgroundRoi.y1),
    legacyBackgroundContrast: luminanceContrast(legacy, backgroundRoi.x0, backgroundRoi.x1, backgroundRoi.y0, backgroundRoi.y1),
    sourceBackgroundContrast: luminanceContrast(sourcePixels, backgroundRoi.x0, backgroundRoi.x1, backgroundRoi.y0, backgroundRoi.y1),
    candidateForegroundNearAlpha: meanAlpha(nearLayerPixels.candidate, nearForegroundRoi.x0, nearForegroundRoi.x1, nearForegroundRoi.y0, nearForegroundRoi.y1) / 255,
    legacyForegroundNearAlpha: meanAlpha(nearLayerPixels.legacy, nearForegroundRoi.x0, nearForegroundRoi.x1, nearForegroundRoi.y0, nearForegroundRoi.y1) / 255,
    candidateZeroBlurMeanAbsDifference: meanAbsoluteRgbDifference(sourcePixels, candidate, zeroBlurRoi.x0, zeroBlurRoi.x1, zeroBlurRoi.y0, zeroBlurRoi.y1),
    legacyZeroBlurMeanAbsDifference: meanAbsoluteRgbDifference(sourcePixels, legacy, zeroBlurRoi.x0, zeroBlurRoi.x1, zeroBlurRoi.y0, zeroBlurRoi.y1),
    backgroundCoCDiameterMm: decodeCoC(cocPixels, FRONT_EDGE_X - 24, HEIGHT >> 1),
    foregroundCoCDiameterMm: decodeCoC(cocPixels, FRONT_EDGE_X + 32, HEIGHT >> 1),
    backgroundMajorRadiusPx: decodeRadius(cocPixels, FRONT_EDGE_X - 24, HEIGHT >> 1) * WIDTH / FILM_WIDTH_MM,
    foregroundMajorRadiusPx: decodeRadius(cocPixels, FRONT_EDGE_X + 32, HEIGHT >> 1) * WIDTH / FILM_WIDTH_MM,
    candidatePixels: candidate,
    legacyPixels: legacy,
    sourcePixels,
    cocPixels,
  };
};

const projectedEdge = new THREE.Vector3(0, 0, FRONT_DISTANCE_MM * 0.001).project(camera);
const edgePixelX = Math.round((projectedEdge.x * 0.5 + 0.5) * WIDTH);
if (edgePixelX !== FRONT_EDGE_X) throw new Error(`Unexpected fixture card edge at x=${edgePixelX}`);

renderer.setRenderTarget(sourceTarget);
renderer.setClearColor(0.02, 0);
renderer.clear(true, true, true);
renderer.render(sourceScene, camera);
renderer.setRenderTarget(null);
const initialSourcePixels = readBytes(sourceTarget);
showPixels(sourceCanvas, initialSourcePixels);

caseInputs.forEach(({ id, focus, fNumber }) => {
  results[id] = renderCase(focus, fNumber);
});

const showCase = (id: FixtureCase): void => {
  const result = results[id];
  if (!result) throw new Error(`Unknown DOF edge case: ${id}`);
  showPixels(candidateCanvas, result.candidatePixels);
  showPixels(legacyCanvas, result.legacyPixels);
  measurementsElement.textContent = JSON.stringify({ caseId: id, ...summarizeResult(result) }, null, 2);
};

window.__groundGlassDofEdgeProof = {
  backend: renderer.capabilities.isWebGL2 ? "webgl2" : "webgl1",
  renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER),
  sourceDepthFormat: "DEPTH_COMPONENT16 via THREE.UnsignedShortType",
  scene: {
    frontDistanceMm: FRONT_DISTANCE_MM,
    backDistanceMm: BACK_DISTANCE_MM,
    frontCardBoundsMm: [-110, 0, -70, 70],
    edgePixelX,
  },
  cases: Object.fromEntries(caseInputs.map(({ id }) => {
    return [id, summarizeResult(results[id])];
  })) as Window["__groundGlassDofEdgeProof"] extends { cases: infer T } ? T : never,
  showCase,
};

showCase("focus-foreground-400-f2_8");
body.dataset.proofReady = "true";

const dispose = (): void => {
  sourceScene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
  quadGeometry.dispose();
  cocMaterial.dispose();
  compositeMaterial.dispose();
  Object.values(gatherMaterials).forEach((material) => material.dispose());
  sourceTarget.dispose();
  cocTarget.dispose();
  Object.values(farTargets).forEach((target) => target.dispose());
  Object.values(nearTargets).forEach((target) => target.dispose());
  Object.values(finalTargets).forEach((target) => target.dispose());
  renderer.dispose();
};
window.addEventListener("pagehide", dispose, { once: true });
