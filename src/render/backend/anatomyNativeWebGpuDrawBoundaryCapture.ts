import * as THREE from "three";
import {
  AnatomyGpuCaptureCancelledError,
  unpackAnatomyGpuRgbaReadbackRows,
} from "./anatomyGpuBlendIntermediate";
import {
  anatomyNativeFramebufferSamples,
  classifyAnatomyNativeDrawBoundary,
  describeAnatomyNativeDrawCommands,
} from "./anatomyNativeWebGpuDrawBoundary";
import type { AnatomyGpuCaptureRuntime } from "./anatomyGpuBlendIntermediate";

type SelectedRenderable = THREE.Object3D & Readonly<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}>;

type NativeTexture = Readonly<{
  format?: string;
  sampleCount?: number;
}>;

type NativePassDescriptor = Readonly<{
  colorAttachments?: readonly Readonly<Record<string, unknown>>[];
  depthStencilAttachment?: Readonly<Record<string, unknown>>;
}>;

type NativeRenderContextData = Readonly<{
  currentPass?: object | null;
  descriptor?: NativePassDescriptor;
  encoder?: object;
  bundleEncoders?: unknown;
  renderBundles?: readonly unknown[];
  lastOcclusionObject?: unknown;
}>;

type NativeRenderContext = Readonly<{
  id?: number;
  renderTarget?: unknown | null;
  textures?: unknown | null;
  sampleCount?: number;
  depth?: boolean;
  stencil?: boolean;
  occlusionQueryCount?: number;
  camera?: THREE.Camera | null;
  viewportValue?: Readonly<Record<string, number>>;
  scissorValue?: Readonly<Record<string, number>>;
}>;

type NativeRenderObject = Readonly<{
  id?: number;
  object?: THREE.Object3D;
  material?: THREE.Material;
  context?: NativeRenderContext;
  pipeline?: Readonly<{ id?: number }>;
  passId?: string | null;
  bundle?: unknown;
  getDrawParameters?: () => unknown | null;
  getIndirect?: () => unknown | null;
  getIndirectOffset?: () => unknown;
  getIndex?: () => unknown | null;
}>;

type NativeReadbackBuffer = {
  mapAsync: (mode: number) => Promise<void>;
  getMappedRange: () => ArrayBuffer;
  destroy: () => void;
};

type NativeCommandEncoder = {
  copyTextureToBuffer: (
    source: Readonly<Record<string, unknown>>,
    destination: Readonly<Record<string, unknown>>,
    size: Readonly<Record<string, number>>,
  ) => void;
  finish: () => object;
};

type NativeDevice = {
  createBuffer: (descriptor: Readonly<Record<string, unknown>>) => NativeReadbackBuffer;
  createCommandEncoder: () => NativeCommandEncoder;
  queue?: { submit: (commands: readonly object[]) => void };
};

type NativeBackend = {
  draw: (renderObject: NativeRenderObject, info: unknown) => unknown;
  finishRender: (renderContext: NativeRenderContext) => unknown;
  get: (object: object) => NativeRenderContextData & Readonly<Record<string, unknown>>;
  device?: NativeDevice;
  context?: Readonly<{
    getCurrentTexture?: () => NativeTexture;
    getConfiguration?: () => Readonly<{ alphaMode?: string; format?: string }>;
  }>;
  utils?: Readonly<{
    getPreferredCanvasFormat?: () => string;
    getSampleCountRenderContext?: (context: NativeRenderContext) => number;
    getCurrentColorFormat?: (context: NativeRenderContext) => string;
    getCurrentDepthStencilFormat?: (context: NativeRenderContext) => string;
  }>;
  pipelineUtils?: Readonly<{
    _getBlending?: (material: THREE.Material) => unknown;
    _getDepthCompare?: (material: THREE.Material) => unknown;
  }>;
  trackTimestamp?: boolean;
};

type NativeRenderer = Readonly<{
  backend?: NativeBackend;
  currentSamples?: number;
  outputColorSpace?: string;
  toneMapping?: number;
  getRenderTarget?: () => THREE.RenderTarget | null;
  getScissorTest?: () => boolean;
  getDrawingBufferSize?: (target: THREE.Vector2) => THREE.Vector2;
  copyFramebufferToTexture?: (texture: THREE.FramebufferTexture, rectangle: THREE.Vector4) => void;
}>;

export type AnatomyNativeDrawBoundaryCaptureResult = Readonly<Record<string, unknown> & {
  status: "ok" | "unsupported";
  feasibility: "F1" | "F2" | "F0";
  method: "native-draw-boundary";
}>;

export type AnatomyNativeDrawBoundaryCaptureOptions = Readonly<{
  renderer: NativeRenderer;
  runtime: AnatomyGpuCaptureRuntime;
  threeRevision: string;
  generation: number;
  selected: SelectedRenderable;
  sourceMaterialId?: string;
  samplePixelIndices: readonly number[];
  baselineCanvas?: Readonly<{
    width: number;
    height: number;
    rgbaBase64: string;
    repeatNoiseMae: number;
  }>;
  resolveSourceMaterial: (material: THREE.Material) => THREE.Material;
  isCaptureActive: () => boolean;
  awaitReadbacks: (readbacks: readonly Promise<ArrayBufferView>[]) => Promise<readonly ArrayBufferView[]>;
  registerCleanup: (cleanup: () => void) => () => void;
  onResourcesReleased: (lifecycle: Readonly<Record<string, unknown>>) => void;
}>;

const unsupportedResult = (
  generation: number,
  reason: string,
): AnatomyNativeDrawBoundaryCaptureResult => ({
  status: "unsupported",
  generation,
  method: "native-draw-boundary",
  feasibility: "F0",
  reason,
});

const passLoadState = (descriptor: NativePassDescriptor) => {
  const colors = descriptor.colorAttachments ?? [];
  const depth = descriptor.depthStencilAttachment;
  return {
    colorAttachments: colors.map((attachment) => ({
      loadOp: attachment.loadOp ?? null,
      storeOp: attachment.storeOp ?? null,
      hasResolveTarget: attachment.resolveTarget !== undefined && attachment.resolveTarget !== null,
      clearValue: attachment.clearValue ?? null,
    })),
    depthStencilAttachment: depth ? {
      depthLoadOp: depth.depthLoadOp ?? null,
      depthStoreOp: depth.depthStoreOp ?? null,
      stencilLoadOp: depth.stencilLoadOp ?? null,
      stencilStoreOp: depth.stencilStoreOp ?? null,
    } : null,
  };
};

const isLoadPreservingState = (context: NativeRenderContext, descriptor: NativePassDescriptor): boolean => {
  const state = passLoadState(descriptor);
  if (state.colorAttachments.length !== 1 || state.colorAttachments.some(({ loadOp }) => loadOp !== "load")) return false;
  const depth = state.depthStencilAttachment;
  if (context.depth && depth?.depthLoadOp !== "load") return false;
  if (context.stencil && depth?.stencilLoadOp !== "load") return false;
  return true;
};

const passMetadata = (data: NativeRenderContextData) => {
  const descriptor = data.descriptor;
  if (!descriptor) throw new Error("r186-render-pass-descriptor-unavailable");
  return passLoadState(descriptor);
};

const materialMetadata = (material: THREE.Material, backend: NativeBackend) => {
  const candidate = material as THREE.Material & {
    outputTransform?: string;
    outputInterventionId?: string;
    opacity?: number;
    premultipliedAlpha?: boolean;
    blendColor?: THREE.Color;
    blendAlpha?: number;
  };
  const blendingConfigured = material.blending !== THREE.NoBlending &&
    (material.blending !== THREE.NormalBlending || material.transparent !== false);
  return {
    id: material.uuid,
    type: material.type,
    side: material.side,
    transparent: material.transparent,
    opacity: candidate.opacity ?? null,
    premultipliedAlpha: candidate.premultipliedAlpha ?? null,
    blending: material.blending,
    gpuBlendDescriptor: blendingConfigured ? backend.pipelineUtils?._getBlending?.(material) ?? null : null,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    depthFunction: material.depthFunc,
    gpuDepthCompare: backend.pipelineUtils?._getDepthCompare?.(material) ?? null,
    stencilWrite: material.stencilWrite,
    stencilRef: material.stencilRef,
    outputTransform: candidate.outputTransform ?? null,
    outputInterventionId: candidate.outputInterventionId ?? null,
  };
};

const geometryMetadata = (geometry: THREE.BufferGeometry) => ({
  id: geometry.uuid,
  type: geometry.type,
  indexCount: geometry.index?.count ?? null,
  attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, {
    count: attribute.count,
    itemSize: attribute.itemSize,
    arrayType: attribute.array.constructor.name,
  }])),
});

const passPreservingRuntimeReason = (
  renderer: NativeRenderer,
  backend: NativeBackend,
  context: NativeRenderContext,
  data: NativeRenderContextData,
  sourceFormat: string,
): string | null => {
  if (renderer.getRenderTarget?.() !== null || context.renderTarget !== null || context.textures !== null) {
    return "native-boundary-requires-the-default-single-color-canvas-pass";
  }
  if (!data.currentPass || typeof (data.currentPass as { end?: unknown }).end !== "function" || !data.encoder) {
    return "active-native-render-pass-or-command-encoder-unavailable";
  }
  if (data.bundleEncoders !== undefined || (data.renderBundles?.length ?? 0) > 0) {
    return "render-bundle-or-array-camera-pass-cannot-be-captured-at-a-live-draw-boundary";
  }
  if ((context.occlusionQueryCount ?? 0) > 0 || data.lastOcclusionObject) {
    return "occlusion-query-pass-cannot-be-split-without-changing-query-scope";
  }
  if (backend.trackTimestamp === true) return "timestamp-query-pass-cannot-be-split-without-changing-query-measurements";
  if ((data.descriptor?.colorAttachments?.length ?? 0) !== 1) {
    return "native-pass-does-not-have-one-inspectable-color-attachment";
  }
  if (typeof backend.utils?.getPreferredCanvasFormat !== "function" ||
      backend.utils.getPreferredCanvasFormat() !== sourceFormat) {
    return "native-canvas-format-does-not-match-the-r186-framebuffer-copy-format";
  }
  if (typeof backend.utils.getCurrentColorFormat !== "function" ||
      backend.utils.getCurrentColorFormat(context) !== sourceFormat) {
    return "r186-current-color-format-does-not-match-the-live-canvas-texture";
  }
  return null;
};

const drawResponse = (
  before: readonly Readonly<{ rgba: readonly number[] }>[],
  after: readonly Readonly<{ rgba: readonly number[] }>[],
) => {
  let rgbDelta = 0;
  let alphaDelta = 0;
  let changedSampleCount = 0;
  let maxChannelDelta = 0;
  before.forEach((sample, index) => {
    const post = after[index];
    if (!post) return;
    let sampleChanged = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs((sample.rgba[channel] ?? 0) - (post.rgba[channel] ?? 0));
      maxChannelDelta = Math.max(maxChannelDelta, delta);
      if (channel < 3) rgbDelta += delta;
      else alphaDelta += delta;
      if (delta > 0) sampleChanged = true;
    }
    if (sampleChanged) changedSampleCount += 1;
  });
  return {
    sampleCount: before.length,
    changedSampleCount,
    meanAbsoluteRgbDifference: before.length > 0 ? rgbDelta / (before.length * 3) : 0,
    meanAbsoluteAlphaDifference: before.length > 0 ? alphaDelta / before.length : 0,
    maxAbsoluteChannelDifference: maxChannelDelta,
  };
};

const compareNativeFrameToBaseline = (
  pixels: Uint8Array,
  fullWidth: number,
  fullHeight: number,
  format: string,
  baseline: Readonly<{ width: number; height: number; pixels: Uint8Array; repeatNoiseMae: number }>,
) => {
  if (pixels.length !== fullWidth * fullHeight * 4 || baseline.width < 1 || baseline.height < 1 ||
      baseline.pixels.length !== baseline.width * baseline.height * 4) {
    throw new Error("Native final-frame parity dimensions or RGBA data are invalid");
  }
  let rgbDifference = 0;
  let centerSampleRgbDifference = 0;
  let maxAbsoluteRgbDifference = 0;
  let changedPixelCount = 0;
  const count = baseline.width * baseline.height;
  for (let index = 0; index < count; index += 1) {
    const x = index % baseline.width;
    const y = Math.floor(index / baseline.width);
    const framebufferX = Math.min(fullWidth - 1, Math.floor((x + 0.5) * fullWidth / baseline.width));
    const framebufferY = Math.min(fullHeight - 1, Math.floor((y + 0.5) * fullHeight / baseline.height));
    const framebufferOffset = (framebufferY * fullWidth + framebufferX) * 4;
    const baselineOffset = index * 4;
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const sourceChannel = format.startsWith("bgra8") && channel === 0 ? 2 :
        format.startsWith("bgra8") && channel === 2 ? 0 : channel;
      const centerDifference = Math.abs(
        (pixels[framebufferOffset + sourceChannel] ?? 0) - (baseline.pixels[baselineOffset + channel] ?? 0),
      );
      centerSampleRgbDifference += centerDifference;
      const sourceX = Math.min(fullWidth - 1, Math.max(0, ((x + 0.5) * fullWidth / baseline.width) - 0.5));
      const sourceY = Math.min(fullHeight - 1, Math.max(0, ((y + 0.5) * fullHeight / baseline.height) - 0.5));
      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(fullWidth - 1, x0 + 1);
      const y1 = Math.min(fullHeight - 1, y0 + 1);
      const weightX = sourceX - x0;
      const weightY = sourceY - y0;
      const channelAt = (pixelX: number, pixelY: number): number => {
        const framebufferChannel = format.startsWith("bgra8") && channel === 0 ? 2 :
          format.startsWith("bgra8") && channel === 2 ? 0 : channel;
        return pixels[((pixelY * fullWidth + pixelX) * 4) + framebufferChannel] ?? 0;
      };
      const top = channelAt(x0, y0) * (1 - weightX) + channelAt(x1, y0) * weightX;
      const bottom = channelAt(x0, y1) * (1 - weightX) + channelAt(x1, y1) * weightX;
      const interpolated = Math.round(top * (1 - weightY) + bottom * weightY);
      const difference = Math.abs(interpolated - (baseline.pixels[baselineOffset + channel] ?? 0));
      rgbDifference += difference;
      maxAbsoluteRgbDifference = Math.max(maxAbsoluteRgbDifference, difference);
      if (difference > 0) pixelChanged = true;
    }
    if (pixelChanged) changedPixelCount += 1;
  }
  const meanAbsoluteRgbDifference = count > 0 ? rgbDifference / (count * 3) : null;
  const tolerance = baseline.repeatNoiseMae;
  return {
    screenshotWidth: baseline.width,
    screenshotHeight: baseline.height,
    comparedPixelCount: count,
    meanAbsoluteRgbDifference,
    centerSampleMeanAbsoluteRgbDifference: count > 0 ? centerSampleRgbDifference / (count * 3) : null,
    maxAbsoluteRgbDifference,
    changedPixelCount,
    baselineRepeatNoiseMae: baseline.repeatNoiseMae,
    toleranceMae: tolerance,
    qualified: meanAbsoluteRgbDifference !== null && meanAbsoluteRgbDifference <= tolerance,
    mapping: "bilinear RGB resampling from raw GPU attachment pixel centers to CSS screenshot pixel centers",
    browserComposition: "the comparison includes browser canvas resampling and screenshot composition; it is reported separately from raw draw-boundary values",
  };
};

const copyNativeTextureToOwnedBuffer = async (
  backend: NativeBackend,
  texture: THREE.Texture,
  width: number,
  height: number,
  faceIndex: number,
  onBufferCreated: () => void,
  onBufferDestroyed: (failed: boolean) => void,
): Promise<Uint8Array> => {
  const device = backend.device;
  const gpuBufferUsage = (globalThis as typeof globalThis & {
    GPUBufferUsage?: Readonly<{ COPY_DST: number; MAP_READ: number }>;
  }).GPUBufferUsage;
  const gpuMapMode = (globalThis as typeof globalThis & {
    GPUMapMode?: Readonly<{ READ: number }>;
  }).GPUMapMode;
  if (!device?.queue || !gpuBufferUsage || !gpuMapMode ||
      typeof device.createBuffer !== "function" || typeof device.createCommandEncoder !== "function") {
    throw new Error("Pinned r186 native readback device or WebGPU buffer constants are unavailable");
  }
  const textureData = backend.get(texture) as Readonly<{
    texture?: unknown;
    textureDescriptorGPU?: Readonly<{ format?: string }>;
  }>;
  const format = textureData.textureDescriptorGPU?.format;
  if (!textureData.texture || (format !== "rgba8unorm" && format !== "rgba8unorm-srgb" &&
      format !== "bgra8unorm" && format !== "bgra8unorm-srgb")) {
    throw new Error(`Pinned r186 readback expected an 8-bit RGBA/BGRA texture, received ${String(format)}`);
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      !Number.isInteger(faceIndex) || faceIndex < 0) {
    throw new Error("Native readback texture dimensions or layer are invalid");
  }

  const bytesPerTexel = 4;
  const bytesPerRow = Math.ceil((width * bytesPerTexel) / 256) * 256;
  const bufferSize = ((height - 1) * bytesPerRow) + (width * bytesPerTexel);
  const readBuffer = device.createBuffer({
    size: bufferSize,
    usage: gpuBufferUsage.COPY_DST | gpuBufferUsage.MAP_READ,
  });
  onBufferCreated();
  let destroyed = false;
  let destroyFailed = false;
  const destroyBuffer = () => {
    if (destroyed) return;
    destroyed = true;
    try {
      readBuffer.destroy();
    } catch {
      destroyFailed = true;
    } finally {
      onBufferDestroyed(destroyFailed);
    }
  };

  try {
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      {
        texture: textureData.texture,
        mipLevel: 0,
        origin: { x: 0, y: 0, z: faceIndex },
        aspect: "all",
      },
      {
        buffer: readBuffer,
        offset: 0,
        bytesPerRow,
        rowsPerImage: height,
      },
      { width, height, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(gpuMapMode.READ);
    return new Uint8Array(readBuffer.getMappedRange().slice(0));
  } finally {
    destroyBuffer();
  }
};

/**
 * Brackets single native r186 backend draw commands by using the backend's
 * same-encoder framebuffer-copy pass split. Readbacks start only after the
 * original finishRender submits that encoder. Every patched method is restored
 * before asynchronous mapping begins.
 */
export const runAnatomyNativeWebGpuDrawBoundaryCapture = (
  options: AnatomyNativeDrawBoundaryCaptureOptions,
): Promise<Readonly<Record<string, unknown>>> => {
  const candidate = classifyAnatomyNativeDrawBoundary(options.runtime, options.threeRevision);
  if (candidate.classification !== "F1") return Promise.resolve(unsupportedResult(options.generation, candidate.reason));
  const renderer = options.renderer;
  const backend = renderer.backend;
  if (!backend || typeof backend.draw !== "function" || typeof backend.finishRender !== "function" ||
      typeof backend.get !== "function" || !backend.device?.queue ||
      typeof backend.context?.getCurrentTexture !== "function" ||
      typeof renderer.copyFramebufferToTexture !== "function" ||
      typeof renderer.getDrawingBufferSize !== "function" ||
      typeof backend.utils?.getSampleCountRenderContext !== "function" ||
      typeof backend.utils.getCurrentDepthStencilFormat !== "function" ||
      typeof backend.pipelineUtils?._getDepthCompare !== "function") {
    return Promise.resolve(unsupportedResult(options.generation, "pinned-r186-native-pass-api-shape-unavailable"));
  }
  if (options.samplePixelIndices.length < 1 || options.samplePixelIndices.length > 32) {
    return Promise.resolve(unsupportedResult(options.generation, "invalid-or-excessive-fixed-sample-selection"));
  }

  const dimensions = renderer.getDrawingBufferSize(new THREE.Vector2());
  const fullWidth = Math.floor(dimensions.x);
  const fullHeight = Math.floor(dimensions.y);
  if (fullWidth < 1 || fullHeight < 1 || options.samplePixelIndices.some((index) =>
    !Number.isInteger(index) || index < 0 || index >= fullWidth * fullHeight)) {
    return Promise.resolve(unsupportedResult(options.generation, "fixed-sample-selection-outside-native-drawing-buffer"));
  }
  const coordinates = options.samplePixelIndices.map((index) => ({
    index,
    x: index % fullWidth,
    y: Math.floor(index / fullWidth),
  }));
  const region = {
    x: Math.min(...coordinates.map(({ x }) => x)),
    y: Math.min(...coordinates.map(({ y }) => y)),
    width: Math.max(...coordinates.map(({ x }) => x)) - Math.min(...coordinates.map(({ x }) => x)) + 1,
    height: Math.max(...coordinates.map(({ y }) => y)) - Math.min(...coordinates.map(({ y }) => y)) + 1,
  };
  const rectangle = new THREE.Vector4(region.x, region.y, region.width, region.height);
  const finalFrameRegion = { x: 0, y: 0, width: fullWidth, height: fullHeight };
  const finalFrameRectangle = new THREE.Vector4(0, 0, fullWidth, fullHeight);
  if (!options.baselineCanvas ||
      !Number.isInteger(options.baselineCanvas.width) || options.baselineCanvas.width < 1 ||
      !Number.isInteger(options.baselineCanvas.height) || options.baselineCanvas.height < 1 ||
      !Number.isFinite(options.baselineCanvas.repeatNoiseMae) || options.baselineCanvas.repeatNoiseMae < 0) {
    return Promise.resolve(unsupportedResult(options.generation, "instrumented-frame-parity-baseline-is-required"));
  }
  let baselineCanvasPixels: Uint8Array;
  try {
    const binary = window.atob(options.baselineCanvas.rgbaBase64);
    baselineCanvasPixels = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) baselineCanvasPixels[index] = binary.charCodeAt(index);
  } catch {
    return Promise.resolve(unsupportedResult(options.generation, "instrumented-frame-parity-baseline-is-invalid-base64"));
  }
  if (baselineCanvasPixels.length !== options.baselineCanvas.width * options.baselineCanvas.height * 4) {
    return Promise.resolve(unsupportedResult(options.generation, "instrumented-frame-parity-baseline-is-not-rgba8"));
  }

  return new Promise((resolve, reject) => {
    type Snapshot = Readonly<{
      texture: THREE.FramebufferTexture;
      order: number;
      region: Readonly<{ x: number; y: number; width: number; height: number }>;
    }>;
    type DrawDraft = {
      order: number;
      renderObjectId: number | null;
      renderPassId: number;
      passId: string | null;
      nativeCommand: string;
      commandCount: number;
      drawParameters: Readonly<Record<string, unknown>> | null;
      pipelineId: number | null;
      materialId: string;
      sourceMaterialId: string;
      material: ReturnType<typeof materialMetadata>;
      sourceMaterial: ReturnType<typeof materialMetadata>;
      passStateBeforeSplit: ReturnType<typeof passMetadata>;
      drawPassState: ReturnType<typeof passMetadata>;
      viewport: Readonly<Record<string, number>> | null;
      scissor: Readonly<Record<string, number>> | null;
      scissorTest: boolean | null;
      before: Snapshot;
      after: Snapshot | null;
    };

    let settled = false;
    let readbackStarted = false;
    let cleanupRequested = false;
    let copiesEncoded = false;
    let encoderSubmitted = false;
    let resourcesReleased = false;
    let readbackBufferCount = 0;
    let readbackBufferDestroyCount = 0;
    let readbackBufferDisposalFailures = 0;
    let timeoutId = 0;
    let actualSampleCount = 0;
    let captureContext: NativeRenderContext | null = null;
    let passOrder = 0;
    let drawOrder = 0;
    let unregisterCleanup: (() => void) | null = null;
    const passIds = new WeakMap<object, number>();
    const ownedTextures: THREE.FramebufferTexture[] = [];
    const textureRegions = new Map<THREE.FramebufferTexture, Snapshot["region"]>();
    const drafts: DrawDraft[] = [];
    let finalFrameSnapshot: Snapshot | null = null;
    const textureDisposeCounts = new Map<THREE.FramebufferTexture, number>();

    const originalDraw = backend.draw;
    const originalFinishRender = backend.finishRender;
    const hadOwnDraw = Object.prototype.hasOwnProperty.call(backend, "draw");
    const hadOwnFinishRender = Object.prototype.hasOwnProperty.call(backend, "finishRender");
    const nativeBackend = backend as NativeBackend & { draw: NativeBackend["draw"]; finishRender: NativeBackend["finishRender"] };
    const wrappers: {
      draw?: NativeBackend["draw"];
      finishRender?: NativeBackend["finishRender"];
    } = {};
    let pendingOutcome: Readonly<{ result?: Readonly<Record<string, unknown>>; error?: unknown }> | null = null;

    const passIdentity = (pass: object): number => {
      const existing = passIds.get(pass);
      if (existing !== undefined) return existing;
      passOrder += 1;
      passIds.set(pass, passOrder);
      return passOrder;
    };

    const restoreDrawHook = () => {
      if (!wrappers.draw || nativeBackend.draw !== wrappers.draw) return;
      if (hadOwnDraw) nativeBackend.draw = originalDraw;
      else delete (nativeBackend as unknown as Record<string, unknown>).draw;
    };

    const restoreFinishHook = () => {
      if (!wrappers.finishRender || nativeBackend.finishRender !== wrappers.finishRender) return;
      if (hadOwnFinishRender) nativeBackend.finishRender = originalFinishRender;
      else delete (nativeBackend as unknown as Record<string, unknown>).finishRender;
    };

    const unregisterCancellation = () => {
      unregisterCleanup?.();
      unregisterCleanup = null;
    };

    const restoreHooks = () => {
      window.clearTimeout(timeoutId);
      restoreDrawHook();
      restoreFinishHook();
      unregisterCancellation();
    };

    const releaseOwnedTextures = () => {
      if (resourcesReleased || (copiesEncoded && !encoderSubmitted)) return;
      resourcesReleased = true;
      let disposalFailureCount = 0;
      ownedTextures.forEach((texture) => {
        try {
          texture.dispose();
        } catch {
          disposalFailureCount += 1;
        }
      });
      options.onResourcesReleased({
        temporaryFramebufferTextureCount: ownedTextures.length,
        temporaryFramebufferTextureDisposeCount: [...textureDisposeCounts.values()].reduce((sum, count) => sum + count, 0),
        temporaryFramebufferTextureDisposeEventsPerResource: [...textureDisposeCounts.values()],
        temporaryFramebufferTextureDisposalFailures: disposalFailureCount,
        readbackBufferCount,
        readbackBufferDestroyCount,
        readbackBufferDisposalFailures,
        noBorrowedResourceDisposed: true,
      });
    };

    const settleOutcome = (outcome: Readonly<{ result?: Readonly<Record<string, unknown>>; error?: unknown }>) => {
      if (settled) return;
      if (copiesEncoded && !encoderSubmitted) {
        cleanupRequested = true;
        if (!pendingOutcome) pendingOutcome = outcome;
        window.clearTimeout(timeoutId);
        restoreDrawHook();
        unregisterCancellation();
        return;
      }
      settled = true;
      restoreHooks();
      releaseOwnedTextures();
      if (outcome.error !== undefined) reject(outcome.error);
      else resolve(outcome.result ?? unsupportedResult(options.generation, "native-capture-settled-without-a-result"));
    };

    const finishWithResult = (result: Readonly<Record<string, unknown>>) => settleOutcome({ result });

    const fail = (cause: unknown) => {
      settleOutcome({ error: cause });
    };

    const createTexture = (
      format: string,
      textureRegion: Snapshot["region"] = region,
    ): THREE.FramebufferTexture => {
      const texture = new THREE.FramebufferTexture(textureRegion.width, textureRegion.height);
      texture.internalFormat = format as typeof texture.internalFormat;
      let disposeCount = 0;
      texture.addEventListener("dispose", () => {
        disposeCount += 1;
        textureDisposeCounts.set(texture, disposeCount);
      });
      ownedTextures.push(texture);
      textureDisposeCounts.set(texture, disposeCount);
      textureRegions.set(texture, textureRegion);
      return texture;
    };

    const rejectUnsupported = (reason: string) => {
      finishWithResult(unsupportedResult(options.generation, reason));
    };

    const readSnapshots = async (renderContext: NativeRenderContext) => {
      try {
        if (!options.isCaptureActive()) throw new AnatomyGpuCaptureCancelledError("renderer-generation-retired");
        readbackStarted = true;
        const pendingReadbacks: Promise<ArrayBufferView>[] = [];
        for (const texture of ownedTextures) {
          if (!options.isCaptureActive()) throw new AnatomyGpuCaptureCancelledError("renderer-generation-retired");
          const textureRegion = textureRegions.get(texture);
          if (!textureRegion) throw new Error("Owned native framebuffer texture lost its capture dimensions");
          pendingReadbacks.push(copyNativeTextureToOwnedBuffer(
            backend,
            texture,
            textureRegion.width,
            textureRegion.height,
            0,
            () => { readbackBufferCount += 1; },
            (failed) => {
              readbackBufferDestroyCount += 1;
              if (failed) readbackBufferDisposalFailures += 1;
            },
          ));
        }
        const rawReadbacks = await options.awaitReadbacks(pendingReadbacks);
        if (!options.isCaptureActive()) throw new AnatomyGpuCaptureCancelledError("renderer-generation-retired");
        if (rawReadbacks.length !== ownedTextures.length || rawReadbacks.some((readback) => !(readback instanceof Uint8Array))) {
          throw new Error("Native normalized-color readback did not return the expected Uint8Array resources");
        }
        const packedReadbacks = rawReadbacks.map((readback, index) => {
          const texture = ownedTextures[index];
          const textureRegion = texture ? textureRegions.get(texture) : undefined;
          if (!textureRegion) throw new Error("Native framebuffer row shape is missing its owning texture dimensions");
          return unpackAnatomyGpuRgbaReadbackRows(readback as Uint8Array, textureRegion.width, textureRegion.height);
        });
        const observations = drafts.map((draft) => {
          if (!draft.after) throw new Error("A native selected draw has no post-draw framebuffer snapshot");
          const beforePixels = packedReadbacks[draft.before.order];
          const afterPixels = packedReadbacks[draft.after.order];
          if (!beforePixels || !afterPixels) throw new Error("Native framebuffer snapshot readback is missing");
          const destination = anatomyNativeFramebufferSamples(
            beforePixels,
            fullWidth,
            draft.before.region,
            sourceFormat,
            options.samplePixelIndices,
          );
          const postDraw = anatomyNativeFramebufferSamples(
            afterPixels,
            fullWidth,
            draft.after.region,
            sourceFormat,
            options.samplePixelIndices,
          );
          return {
            call: `native-${draft.nativeCommand}`,
            drawOrder: draft.order,
            renderObjectId: draft.renderObjectId,
            renderPassId: draft.renderPassId,
            passId: draft.passId,
            commandCount: draft.commandCount,
            drawParameters: draft.drawParameters,
            state: {
              passStateBeforeSplit: draft.passStateBeforeSplit,
              drawPassState: draft.drawPassState,
              colorAttachment: {
                format: sourceFormat,
                sampleCount: actualSampleCount,
                resolvedCanvasCopy: actualSampleCount > 1,
                depthEnabled: renderContext.depth ?? false,
                stencilEnabled: renderContext.stencil ?? false,
                depthStencilFormat: backend.utils?.getCurrentDepthStencilFormat?.(renderContext) ?? null,
              },
              viewport: draft.viewport,
              scissor: draft.scissor,
              scissorTest: draft.scissorTest,
            },
            pipeline: {
              id: draft.pipelineId,
              colorFormat: backend.utils?.getCurrentColorFormat?.(renderContext) ?? null,
              colorSpace: renderer.outputColorSpace ?? null,
            },
            materialId: draft.materialId,
            sourceMaterialId: draft.sourceMaterialId,
            material: draft.material,
            sourceMaterial: draft.sourceMaterial,
            destinationAndPostDrawSamples: destination.map((sample, index) => ({
              index: sample.index,
              x: sample.x,
              y: sample.y,
              destination: sample.rgba,
              postDraw: postDraw[index]?.rgba ?? null,
            })),
            response: drawResponse(destination, postDraw),
          };
        });
        if (observations.length === 0) {
          rejectUnsupported("selected-renderable-issued-no-qualifiable-native-draw");
          return;
        }
        if (!finalFrameSnapshot) {
          rejectUnsupported("instrumented-frame-final-attachment-snapshot-unavailable");
          return;
        }
        const finalFramePixels = packedReadbacks[finalFrameSnapshot.order];
        if (!finalFramePixels) throw new Error("Instrumented frame final attachment readback is missing");
        const finalFrameSamples = anatomyNativeFramebufferSamples(
          finalFramePixels,
          fullWidth,
          finalFrameRegion,
          sourceFormat,
          options.samplePixelIndices,
        );
        const baselineParity = compareNativeFrameToBaseline(
          finalFramePixels,
          fullWidth,
          fullHeight,
          sourceFormat,
          {
            width: options.baselineCanvas!.width,
            height: options.baselineCanvas!.height,
            pixels: baselineCanvasPixels,
            repeatNoiseMae: options.baselineCanvas!.repeatNoiseMae,
          },
        );
        const changed = observations.some((observation) => observation.response.changedSampleCount > 0);
        finishWithResult({
          status: "ok",
          generation: options.generation,
          method: "native-draw-boundary",
          feasibility: baselineParity.qualified ? "F1" : "F2",
          rendererRuntime: options.runtime,
          threeRevision: options.threeRevision,
          selectedRenderable: {
            id: options.selected.uuid,
            name: options.selected.name,
            geometry: geometryMetadata(options.selected.geometry),
          },
          attachment: {
            width: fullWidth,
            height: fullHeight,
            format: sourceFormat,
            sampleCount: actualSampleCount,
            representation: "raw native canvas 8-bit normalized color bytes, reported in RGBA channel order; no browser canvas composition",
            premultiplication: {
              canvasAlphaMode: backend.context?.getConfiguration?.().alphaMode ?? null,
              interpretation: "raw attachment RGB and alpha bytes; browser canvas composition is not included",
            },
            outputColorSpace: renderer.outputColorSpace ?? null,
            toneMapping: renderer.toneMapping ?? null,
            sampledRegion: region,
            sampleCountInSelectedSet: options.samplePixelIndices.length,
          },
          drawObservations: observations,
          finalFrame: {
            classification: baselineParity.qualified ? "F1" : "F2",
            rawFramebufferSamples: finalFrameSamples,
            screenshotParity: baselineParity,
            baselineComparisonRegion: "full native drawing buffer compared to the same-mode pre-instrumentation canvas screenshot by screenshot-pixel cell centers",
          },
          measurement: {
            directDestinationAndPostDrawAttachmentSamples: true,
            actualDrawCommandBoundary: observations.every((observation) => observation.commandCount === 1),
            changedAtLeastOneFixedSample: changed,
            colorRepresentationCompatibleWithWebGlRgba8AfterChannelNormalization: true,
            browserCompositionIncluded: false,
          },
          passSegmentation: {
            method: "renderer.copyFramebufferToTexture within the selected live render pass",
            sameCommandEncoder: true,
            resumedColorLoadOp: "load",
            resumedDepthLoadOp: renderContext.depth ? "load" : null,
            resumedStencilLoadOp: renderContext.stencil ? "load" : null,
            renderPassCountAdded: observations.length * 2,
            finalFramePassCountAdded: 1,
            finalFrameParity: baselineParity,
            finalFrameParityRequired: true,
          },
        });
      } catch (cause) {
        fail(cause);
      }
    };

    const onCancel = () => {
      cleanupRequested = true;
      window.clearTimeout(timeoutId);
      restoreDrawHook();
      unregisterCancellation();
      if (!readbackStarted) fail(new AnatomyGpuCaptureCancelledError("renderer-generation-retired"));
      else restoreFinishHook();
    };

    unregisterCleanup = options.registerCleanup(onCancel);

    const drawWrapperImplementation = function (this: unknown, renderObject: NativeRenderObject, info: unknown) {
      if (settled) {
        return originalDraw.call(this, renderObject, info);
      }
      if (cleanupRequested || !options.isCaptureActive()) {
        onCancel();
        return originalDraw.call(this, renderObject, info);
      }

      if (renderObject.object !== options.selected ||
          !renderObject.material ||
          (options.sourceMaterialId && options.resolveSourceMaterial(renderObject.material).uuid !== options.sourceMaterialId)) {
        return originalDraw.call(this, renderObject, info);
      }

      const context = renderObject.context;
      if (!context) return originalDraw.call(this, renderObject, info);
      if (captureContext && captureContext !== context) return originalDraw.call(this, renderObject, info);
      if (captureContext === null && (context.renderTarget !== null || context.textures !== null)) {
        return originalDraw.call(this, renderObject, info);
      }

      const contextData = backend.get(context) as NativeRenderContextData;
      const sourceTexture = backend.context?.getCurrentTexture?.();
      const sourceFormat = sourceTexture?.format;
      if (!sourceFormat) {
        rejectUnsupported("live-webgpu-canvas-texture-format-unavailable");
        return originalDraw.call(this, renderObject, info);
      }
      const unsupportedReason = passPreservingRuntimeReason(renderer, backend, context, contextData, sourceFormat);
      if (unsupportedReason) {
        rejectUnsupported(unsupportedReason);
        return originalDraw.call(this, renderObject, info);
      }

      const drawDescription = describeAnatomyNativeDrawCommands(
        renderObject as unknown as Parameters<typeof describeAnatomyNativeDrawCommands>[0],
      );
      if (!drawDescription.supported || drawDescription.commandCount !== 1) {
        rejectUnsupported(drawDescription.reason ?? "backend-draw-does-not-map-to-one-native-draw-command");
        return originalDraw.call(this, renderObject, info);
      }
      const pipelineData = renderObject.pipeline ? backend.get(renderObject.pipeline) as Readonly<Record<string, unknown>> : null;
      if (!pipelineData || !pipelineData.pipeline || pipelineData.error === true) {
        rejectUnsupported("native-render-pipeline-identity-unavailable-or-invalid");
        return originalDraw.call(this, renderObject, info);
      }

      const passBeforeSplit = contextData.currentPass;
      const descriptorBeforeSplit = contextData.descriptor;
      if (!passBeforeSplit || !descriptorBeforeSplit) {
        rejectUnsupported("native-render-pass-state-unavailable-before-selected-draw");
        return originalDraw.call(this, renderObject, info);
      }
      const passStateBeforeSplit = passMetadata(contextData);
      const effectiveSampleCount = backend.utils?.getSampleCountRenderContext?.(context) ?? 1;
      actualSampleCount = effectiveSampleCount;
      const descriptorColor = descriptorBeforeSplit.colorAttachments?.[0];
      const hasResolveTarget = descriptorColor?.resolveTarget !== undefined && descriptorColor?.resolveTarget !== null;
      if ((effectiveSampleCount > 1) !== hasResolveTarget) {
        rejectUnsupported("native-default-framebuffer-msaa-resolve-shape-is-inconsistent");
        return originalDraw.call(this, renderObject, info);
      }

      let beforeTexture: THREE.FramebufferTexture;
      captureContext = context;
      copiesEncoded = true;
      try {
        beforeTexture = createTexture(sourceFormat);
        renderer.copyFramebufferToTexture!(beforeTexture, rectangle);
      } catch (cause) {
        fail(cause);
        return originalDraw.call(this, renderObject, info);
      }

      const drawPass = contextData.currentPass;
      const descriptorDuringDraw = contextData.descriptor;
      if (!drawPass || drawPass === passBeforeSplit || !descriptorDuringDraw ||
          !isLoadPreservingState(context, descriptorDuringDraw)) {
        rejectUnsupported("r186-framebuffer-copy-did-not-resume-color-depth-stencil-with-load");
        return originalDraw.call(this, renderObject, info);
      }

      captureContext = context;
      const draft: DrawDraft = {
        order: drawOrder++,
        renderObjectId: typeof renderObject.id === "number" ? renderObject.id : null,
        renderPassId: passIdentity(drawPass),
        passId: renderObject.passId ?? null,
        nativeCommand: drawDescription.kind === "draw-indexed" ? "drawIndexed" :
          drawDescription.kind === "draw-indexed-indirect" ? "drawIndexedIndirect" :
            drawDescription.kind === "draw-indirect" ? "drawIndirect" : "draw",
        commandCount: drawDescription.commandCount,
        drawParameters: {
          ...((renderObject.getDrawParameters?.() as Readonly<Record<string, unknown>> | null | undefined) ?? {}),
        },
        pipelineId: typeof renderObject.pipeline?.id === "number" ? renderObject.pipeline.id : null,
        materialId: renderObject.material.uuid,
        sourceMaterialId: options.resolveSourceMaterial(renderObject.material).uuid,
        material: materialMetadata(renderObject.material, backend),
        sourceMaterial: materialMetadata(options.resolveSourceMaterial(renderObject.material), backend),
        passStateBeforeSplit,
        drawPassState: passMetadata(contextData),
        viewport: context.viewportValue ? { ...context.viewportValue } : null,
        scissor: context.scissorValue ? { ...context.scissorValue } : null,
        scissorTest: renderer.getScissorTest?.() ?? null,
        before: { texture: beforeTexture, order: ownedTextures.indexOf(beforeTexture), region },
        after: null,
      };

      const result = originalDraw.call(this, renderObject, info);
      if (settled) {
        return result;
      }
      if (cleanupRequested || !options.isCaptureActive()) {
        onCancel();
        return result;
      }
      try {
        const beforePostSplit = contextData.currentPass;
        const afterTexture = createTexture(sourceFormat);
        renderer.copyFramebufferToTexture!(afterTexture, rectangle);
        const resumedAfterPost = contextData.currentPass;
        const descriptorAfterPost = contextData.descriptor;
        if (!resumedAfterPost || resumedAfterPost === beforePostSplit || !descriptorAfterPost ||
            !isLoadPreservingState(context, descriptorAfterPost)) {
          rejectUnsupported("r186-post-draw-copy-did-not-resume-color-depth-stencil-with-load");
          return result;
        }
        draft.after = { texture: afterTexture, order: ownedTextures.indexOf(afterTexture), region };
        drafts.push(draft);
      } catch (cause) {
        fail(cause);
      }
      return result;
    };

    wrappers.draw = drawWrapperImplementation as NativeBackend["draw"];
    const finishWrapperImplementation = function (this: unknown, renderContext: NativeRenderContext) {
      if (captureContext === renderContext && drafts.length > 0 && !settled && !cleanupRequested) {
        if (!options.isCaptureActive()) {
          onCancel();
        } else {
          const contextData = backend.get(renderContext) as NativeRenderContextData;
          const currentSourceFormat = backend.context?.getCurrentTexture?.()?.format;
          const unsupportedReason = currentSourceFormat
            ? passPreservingRuntimeReason(renderer, backend, renderContext, contextData, currentSourceFormat)
            : "live-webgpu-canvas-texture-format-unavailable-at-final-frame-boundary";
          if (unsupportedReason) {
            fail(new Error(unsupportedReason));
          } else {
            try {
              copiesEncoded = true;
              const texture = createTexture(sourceFormat, finalFrameRegion);
              const passBeforeCopy = contextData.currentPass;
              renderer.copyFramebufferToTexture!(texture, finalFrameRectangle);
              const resumedPass = contextData.currentPass;
              const descriptor = contextData.descriptor;
              if (!resumedPass || resumedPass === passBeforeCopy || !descriptor ||
                  !isLoadPreservingState(renderContext, descriptor)) {
                fail(new Error("r186-final-frame-copy-did-not-resume-color-depth-stencil-with-load"));
              } else {
                finalFrameSnapshot = {
                  texture,
                  order: ownedTextures.indexOf(texture),
                  region: finalFrameRegion,
                };
              }
            } catch (cause) {
              fail(cause);
            }
          }
        }
      }
      let result: unknown;
      try {
        result = originalFinishRender.call(this, renderContext);
      } catch (cause) {
        if (captureContext === renderContext) {
          encoderSubmitted = true;
          if (pendingOutcome) settleOutcome(pendingOutcome);
        }
        throw cause;
      }
      if (captureContext === renderContext) {
        encoderSubmitted = true;
        if (pendingOutcome) {
          settleOutcome(pendingOutcome);
        } else if (!settled && !cleanupRequested && drafts.length > 0) {
          readbackStarted = true;
          restoreHooks();
          void readSnapshots(renderContext);
        }
      }
      return result;
    };
    wrappers.finishRender = finishWrapperImplementation as NativeBackend["finishRender"];
    nativeBackend.draw = wrappers.draw;
    nativeBackend.finishRender = wrappers.finishRender;
    timeoutId = window.setTimeout(() => {
      if (drafts.length === 0) rejectUnsupported("selected-renderable-did-not-issue-a-qualifiable-native-draw-before-timeout");
    }, 10_000);

    // Keep the chosen canvas format in the lexical scope used when decoding readbacks.
    const sourceFormat = backend.utils?.getPreferredCanvasFormat?.() ?? "";
    if (!sourceFormat) rejectUnsupported("r186-preferred-native-canvas-format-unavailable");
  });
};
