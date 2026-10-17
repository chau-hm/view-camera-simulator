import * as THREE from "three";
import { unpackAnatomyGpuRgbaReadbackRows } from "./anatomyGpuBlendIntermediate";
import type { AnatomyGpuCaptureRuntime } from "./anatomyGpuBlendIntermediate";

type CalibrationRenderer = {
  getRenderTarget: () => THREE.RenderTarget | null;
  setRenderTarget: (target: THREE.RenderTarget | null) => void;
  getClearColor: (target: THREE.Color) => THREE.Color;
  getClearAlpha: () => number;
  setClearColor: (color: THREE.Color | number | string, alpha?: number) => void;
  getViewport: (target: THREE.Vector4) => THREE.Vector4;
  setViewport: (viewport: THREE.Vector4) => void;
  getScissor: (target: THREE.Vector4) => THREE.Vector4;
  setScissor: (scissor: THREE.Vector4) => void;
  getScissorTest: () => boolean;
  setScissorTest: (value: boolean) => void;
  clear: (color?: boolean, depth?: boolean, stencil?: boolean) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => unknown;
  readRenderTargetPixels?: (
    target: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ) => void;
  readRenderTargetPixelsAsync?: (
    target: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<ArrayBufferView>;
};

export type AnatomyGpuBlendCalibrationResult = Readonly<{
  status: "passed" | "failed" | "unsupported";
  runtime: AnatomyGpuCaptureRuntime;
  target: Readonly<{ format: string; type: string; colorSpace: string; width: number; height: number }>;
  orientation: Readonly<{
    apiRowOrder: "bottom-up" | "top-down" | "unresolved";
    asymmetricQuadrantControl: "passed" | "failed" | "not-run";
    observedRgba: readonly number[];
  }>;
  controls: Readonly<{
    opaqueSingleDraw: Readonly<{ active: boolean; pixel: readonly number[]; expected: readonly number[]; maxByteError: number }>;
    transparentSingleDraw: Readonly<{ active: boolean; pixel: readonly number[]; expected: readonly number[]; maxByteError: number }>;
    changedBlendState: Readonly<{ active: boolean; normalPixel: readonly number[]; disabledPixel: readonly number[]; rgbDifference: number }>;
    changedDrawOrder: Readonly<{ active: boolean; firstOrderPixel: readonly number[]; reversedOrderPixel: readonly number[]; rgbDifference: number }>;
  }>;
  lifecycle: Readonly<{ targetDisposeCount: number; geometryDisposeCount: number; materialDisposeCount: number }>;
  error?: string;
}>;

const maxByteError = (observed: readonly number[], expected: readonly number[]): number =>
  Math.max(...expected.map((value, index) => Math.abs((observed[index] ?? 0) - value)));

const rgbDifference = (first: readonly number[], second: readonly number[]): number =>
  first.slice(0, 3).reduce((total, value, index) => total + Math.abs(value - (second[index] ?? 0)), 0) / 3;

/** Calibrates actual render-target readback with bounded synthetic draws. */
export const runAnatomyGpuBlendCalibration = async (
  rendererValue: unknown,
  runtime: AnatomyGpuCaptureRuntime,
): Promise<AnatomyGpuBlendCalibrationResult> => {
  const renderer = rendererValue as CalibrationRenderer;
  const readAsync = renderer.readRenderTargetPixelsAsync;
  const readSync = renderer.readRenderTargetPixels;
  const targetDescription = {
    format: "RGBAFormat",
    type: "UnsignedByteType",
    colorSpace: THREE.LinearSRGBColorSpace,
    width: 1,
    height: 1,
  } as const;
  const emptyControls = {
    opaqueSingleDraw: { active: false, pixel: [], expected: [], maxByteError: 0 },
    transparentSingleDraw: { active: false, pixel: [], expected: [], maxByteError: 0 },
    changedBlendState: { active: false, normalPixel: [], disabledPixel: [], rgbDifference: 0 },
    changedDrawOrder: { active: false, firstOrderPixel: [], reversedOrderPixel: [], rgbDifference: 0 },
  } as const;
  if (!readSync && !readAsync) {
    return {
      status: "unsupported",
      runtime,
      target: targetDescription,
      orientation: { apiRowOrder: "unresolved", asymmetricQuadrantControl: "not-run", observedRgba: [] },
      controls: emptyControls,
      lifecycle: { targetDisposeCount: 0, geometryDisposeCount: 0, materialDisposeCount: 0 },
      error: "The mounted renderer does not expose render-target pixel readback.",
    };
  }

  const target = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
    samples: 0,
  });
  const orientationTarget = new THREE.WebGLRenderTarget(2, 2, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.LinearSRGBColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
    samples: 0,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const fixtureColor = new THREE.Color().setRGB(0.75, 0.25, 0.1, THREE.LinearSRGBColorSpace);
  const opaqueMaterial = new THREE.MeshBasicMaterial({
    color: fixtureColor,
    toneMapped: false,
    transparent: false,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
  });
  const transparentMaterial = new THREE.MeshBasicMaterial({
    color: fixtureColor,
    opacity: 0.25,
    toneMapped: false,
    transparent: true,
    blending: THREE.NormalBlending,
    premultipliedAlpha: false,
    depthTest: false,
    depthWrite: false,
  });
  const firstOrderMaterial = new THREE.MeshBasicMaterial({
    color: fixtureColor,
    opacity: 0.25,
    toneMapped: false,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
  });
  const secondOrderMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setRGB(0.1, 0.25, 0.75, THREE.LinearSRGBColorSpace),
    opacity: 0.5,
    toneMapped: false,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
  });
  const quadrantMaterials = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00].map((hex) =>
    new THREE.MeshBasicMaterial({
      color: hex,
      toneMapped: false,
      transparent: false,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const opaqueMesh = new THREE.Mesh(geometry, opaqueMaterial);
  const transparentMesh = new THREE.Mesh(geometry, transparentMaterial);
  const firstOrderMesh = new THREE.Mesh(geometry, firstOrderMaterial);
  const secondOrderMesh = new THREE.Mesh(geometry, secondOrderMaterial);
  const quadrants = quadrantMaterials.map((material, index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.5);
    mesh.position.set(index % 2 === 0 ? -0.5 : 0.5, index < 2 ? 0.5 : -0.5, 0);
    return mesh;
  });
  scene.add(opaqueMesh, transparentMesh, firstOrderMesh, secondOrderMesh, ...quadrants);

  let targetDisposeCount = 0;
  let geometryDisposeCount = 0;
  let materialDisposeCount = 0;
  target.addEventListener("dispose", () => { targetDisposeCount += 1; });
  orientationTarget.addEventListener("dispose", () => { targetDisposeCount += 1; });
  geometry.addEventListener("dispose", () => { geometryDisposeCount += 1; });
  [opaqueMaterial, transparentMaterial, firstOrderMaterial, secondOrderMaterial, ...quadrantMaterials].forEach((material) => {
    material.addEventListener("dispose", () => { materialDisposeCount += 1; });
  });

  const previousTarget = renderer.getRenderTarget();
  const previousViewport = renderer.getViewport(new THREE.Vector4()).clone();
  const previousScissor = renderer.getScissor(new THREE.Vector4()).clone();
  const previousScissorTest = renderer.getScissorTest();
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  const captures = new Map<string, readonly number[]>();
  const restoreRendererState = () => {
    renderer.setRenderTarget(previousTarget);
    renderer.setViewport(previousViewport);
    renderer.setScissor(previousScissor);
    renderer.setScissorTest(previousScissorTest);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  };
  const renderAndRead = async (
    key: string,
    activeTarget: THREE.WebGLRenderTarget,
    width: number,
    height: number,
    clearAlpha: number,
  ): Promise<void> => {
    let synchronousPixels: Uint8Array | null = null;
    let asynchronousPixels: Promise<ArrayBufferView> | null = null;
    try {
      renderer.setRenderTarget(activeTarget);
      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, clearAlpha);
      renderer.clear(true, true, true);
      const renderResult = renderer.render(scene, camera);
      if (renderResult && typeof (renderResult as PromiseLike<unknown>).then === "function") {
        throw new Error("The mounted renderer returned an asynchronous render promise.");
      }
      if (runtime.executionBackend === "webgl2") {
        if (!readSync) throw new Error("WebGL2 render-target readback is unavailable.");
        synchronousPixels = new Uint8Array(width * height * 4);
        readSync.call(renderer, activeTarget, 0, 0, width, height, synchronousPixels);
      } else {
        if (!readAsync) throw new Error("Native WebGPU render-target readback is unavailable.");
        // Queue the copy while the probe target is active; restore the mounted output before awaiting mapAsync.
        asynchronousPixels = readAsync.call(renderer, activeTarget, 0, 0, width, height);
      }
    } finally {
      restoreRendererState();
    }
    const rawPixels = asynchronousPixels ? await asynchronousPixels : synchronousPixels;
    if (!(rawPixels instanceof Uint8Array)) {
      throw new Error(`Calibration readback returned ${rawPixels?.constructor.name ?? "no data"} with ${rawPixels?.byteLength ?? 0} bytes.`);
    }
    const pixels = unpackAnatomyGpuRgbaReadbackRows(rawPixels, width, height);
    captures.set(key, [...pixels]);
  };
  const renderPixel = (key: string, clearAlpha: number): Promise<void> =>
    renderAndRead(key, target, 1, 1, clearAlpha);

  let error: string | undefined;
  let apiRowOrder: "bottom-up" | "top-down" | "unresolved" = "unresolved";
  let orientationControl: "passed" | "failed" | "not-run" = "not-run";
  try {
    if (previousTarget !== null) throw new Error("Calibration requires the screen output target to be mounted before capture.");
    opaqueMesh.visible = true;
    transparentMesh.visible = false;
    firstOrderMesh.visible = false;
    secondOrderMesh.visible = false;
    quadrants.forEach((mesh) => { mesh.visible = false; });
    await renderPixel("opaque", 0);

    opaqueMesh.visible = false;
    transparentMesh.visible = true;
    transparentMaterial.blending = THREE.NormalBlending;
    await renderPixel("transparent-normal", 0);
    transparentMaterial.blending = THREE.NoBlending;
    transparentMaterial.needsUpdate = true;
    await renderPixel("transparent-disabled", 0);

    transparentMesh.visible = false;
    firstOrderMesh.visible = true;
    secondOrderMesh.visible = true;
    firstOrderMesh.renderOrder = 1;
    secondOrderMesh.renderOrder = 2;
    firstOrderMaterial.blending = THREE.NormalBlending;
    secondOrderMaterial.blending = THREE.NormalBlending;
    await renderPixel("order-first-second", 0);
    firstOrderMesh.renderOrder = 2;
    secondOrderMesh.renderOrder = 1;
    await renderPixel("order-second-first", 0);

    firstOrderMesh.visible = false;
    secondOrderMesh.visible = false;
    quadrants.forEach((mesh) => { mesh.visible = true; });
    await renderAndRead("orientation", orientationTarget, 2, 2, 0);
    const observed = captures.get("orientation") ?? [];
    const expectedTopDown = [
      [255, 0, 0, 255], [0, 255, 0, 255],
      [0, 0, 255, 255], [255, 255, 0, 255],
    ];
    const expectedBottomUp = [
      [0, 0, 255, 255], [255, 255, 0, 255],
      [255, 0, 0, 255], [0, 255, 0, 255],
    ];
    const errorFor = (expected: readonly (readonly number[])[]) => Math.max(...expected.flatMap((pixel, index) =>
      pixel.map((value, channel) => Math.abs((observed[index * 4 + channel] ?? 0) - value)),
    ));
    const topError = observed.length === 16 ? errorFor(expectedTopDown) : Infinity;
    const bottomError = observed.length === 16 ? errorFor(expectedBottomUp) : Infinity;
    const orientationError = Math.min(topError, bottomError);
    orientationControl = orientationError <= 2 ? "passed" : "failed";
    if (orientationControl === "passed") apiRowOrder = topError < bottomError ? "top-down" : "bottom-up";
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  } finally {
    restoreRendererState();
    [opaqueMaterial, transparentMaterial, firstOrderMaterial, secondOrderMaterial, ...quadrantMaterials].forEach((material) => material.dispose());
    geometry.dispose();
    target.dispose();
    orientationTarget.dispose();
  }

  const expectedOpaque = [191, 64, 26, 255];
  const expectedTransparent = [48, 16, 6, 64];
  const opaquePixel = captures.get("opaque") ?? [];
  const normalPixel = captures.get("transparent-normal") ?? [];
  const disabledPixel = captures.get("transparent-disabled") ?? [];
  const firstOrderPixel = captures.get("order-first-second") ?? [];
  const reversedOrderPixel = captures.get("order-second-first") ?? [];
  const orientationPixels = captures.get("orientation") ?? [];
  const expectedOpaqueError = maxByteError(opaquePixel, expectedOpaque);
  const expectedTransparentError = maxByteError(normalPixel, expectedTransparent);
  const blendDifference = rgbDifference(normalPixel, disabledPixel);
  const orderDifference = rgbDifference(firstOrderPixel, reversedOrderPixel);
  const controls = {
    opaqueSingleDraw: {
      active: opaquePixel.length === 4 && expectedOpaqueError <= 2,
      pixel: opaquePixel,
      expected: expectedOpaque,
      maxByteError: expectedOpaqueError,
    },
    transparentSingleDraw: {
      active: normalPixel.length === 4 && expectedTransparentError <= 2,
      pixel: normalPixel,
      expected: expectedTransparent,
      maxByteError: expectedTransparentError,
    },
    changedBlendState: {
      active: normalPixel.length === 4 && disabledPixel.length === 4 && blendDifference > 8,
      normalPixel,
      disabledPixel,
      rgbDifference: blendDifference,
    },
    changedDrawOrder: {
      active: firstOrderPixel.length === 4 && reversedOrderPixel.length === 4 && orderDifference > 1,
      firstOrderPixel,
      reversedOrderPixel,
      rgbDifference: orderDifference,
    },
  } as const;
  const status = error
    ? "unsupported"
    : Object.values(controls).every((control) => control.active) && orientationControl === "passed"
      ? "passed"
      : "failed";

  return {
    status,
    runtime,
    target: targetDescription,
    orientation: { apiRowOrder, asymmetricQuadrantControl: orientationControl, observedRgba: orientationPixels },
    controls,
    lifecycle: { targetDisposeCount, geometryDisposeCount, materialDisposeCount },
    ...(error ? { error } : {}),
  };
};
