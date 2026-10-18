import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  classifyAnatomyGpuCaptureFeasibility,
  summarizeAnatomyGpuDrawResponse,
  unpackAnatomyGpuRgbaReadbackRows,
  AnatomyGpuCaptureCancelledError,
  throwIfAnatomyGpuCaptureAborted,
  ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT,
  ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT,
  type AnatomyGpuCaptureMethod,
} from "./backend/anatomyGpuBlendIntermediate";
import { runAnatomyGpuBlendCalibration } from "./backend/anatomyGpuBlendCalibration";
import { runAnatomyBellowsDrawMetadataCapture } from "./backend/anatomyBellowsDrawMetadataCapture";
import { readMInv8NativePipelineObserver } from "./backend/anatomyBellowsNativePipelineEvidence";
import {
  runAnatomyNativeWebGpuDrawBoundaryCapture,
  runAnatomyNativeWebGpuFinalFrameCapture,
  type AnatomyNativeBoundarySelection,
} from "./backend/anatomyNativeWebGpuDrawBoundaryCapture";
import {
  resolveAnatomyOutputIntervention,
  type AnatomyOutputInterventionRenderable,
} from "./backend/anatomyMaterialOutputIntervention";
import { classifyAnatomyMaterialRole } from "./anatomyMaterialRoles";
import { resolveObserverRendererRuntime } from "./backend/observerVisualPipelineCapabilities";
import { readObserverOutputSourceMaterial } from "./backend/observerMaterialOutputIdentity";
import { isAnatomyRendererGenerationCurrent } from "./anatomyRenderableContribution";
import type { ConceptualCameraAnatomyPresentation } from "./ConceptualViewCamera";

type AnatomyGpuCaptureRequest = Readonly<{
  requestId: string;
  generation: number;
  method: AnatomyGpuCaptureMethod | "calibration" | "bellows-draw-metadata";
  renderableId?: string;
  sourceMaterialId?: string;
  boundarySelection?: AnatomyNativeBoundarySelection;
  maskPixelIndices?: readonly number[];
  samplePixelIndices?: readonly number[];
  baselineCanvas?: Readonly<{
    width: number;
    height: number;
    rgbaBase64: string;
    repeatNoiseMae: number;
  }>;
  includeRawFramebuffer?: boolean;
}>;

type ActiveAnatomyGpuCapture = {
  requestId: string;
  generation: number;
  method: AnatomyGpuCaptureRequest["method"];
  resourceCleanup: Record<string, unknown>;
};

const anatomyGpuCaptureProbeOwners = new WeakMap<HTMLElement, object>();
const anatomyGpuCaptureReadbackPendingEvent =
  "vcs:observer-verification:anatomy-gpu-blend-intermediate-readback-pending";
const anatomyGpuCaptureSettledEvent =
  "vcs:observer-verification:anatomy-gpu-blend-intermediate-capture-settled";

type DisposableRenderer = {
  getRenderTarget: () => THREE.RenderTarget | null;
  setRenderTarget: (target: THREE.RenderTarget | null) => void;
  getDrawingBufferSize: (target: THREE.Vector2) => THREE.Vector2;
  getViewport: (target: THREE.Vector4) => THREE.Vector4;
  setViewport: (viewport: THREE.Vector4) => void;
  getScissor: (target: THREE.Vector4) => THREE.Vector4;
  setScissor: (scissor: THREE.Vector4) => void;
  getScissorTest: () => boolean;
  setScissorTest: (value: boolean) => void;
  getClearColor: (target: THREE.Color) => THREE.Color;
  getClearAlpha: () => number;
  setClearColor: (color: THREE.Color | number | string, alpha?: number) => void;
  clear: (color?: boolean, depth?: boolean, stencil?: boolean) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => unknown;
  readRenderTargetPixels?: (
    target: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Float32Array,
  ) => void;
  readRenderTargetPixelsAsync?: (
    target: THREE.RenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<ArrayBufferView>;
};

type DrawState = Readonly<{
  blendEnabled: boolean;
  blendSourceRgb: string;
  blendDestinationRgb: string;
  blendEquationRgb: string;
  blendSourceAlpha: string;
  blendDestinationAlpha: string;
  blendEquationAlpha: string;
  depthTest: boolean;
  depthWrite: boolean;
  depthFunction: string;
  stencilTest: boolean;
  framebufferReadBindingIsDefault: boolean;
  framebufferDrawBindingIsDefault: boolean;
  contextAttributes: WebGLContextAttributes | null;
  drawingBufferColorSpace: string | null;
  framebufferColorEncoding: string | null;
}>;

const isRenderable = (object: THREE.Object3D): object is THREE.Object3D & {
  material: THREE.Material | THREE.Material[];
  geometry: THREE.BufferGeometry;
} => {
  const candidate = object as THREE.Object3D & { isMesh?: boolean; isLine?: boolean; isPoints?: boolean };
  return candidate.isMesh === true || candidate.isLine === true || candidate.isPoints === true;
};

const isEffectivelyVisible = (object: THREE.Object3D, scene: THREE.Scene): boolean => {
  let ancestor: THREE.Object3D | null = object;
  while (ancestor && ancestor !== scene) {
    if (!ancestor.visible) return false;
    ancestor = ancestor.parent;
  }
  return true;
};

const currentInterventionRecords = (scene: THREE.Scene): AnatomyOutputInterventionRenderable[] => {
  const records: AnatomyOutputInterventionRenderable[] = [];
  scene.traverse((object) => {
    if (!isRenderable(object)) return;
    const classification = classifyAnatomyMaterialRole(object, scene);
    records.push({
      id: object.uuid,
      role: classification.role,
      cameraPart: classification.cameraPart,
      visible: isEffectivelyVisible(object, scene),
    });
  });
  return records;
};

const sourceMaterialFor = (material: THREE.Material): THREE.Material =>
  readObserverOutputSourceMaterial(material) ?? material;

const sourceMaterialSnapshot = (material: THREE.Material) => {
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    roughness?: number;
    metalness?: number;
    outputTransform?: string;
    outputInterventionId?: string;
  };
  return {
    id: material.uuid,
    type: material.type,
    color: candidate.color?.getHexString() ?? null,
    emissive: candidate.emissive?.getHexString() ?? null,
    roughness: candidate.roughness ?? null,
    metalness: candidate.metalness ?? null,
    opacity: material.opacity,
    transparent: material.transparent,
    blending: material.blending,
    premultipliedAlpha: material.premultipliedAlpha,
    toneMapped: material.toneMapped,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    side: material.side,
    alphaTest: material.alphaTest,
    outputTransform: candidate.outputTransform ?? null,
    outputInterventionId: candidate.outputInterventionId ?? null,
  };
};

const glConstantName = (gl: WebGL2RenderingContext, value: number, names: readonly string[]): string =>
  names.find((name) => (gl as unknown as Record<string, unknown>)[name] === value) ?? `enum:${value}`;

const readWebGlDrawState = (gl: WebGL2RenderingContext): DrawState => {
  let framebufferColorEncoding: string | null = null;
  try {
    const encoding = gl.getFramebufferAttachmentParameter(
      gl.FRAMEBUFFER,
      gl.BACK,
      gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING,
    ) as number;
    framebufferColorEncoding = glConstantName(gl, encoding, ["LINEAR", "SRGB"]);
  } catch {
    framebufferColorEncoding = null;
  }
  const colorSpace = (gl as WebGL2RenderingContext & { drawingBufferColorSpace?: string }).drawingBufferColorSpace;
  return {
    blendEnabled: gl.isEnabled(gl.BLEND),
    blendSourceRgb: glConstantName(gl, gl.getParameter(gl.BLEND_SRC_RGB) as number, [
      "ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR", "DST_COLOR", "ONE_MINUS_DST_COLOR",
      "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA", "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR",
      "ONE_MINUS_CONSTANT_COLOR", "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE",
    ]),
    blendDestinationRgb: glConstantName(gl, gl.getParameter(gl.BLEND_DST_RGB) as number, [
      "ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR", "DST_COLOR", "ONE_MINUS_DST_COLOR",
      "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA", "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR",
      "ONE_MINUS_CONSTANT_COLOR", "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE",
    ]),
    blendEquationRgb: glConstantName(gl, gl.getParameter(gl.BLEND_EQUATION_RGB) as number, [
      "FUNC_ADD", "FUNC_SUBTRACT", "FUNC_REVERSE_SUBTRACT", "MIN", "MAX",
    ]),
    blendSourceAlpha: glConstantName(gl, gl.getParameter(gl.BLEND_SRC_ALPHA) as number, [
      "ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR", "DST_COLOR", "ONE_MINUS_DST_COLOR",
      "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA", "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR",
      "ONE_MINUS_CONSTANT_COLOR", "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE",
    ]),
    blendDestinationAlpha: glConstantName(gl, gl.getParameter(gl.BLEND_DST_ALPHA) as number, [
      "ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR", "DST_COLOR", "ONE_MINUS_DST_COLOR",
      "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA", "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR",
      "ONE_MINUS_CONSTANT_COLOR", "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE",
    ]),
    blendEquationAlpha: glConstantName(gl, gl.getParameter(gl.BLEND_EQUATION_ALPHA) as number, [
      "FUNC_ADD", "FUNC_SUBTRACT", "FUNC_REVERSE_SUBTRACT", "MIN", "MAX",
    ]),
    depthTest: gl.isEnabled(gl.DEPTH_TEST),
    depthWrite: gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
    depthFunction: glConstantName(gl, gl.getParameter(gl.DEPTH_FUNC) as number, [
      "NEVER", "LESS", "EQUAL", "LEQUAL", "GREATER", "NOTEQUAL", "GEQUAL", "ALWAYS",
    ]),
    stencilTest: gl.isEnabled(gl.STENCIL_TEST),
    framebufferReadBindingIsDefault: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) === null,
    framebufferDrawBindingIsDefault: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) === null,
    contextAttributes: gl.getContextAttributes(),
    drawingBufferColorSpace: typeof colorSpace === "string" ? colorSpace : null,
    framebufferColorEncoding,
  };
};

const readDefaultFramebuffer = (gl: WebGL2RenderingContext): Uint8Array => {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width < 1 || height < 1) throw new Error("WebGL drawing buffer has an empty size");
  if (gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) !== null ||
      gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) !== null) {
    throw new Error("Direct draw capture requires the default canvas framebuffer");
  }
  const bottomUp = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
  const topDown = new Uint8Array(bottomUp.length);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y;
    topDown.set(bottomUp.subarray(sourceRow * rowBytes, (sourceRow + 1) * rowBytes), y * rowBytes);
  }
  return topDown;
};

const orientRenderTargetPixels = (
  source: Float32Array,
  width: number,
  height: number,
  rowOrder: "bottom-up" | "top-down",
): Float32Array => {
  if (rowOrder === "top-down") return source;
  const target = new Float32Array(source.length);
  const rowComponents = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y;
    target.set(source.subarray(sourceRow * rowComponents, (sourceRow + 1) * rowComponents), y * rowComponents);
  }
  return target;
};

const readRenderTargetFloatPixels = (
  renderer: DisposableRenderer,
  runtime: ReturnType<typeof resolveObserverRendererRuntime>,
  target: THREE.WebGLRenderTarget,
  awaitReadback?: (readback: Promise<ArrayBufferView>) => Promise<ArrayBufferView>,
): Float32Array | Promise<Float32Array> => {
  const { width, height } = target;
  const rowOrder = runtime.executionBackend === "webgl2" ? "bottom-up" : "top-down";
  if (runtime.executionBackend === "webgl2") {
    if (!renderer.readRenderTargetPixels) throw new Error("WebGL FloatType render-target readback is unavailable");
    const pixels = new Float32Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    return orientRenderTargetPixels(pixels, width, height, rowOrder);
  }
  if (runtime.executionBackend !== "webgpu" || !renderer.readRenderTargetPixelsAsync) {
    throw new Error("The mounted backend does not support qualified FloatType readback");
  }
  const readback = renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height);
  const settledReadback = awaitReadback ? awaitReadback(readback) : readback;
  return settledReadback.then((raw) => {
    if (!(raw instanceof Float32Array)) {
      throw new Error(`FloatType readback returned ${raw.constructor.name} with ${raw.byteLength} bytes`);
    }
    return orientRenderTargetPixels(unpackAnatomyGpuRgbaReadbackRows(raw, width, height), width, height, rowOrder);
  });
};

const materialOutputRepresentation = (
  runtime: ReturnType<typeof resolveObserverRendererRuntime>,
  material: THREE.Material,
): "linear-working-rgba32f-straight-alpha" | "tone-mapped-linear-rgba32f-straight-alpha" | "srgb-encoded-rgba32f-straight-alpha" => {
  const outputTransform = (material as THREE.Material & { outputTransform?: string }).outputTransform;
  if (outputTransform === "material-aware" || outputTransform === "bypass-tone-mapping") {
    return "srgb-encoded-rgba32f-straight-alpha";
  }
  if (outputTransform === "bypass-color-space") {
    return "tone-mapped-linear-rgba32f-straight-alpha";
  }
  if (runtime.executionBackend === "webgl2") return "srgb-encoded-rgba32f-straight-alpha";
  return "linear-working-rgba32f-straight-alpha";
};

const samplesAtIndices = (
  pixels: Float32Array,
  width: number,
  indices: readonly number[],
) => indices.map((index) => {
  const offset = index * 4;
  return {
    index,
    rgba: [pixels[offset] ?? null, pixels[offset + 1] ?? null, pixels[offset + 2] ?? null, pixels[offset + 3] ?? null],
    x: index % width,
    y: Math.floor(index / width),
  };
});

const emitResult = (container: HTMLElement, requestId: string, detail: Readonly<Record<string, unknown>>): void => {
  container.dispatchEvent(new CustomEvent(ANATOMY_GPU_BLEND_INTERMEDIATE_RESULT_EVENT, {
    detail: { requestId, ...detail },
  }));
};

export const AnatomyGpuBlendIntermediateProbe = ({
  generation,
  anatomyPresentation,
}: Readonly<{
  generation: number;
  anatomyPresentation: ConceptualCameraAnatomyPresentation | null;
}>) => {
  const { camera, gl, scene } = useThree();
  const anatomyPresentationRef = useRef(anatomyPresentation);
  anatomyPresentationRef.current = anatomyPresentation;

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;
    const mountIdentity = {};
    const lifetimeController = new AbortController();
    const nativeBackend = (gl as unknown as { backend?: { device?: object } }).backend;
    const nativeDevice = nativeBackend?.device ?? null;
    const nativePipelineObserver = nativeDevice ? readMInv8NativePipelineObserver() : null;
    if (nativeDevice) nativePipelineObserver?.attachDevice(nativeDevice, generation, mountIdentity);
    let lifetimeActive = true;
    let activeCapture: ActiveAnatomyGpuCapture | null = null;
    let directCaptureCleanup: (() => void) | null = null;
    const nativeCaptureCleanups = new Set<() => void>();

    anatomyGpuCaptureProbeOwners.set(container, mountIdentity);

    const ownsDestination = (): boolean => lifetimeActive &&
      anatomyGpuCaptureProbeOwners.get(container) === mountIdentity &&
      container.isConnected &&
      container.getAttribute("data-observer-renderer-generation") === String(generation);

    const invalidateLifetime = (reason: string) => {
      if (!lifetimeActive) return;
      lifetimeActive = false;
      lifetimeController.abort(new AnatomyGpuCaptureCancelledError(reason));
      try {
        if (nativeDevice) nativePipelineObserver?.restoreDevice(nativeDevice, generation, mountIdentity);
      } catch {
        // A diagnostic observer must never prevent the retiring capture from cleaning up.
      }
      activeCapture = null;
      directCaptureCleanup?.();
      for (const cleanup of [...nativeCaptureCleanups]) {
        try {
          cleanup();
        } catch {
          // One retiring capture must not prevent other native resources from cleaning up.
        }
      }
    };

    const rendererContextAvailable = (): boolean => {
      try {
        const context = (gl as unknown as {
          getContext?: () => { isContextLost?: () => boolean } | null;
        }).getContext?.();
        if (context?.isContextLost?.()) {
          invalidateLifetime("renderer-context-unavailable");
          return false;
        }
        return lifetimeActive;
      } catch {
        invalidateLifetime("renderer-context-unavailable");
        return false;
      }
    };

    const handleWebGlContextLost = () => invalidateLifetime("renderer-context-unavailable");
    gl.domElement.addEventListener("webglcontextlost", handleWebGlContextLost);
    const webGpuDeviceLost = (gl as unknown as {
      backend?: { device?: { lost?: PromiseLike<unknown> } };
    }).backend?.device?.lost;
    if (webGpuDeviceLost) {
      void Promise.resolve(webGpuDeviceLost).then(
        () => invalidateLifetime("renderer-context-unavailable"),
        () => invalidateLifetime("renderer-context-unavailable"),
      ).catch(() => undefined);
    }

    const captureIsActive = (operation: ActiveAnatomyGpuCapture): boolean => {
      if (!lifetimeActive || lifetimeController.signal.aborted || activeCapture !== operation) return false;
      if (!ownsDestination()) {
        invalidateLifetime("renderer-generation-retired");
        return false;
      }
      if (!rendererContextAvailable()) return false;
      return isAnatomyRendererGenerationCurrent(operation.generation, generation);
    };

    const assertCaptureActive = (operation: ActiveAnatomyGpuCapture) => {
      if (captureIsActive(operation)) return;
      throwIfAnatomyGpuCaptureAborted(lifetimeController.signal);
      throw new AnatomyGpuCaptureCancelledError("Anatomy probe no longer owns this renderer generation.");
    };

    const beginCapture = (request: AnatomyGpuCaptureRequest): ActiveAnatomyGpuCapture | null => {
      if (!lifetimeActive || anatomyGpuCaptureProbeOwners.get(container) !== mountIdentity) return null;
      if (!isAnatomyRendererGenerationCurrent(request.generation, generation)) {
        reject(request.requestId, "stale-renderer-generation");
        return null;
      }
      if (!ownsDestination() || !rendererContextAvailable()) {
        invalidateLifetime("renderer-generation-retired");
        return null;
      }
      if (activeCapture) {
        reject(request.requestId, "capture-already-active");
        return null;
      }
      const operation: ActiveAnatomyGpuCapture = {
        requestId: request.requestId,
        generation: request.generation,
        method: request.method,
        resourceCleanup: {},
      };
      activeCapture = operation;
      return operation;
    };

    const rejectionDetail = (reason: string, feasibility = "F0") => ({
      status: "rejected",
      feasibility,
      reason,
      generation,
    });

    const completeCapture = (
      operation: ActiveAnatomyGpuCapture,
      result: Readonly<Record<string, unknown>> | null,
      settlement: string,
    ) => {
      const publish = result !== null && captureIsActive(operation);
      if (activeCapture === operation) activeCapture = null;
      if (publish && result) emitResult(container, operation.requestId, result);
      if (import.meta.env.DEV) {
        container.dispatchEvent(new CustomEvent(anatomyGpuCaptureSettledEvent, {
          detail: {
            requestId: operation.requestId,
            method: operation.method,
            generation: operation.generation,
            status: publish ? settlement : "cancelled",
            resourceCleanup: operation.resourceCleanup,
          },
        }));
      }
    };

    const runCapture = async (
      request: AnatomyGpuCaptureRequest,
      capture: (operation: ActiveAnatomyGpuCapture) => Promise<Readonly<Record<string, unknown>>>,
    ): Promise<void> => {
      const operation = beginCapture(request);
      if (!operation) return;
      let result: Readonly<Record<string, unknown>> | null = null;
      let settlement = "completed";
      try {
        result = await capture(operation);
        if (result.status === "unsupported" || result.status === "rejected") settlement = String(result.status);
      } catch (cause) {
        if (captureIsActive(operation)) {
          result = rejectionDetail(cause instanceof Error ? cause.message : String(cause));
          settlement = "failed";
        } else {
          settlement = "cancelled";
        }
      } finally {
        completeCapture(operation, result, settlement);
      }
    };

    const awaitCaptureReadback = async <T extends ArrayBufferView>(
      operation: ActiveAnatomyGpuCapture,
      readback: Promise<T>,
    ): Promise<T> => {
      const waits: Promise<unknown>[] = [];
      if (import.meta.env.DEV) {
        container.dispatchEvent(new CustomEvent(anatomyGpuCaptureReadbackPendingEvent, {
          detail: {
            requestId: operation.requestId,
            method: operation.method,
            defer: (wait: Promise<unknown>) => { waits.push(wait); },
          },
        }));
      }
      const settledReadback = readback.then(
        (pixels) => ({ ok: true as const, pixels }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const settledWaits = Promise.all(waits).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const [readbackResult, waitsResult] = await Promise.all([settledReadback, settledWaits]);
      assertCaptureActive(operation);
      if (!readbackResult.ok) throw readbackResult.error;
      if (!waitsResult.ok) throw waitsResult.error;
      return readbackResult.pixels;
    };

    const awaitCaptureReadbacks = async (
      operation: ActiveAnatomyGpuCapture,
      readbacks: readonly Promise<ArrayBufferView>[],
    ): Promise<readonly ArrayBufferView[]> => {
      const waits: Promise<unknown>[] = [];
      if (import.meta.env.DEV) {
        container.dispatchEvent(new CustomEvent(anatomyGpuCaptureReadbackPendingEvent, {
          detail: {
            requestId: operation.requestId,
            method: operation.method,
            readbackCount: readbacks.length,
            defer: (wait: Promise<unknown>) => { waits.push(wait); },
          },
        }));
      }
      const settledReadbacks = Promise.all(readbacks.map((readback) => readback.then(
        (pixels) => ({ ok: true as const, pixels }),
        (error: unknown) => ({ ok: false as const, error }),
      )));
      const settledWaits = Promise.all(waits).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const [readbackResults, waitsResult] = await Promise.all([settledReadbacks, settledWaits]);
      assertCaptureActive(operation);
      const failedReadback = readbackResults.find((result) => !result.ok);
      if (failedReadback && !failedReadback.ok) throw failedReadback.error;
      if (!waitsResult.ok) throw waitsResult.error;
      return readbackResults.flatMap((result) => result.ok ? [result.pixels] : []);
    };

    const reject = (requestId: string, reason: string, feasibility = "F0") =>
      {
        if (!ownsDestination() || lifetimeController.signal.aborted || !rendererContextAvailable()) return;
        emitResult(container, requestId, rejectionDetail(reason, feasibility));
      };

    const resolveTarget = (request: AnatomyGpuCaptureRequest) => {
      if (!request.renderableId) return { error: "missing-renderable-id" as const };
      const target = scene.getObjectByProperty("uuid", request.renderableId);
      if (!target || !isRenderable(target)) return { error: "stale-renderable-id" as const };
      const records = currentInterventionRecords(scene);
      const resolution = resolveAnatomyOutputIntervention(
        "B1",
        anatomyPresentationRef.current,
        records,
        { kind: "renderable-ids", renderableIds: [request.renderableId] },
      );
      if (!resolution.ok) return { error: resolution.reason };
      if (!isEffectivelyVisible(target, scene)) return { error: "selected-renderable-not-visible" as const };
      const materials = Array.isArray(target.material) ? target.material : [target.material];
      const sources = materials.map(sourceMaterialFor);
      if (request.sourceMaterialId && !sources.some((material) => material.uuid === request.sourceMaterialId)) {
        return { error: "stale-source-material-id" as const };
      }
      return { target, materials, sources, resolution };
    };

    const handleCalibration = (request: AnatomyGpuCaptureRequest) => runCapture(request, async (operation) => {
      assertCaptureActive(operation);
      const runtime = resolveObserverRendererRuntime(gl);
      if (runtime.executionBackend !== "webgl2" && runtime.executionBackend !== "webgpu") {
        return rejectionDetail(`unqualified-renderer:${runtime.rendererFamily}/${runtime.executionBackend}`);
      }
      const result = await runAnatomyGpuBlendCalibration(gl, runtime, {
        signal: lifetimeController.signal,
        isCaptureActive: () => captureIsActive(operation),
        awaitReadback: (readback) => awaitCaptureReadback(operation, readback),
        onResourcesReleased: (lifecycle) => Object.assign(operation.resourceCleanup, lifecycle),
      });
      assertCaptureActive(operation);
      return { status: result.status, generation, calibration: result };
    });

    const handleProxy = (request: AnatomyGpuCaptureRequest) => runCapture(request, async (operation) => {
      assertCaptureActive(operation);
      const runtime = resolveObserverRendererRuntime(gl);
      const feasibility = classifyAnatomyGpuCaptureFeasibility(runtime, "single-renderable-replay");
      if (feasibility.classification !== "F2") {
        return rejectionDetail(feasibility.reason, feasibility.classification);
      }
      const selection = resolveTarget(request);
      if ("error" in selection) {
        return rejectionDetail(selection.error ?? "invalid-renderable-selection");
      }
      assertCaptureActive(operation);
      const { target: selected, materials, sources } = selection;
      const sourceSnapshotsBefore = sources.map(sourceMaterialSnapshot);
      const renderables: Array<THREE.Object3D & { visible: boolean }> = [];
      scene.traverse((object) => { if (isRenderable(object)) renderables.push(object); });
      const visibilityBefore = new Map(renderables.map((object) => [object, object.visible]));
      const originalMaterial = selected.material;
      const sourceGeometry = selected.geometry;
      const sceneWithBackground = scene as THREE.Scene & { backgroundNode?: unknown };
      const originalBackground = scene.background;
      const originalBackgroundNode = sceneWithBackground.backgroundNode;
      const renderer = gl as unknown as DisposableRenderer;
      const previousTarget = renderer.getRenderTarget();
      const previousViewport = renderer.getViewport(new THREE.Vector4()).clone();
      const previousScissor = renderer.getScissor(new THREE.Vector4()).clone();
      const previousScissorTest = renderer.getScissorTest();
      const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
      const previousClearAlpha = renderer.getClearAlpha();
      const dimensions = renderer.getDrawingBufferSize(new THREE.Vector2());
      const width = Math.max(1, Math.floor(dimensions.x));
      const height = Math.max(1, Math.floor(dimensions.y));
      const outputMode = (materials[0] as THREE.Material & { outputTransform?: string }).outputTransform ?? "standard";
      const targetColorSpace = outputMode === "material-aware" || outputMode === "bypass-tone-mapping" ||
        (runtime.executionBackend === "webgl2" && outputMode === "standard")
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
      const target = new THREE.WebGLRenderTarget(width, height, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        colorSpace: targetColorSpace,
        depthBuffer: true,
        stencilBuffer: false,
        generateMipmaps: false,
        samples: 0,
      });
      let targetDisposeCount = 0;
      let cloneDisposeCount = 0;
      target.addEventListener("dispose", () => { targetDisposeCount += 1; });
      const copies: THREE.Material[] = [];
      try {
        materials.forEach((material) => {
          assertCaptureActive(operation);
          const copy = material.clone();
          copies.push(copy);
          copy.addEventListener("dispose", () => { cloneDisposeCount += 1; });
          const originalExperimental = material as THREE.Material & {
            outputTransform?: string;
            outputInterventionId?: string;
          };
          const copyExperimental = copy as THREE.Material & {
            outputTransform?: string;
            outputInterventionId?: string;
          };
          if (originalExperimental.outputTransform) copyExperimental.outputTransform = originalExperimental.outputTransform;
          if (originalExperimental.outputInterventionId) copyExperimental.outputInterventionId = originalExperimental.outputInterventionId;
          copy.blending = THREE.NoBlending;
          copy.needsUpdate = true;
        });
      } catch (cause) {
        copies.forEach((copy) => copy.dispose());
        target.dispose();
        Object.assign(operation.resourceCleanup, {
          temporaryTargetDisposeCount: targetDisposeCount,
          temporaryMaterialDisposeCount: cloneDisposeCount,
          noBorrowedResourceDisposed: true,
        });
        throw cause;
      }
      let readback: Float32Array | Promise<Float32Array> | null = null;
      let error: string | null = null;
      let originalIdentityRestored = false;
      let sourcePropertiesPreserved = false;
      let resourcesDisposed = false;
      const releaseOwnedResources = () => {
        if (resourcesDisposed) return;
        resourcesDisposed = true;
        copies.forEach((copy) => copy.dispose());
        target.dispose();
        Object.assign(operation.resourceCleanup, {
          temporaryTargetDisposeCount: targetDisposeCount,
          temporaryMaterialDisposeCount: cloneDisposeCount,
          originalRenderableMaterialAndGeometryRestored: originalIdentityRestored,
          sourcePropertiesPreserved,
          noBorrowedResourceDisposed: true,
        });
      };

      try {
        assertCaptureActive(operation);
        if (previousTarget !== null) throw new Error("single-renderable replay requires the mounted screen target");
        if (width < 2 || height < 2) throw new Error("mounted drawing buffer is too small for a useful proxy");
        renderables.forEach((object) => { assertCaptureActive(operation); object.visible = object === selected; });
        assertCaptureActive(operation);
        if (Array.isArray(originalMaterial)) selected.material = copies;
        else selected.material = copies[0]!;
        assertCaptureActive(operation);
        scene.background = null;
        sceneWithBackground.backgroundNode = null;
        target.texture.colorSpace = targetColorSpace;

        assertCaptureActive(operation);
        renderer.setRenderTarget(target);
        assertCaptureActive(operation);
        renderer.setScissorTest(false);
        assertCaptureActive(operation);
        renderer.setClearColor(0x000000, 0);
        assertCaptureActive(operation);
        renderer.clear(true, true, true);
        assertCaptureActive(operation);
        const renderResult = renderer.render(scene, camera);
        if (renderResult && typeof (renderResult as PromiseLike<unknown>).then === "function") {
          throw new Error("r186 returned an asynchronous render result; replay stopped before yielding with temporary scene state");
        }
        assertCaptureActive(operation);
        readback = readRenderTargetFloatPixels(
          renderer,
          runtime,
          target,
          (pending) => awaitCaptureReadback(operation, pending),
        );
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        selected.material = originalMaterial;
        visibilityBefore.forEach((visible, object) => { object.visible = visible; });
        scene.background = originalBackground;
        sceneWithBackground.backgroundNode = originalBackgroundNode;
        if (rendererContextAvailable() && captureIsActive(operation)) {
          try {
            renderer.setRenderTarget(previousTarget);
            renderer.setViewport(previousViewport);
            renderer.setScissor(previousScissor);
            renderer.setScissorTest(previousScissorTest);
            renderer.setClearColor(previousClearColor, previousClearAlpha);
          } catch (cause) {
            error ??= cause instanceof Error ? cause.message : String(cause);
          }
        }
        originalIdentityRestored = selected.material === originalMaterial && selected.geometry === sourceGeometry;
        sourcePropertiesPreserved = JSON.stringify(sources.map(sourceMaterialSnapshot)) === JSON.stringify(sourceSnapshotsBefore);
      }

      try {
        let pixels: Float32Array | null = null;
        try {
          pixels = readback instanceof Promise ? await readback : readback;
        } catch (cause) {
          if (!captureIsActive(operation)) throw cause;
          error = cause instanceof Error ? cause.message : String(cause);
        }
        assertCaptureActive(operation);
        if (!pixels && !error) error = "render-target readback did not produce pixels";
        const maskPixelIndices = request.maskPixelIndices ?? [];
        const samplePixelIndices = request.samplePixelIndices ?? [];
        if (pixels && maskPixelIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= width * height)) {
          error = "mask contains a pixel index outside the mounted drawing buffer";
        }
        if (pixels && samplePixelIndices.some((index) => !Number.isInteger(index) || index < 0 || index >= width * height)) {
          error = "sample list contains a pixel index outside the mounted drawing buffer";
        }
        const alphaValues = pixels && maskPixelIndices.length > 0
          ? maskPixelIndices.map((index) => pixels[index * 4 + 3] ?? 0)
          : [];
        const sourceOutputs = materials.map((material, index) => ({
          source: sourceMaterialSnapshot(sources[index]!),
          output: sourceMaterialSnapshot(material),
          sourceOutputIdentitySeparate: sources[index] !== material,
          temporaryReplayMaterial: sourceMaterialSnapshot(copies[index]!),
          temporaryBlending: copies[index]!.blending,
          outputMode: (material as THREE.Material & { outputTransform?: string }).outputTransform ?? "standard",
        }));
        releaseOwnedResources();
        const success = !error && pixels !== null;
        return {
          status: success ? "ok" : "unsupported",
          generation,
          feasibility: "F2",
          method: "single-renderable-replay",
          rendererRuntime: runtime,
          selectedRenderable: {
            id: selected.uuid,
            name: selected.name,
            role: classifyAnatomyMaterialRole(selected, scene).role,
            cameraPart: classifyAnatomyMaterialRole(selected, scene).cameraPart,
            geometryId: selected.geometry.uuid,
            worldMatrix: selected.matrixWorld.elements.slice(),
            renderOrder: selected.renderOrder,
            castShadow: selected.castShadow,
            receiveShadow: selected.receiveShadow,
            effectiveVisibleBeforeReplay: isEffectivelyVisible(selected, scene),
            outputMaterials: sourceOutputs,
          },
          replay: {
            hiddenOtherRenderableCount: renderables.length - 1,
            target: {
              format: "RGBAFormat",
              type: "FloatType",
              colorSpace: targetColorSpace,
              width,
              height,
              depthBuffer: true,
              samples: 0,
              blending: "disabled on owned material clones only",
            },
            outputRepresentation: materials[0]
              ? materialOutputRepresentation(runtime, materials[0])
              : "unavailable",
            alphaRepresentation: "straight shader alpha read from RGBA32F attachment; not browser canvas alpha",
            sampleCount: samplePixelIndices.length,
            samples: pixels ? samplesAtIndices(pixels, width, samplePixelIndices) : [],
            maskedCoverage: {
              sampleCount: alphaValues.length,
              nonzeroAlphaCount: alphaValues.filter((value) => value > 1e-6).length,
              meanAlpha: alphaValues.length > 0
                ? alphaValues.reduce((sum, value) => sum + value, 0) / alphaValues.length
                : null,
            },
            caveats: [
              "The selected renderable was replayed in isolation with other scene renderables hidden.",
              "The target had a cleared depth buffer; original inter-object occlusion and draw ordering are not preserved.",
              "The selected cloned material disabled blending to retain its shader RGBA output; output pixels are not an unchanged production draw.",
              selected.receiveShadow ? "Other shadow casters were hidden, so receive-shadow contribution is not preserved." : "The selected renderable does not receive shadows in the inventoried scene.",
            ],
          },
          integrity: {
            sourcePropertiesPreserved,
            sourceAndOutputIdentitiesRecorded: true,
            originalRenderableMaterialAndGeometryRestored: originalIdentityRestored,
            targetDisposeCount,
            temporaryMaterialDisposeCount: cloneDisposeCount,
            noTextureOrGeometryDisposed: true,
          },
          ...(error ? { reason: error } : {}),
        };
      } finally {
        releaseOwnedResources();
      }
    });

    const handleDirectDrawCapture = (request: AnatomyGpuCaptureRequest) => {
      const operation = beginCapture(request);
      if (!operation) return;
      const refuse = (reason: string, feasibility = "F0") => {
        completeCapture(operation, rejectionDetail(reason, feasibility), "rejected");
      };
      const runtime = resolveObserverRendererRuntime(gl);
      const feasibility = classifyAnatomyGpuCaptureFeasibility(runtime, "draw-boundary");
      if (feasibility.classification !== "F1") {
        refuse(feasibility.reason, feasibility.classification);
        return;
      }
      if (directCaptureCleanup) {
        refuse("capture-already-active");
        return;
      }
      const selection = resolveTarget(request);
      if ("error" in selection) {
        refuse(selection.error ?? "invalid-renderable-selection");
        return;
      }
      const { target: selected } = selection;
      if (request.maskPixelIndices && (request.maskPixelIndices.length === 0 || request.maskPixelIndices.length > 100_000)) {
        refuse("invalid-or-excessive-response-mask");
        return;
      }
      const renderer = gl as unknown as DisposableRenderer & {
        renderBufferDirect: (...args: unknown[]) => unknown;
      };
      const context = (gl as unknown as { getContext?: () => WebGL2RenderingContext }).getContext?.();
      if (!context || renderer.getRenderTarget() !== null) {
        refuse("direct-capture-requires-mounted-WebGL2-canvas-target");
        return;
      }
      const sourceMaterialId = request.sourceMaterialId;
      const originalRenderBufferDirect = renderer.renderBufferDirect;
      const drawApi = context as unknown as Record<string, (...args: unknown[]) => unknown>;
      const drawNames = ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const;
      const originalDrawMethods = new Map<string, (...args: unknown[]) => unknown>();
      const drawRecords: Array<Readonly<{
        captureOrder: number;
        call: string;
        state: DrawState;
        materialId: string;
        sourceMaterialId: string;
        material: ReturnType<typeof sourceMaterialSnapshot>;
        sourceMaterial: ReturnType<typeof sourceMaterialSnapshot>;
        response: ReturnType<typeof summarizeAnatomyGpuDrawResponse>;
        samples: readonly Readonly<{
          index: number;
          destination: readonly number[];
          postDraw: readonly number[];
        }>[];
      }>> = [];
      let currentObject: THREE.Object3D | null = null;
      let currentMaterial: THREE.Material | null = null;
      let settled = false;
      let timer = 0;
      const originalOnAfterRender = selected.onAfterRender;
      const maskPixelIndices = request.maskPixelIndices ?? [];
      const samplePixelIndices = request.samplePixelIndices ?? [];
      if (samplePixelIndices.length > 32 || samplePixelIndices.some((index) =>
        !Number.isInteger(index) || index < 0 || index >= context.drawingBufferWidth * context.drawingBufferHeight)) {
        refuse("invalid-or-excessive-fixed-sample-selection");
        return;
      }
      const cleanup = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        renderer.renderBufferDirect = originalRenderBufferDirect;
        originalDrawMethods.forEach((method, name) => { drawApi[name] = method; });
        selected.onAfterRender = originalOnAfterRender;
        directCaptureCleanup = null;
      };
      const finish = (status: "ok" | "unsupported", reason?: string) => {
        if (settled) return;
        const publishable = captureIsActive(operation);
        cleanup();
        if (!publishable) {
          if (activeCapture === operation) activeCapture = null;
          return;
        }
        const ordered = [...drawRecords].sort((left, right) =>
          right.response.thresholdPixelCount - left.response.thresholdPixelCount ||
          right.response.meanAbsoluteRgbDifference - left.response.meanAbsoluteRgbDifference,
        );
        const selectedDraw = ordered[0];
        const result = {
          status,
          generation,
          feasibility: "F1",
          method: "draw-boundary",
          rendererRuntime: runtime,
          selectedRenderable: {
            id: selected.uuid,
            name: selected.name,
            role: classifyAnatomyMaterialRole(selected, scene).role,
            cameraPart: classifyAnatomyMaterialRole(selected, scene).cameraPart,
            geometryId: selected.geometry.uuid,
            worldMatrix: selected.matrixWorld.elements.slice(),
            renderOrder: selected.renderOrder,
            castShadow: selected.castShadow,
            receiveShadow: selected.receiveShadow,
            materialId: selectedDraw?.materialId ?? null,
            sourceMaterialId: selectedDraw?.sourceMaterialId ?? sourceMaterialId ?? null,
            material: selectedDraw?.material ?? null,
          },
          attachment: {
            width: context.drawingBufferWidth,
            height: context.drawingBufferHeight,
            format: "default WebGL canvas drawing buffer",
            representation: "RGBA8 readPixels values; RGB is the shader's configured display output before browser canvas composition; alpha is raw attachment alpha",
            contextAttributes: context.getContextAttributes(),
            drawingBufferColorSpace: (context as WebGL2RenderingContext & { drawingBufferColorSpace?: string }).drawingBufferColorSpace ?? null,
            framebufferColorEncoding: selectedDraw?.state.framebufferColorEncoding ?? null,
            premultiplication: {
              materialPremultipliedAlpha: selectedDraw?.material.premultipliedAlpha ?? null,
              canvasContextPremultipliedAlpha: context.getContextAttributes()?.premultipliedAlpha ?? null,
              browserCompositionIncluded: false,
            },
          },
          drawObservations: ordered.map((record) => ({
            captureOrder: record.captureOrder,
            call: record.call,
            state: record.state,
            materialId: record.materialId,
            sourceMaterialId: record.sourceMaterialId,
            material: record.material,
            sourceMaterial: record.sourceMaterial,
            destinationAndPostDrawSamples: record.samples.map((sample) => ({
              ...sample,
              x: sample.index % context.drawingBufferWidth,
              y: Math.floor(sample.index / context.drawingBufferWidth),
            })),
            response: record.response,
          })),
          maskSelection: {
            source: "PR #263 Front Standard B0 dimmed-response mask, selected before output-mode comparisons",
            maskSampleCount: maskPixelIndices.length,
            thresholdPerChannel: 8,
            samplePixelIndices,
            selectedDrawCall: selectedDraw?.call ?? null,
          },
          sourceFragment: {
            rgb: null,
            alpha: null,
            classification: "F3",
            reason: "The unmodified fragment shader output is not exposed by WebGL readPixels; these are direct before/after attachment samples and a per-material RGB/alpha proxy is captured separately.",
          },
          ...(reason ? { reason } : {}),
        };
        if (publishable) completeCapture(operation, result, status);
        else if (activeCapture === operation) activeCapture = null;
      };

      try {
        for (const name of drawNames) {
          const method = drawApi[name];
          if (typeof method !== "function") continue;
          originalDrawMethods.set(name, method);
          drawApi[name] = (...args: unknown[]) => {
            if (!captureIsActive(operation)) {
              cleanup();
              return method.apply(context, args);
            }
            if (currentObject !== selected || !currentMaterial ||
                (sourceMaterialId && sourceMaterialFor(currentMaterial).uuid !== sourceMaterialId)) {
              return method.apply(context, args);
            }
            let before: Uint8Array;
            let state: DrawState;
            try {
              before = readDefaultFramebuffer(context);
              state = readWebGlDrawState(context);
            } catch (cause) {
              finish("unsupported", cause instanceof Error ? cause.message : String(cause));
              return method.apply(context, args);
            }
            const result = method.apply(context, args);
            try {
              const after = readDefaultFramebuffer(context);
              const sampleValues = samplePixelIndices.map((index) => {
                const offset = index * 4;
                return {
                  index,
                  destination: [...before.subarray(offset, offset + 4)],
                  postDraw: [...after.subarray(offset, offset + 4)],
                };
              });
              drawRecords.push({
                captureOrder: drawRecords.length,
                call: name,
                state,
                materialId: currentMaterial.uuid,
                sourceMaterialId: sourceMaterialFor(currentMaterial).uuid,
                material: sourceMaterialSnapshot(currentMaterial),
                sourceMaterial: sourceMaterialSnapshot(sourceMaterialFor(currentMaterial)),
                response: summarizeAnatomyGpuDrawResponse(
                  before,
                  after,
                  maskPixelIndices,
                ),
                samples: sampleValues,
              });
              if (drawRecords.length >= 16) finish("unsupported", "selected renderable exceeded the 16-draw capture bound");
            } catch (cause) {
              finish("unsupported", cause instanceof Error ? cause.message : String(cause));
            }
            return result;
          };
          if (drawApi[name] === method) throw new Error(`Could not install the ${name} draw wrapper`);
        }
        if (originalDrawMethods.size === 0) throw new Error("No supported WebGL2 draw entrypoints were found");
        renderer.renderBufferDirect = (...args: unknown[]) => {
          if (!captureIsActive(operation)) {
            cleanup();
            return originalRenderBufferDirect.apply(renderer, args);
          }
          const material = args[3] as THREE.Material | undefined;
          const object = args[4] as THREE.Object3D | undefined;
          const previousObject = currentObject;
          const previousMaterial = currentMaterial;
          if (object === selected && material &&
              (!sourceMaterialId || sourceMaterialFor(material).uuid === sourceMaterialId)) {
            currentObject = object;
            currentMaterial = material;
          }
          try {
            return originalRenderBufferDirect.apply(renderer, args);
          } finally {
            currentObject = previousObject;
            currentMaterial = previousMaterial;
          }
        };
        selected.onAfterRender = function (renderedWith, renderedScene, renderedCamera, geometry, material, group) {
          originalOnAfterRender.call(this, renderedWith, renderedScene, renderedCamera, geometry, material, group);
          if (!captureIsActive(operation)) {
            cleanup();
            return;
          }
          if (drawRecords.length > 0) finish("ok");
        };
        directCaptureCleanup = cleanup;
        timer = window.setTimeout(() => finish(
          drawRecords.length > 0 ? "ok" : "unsupported",
          drawRecords.length > 0 ? undefined : "selected renderable did not issue a WebGL draw before timeout",
        ), 5_000);
      } catch (cause) {
        cleanup();
        completeCapture(operation, rejectionDetail(cause instanceof Error ? cause.message : String(cause)), "failed");
      }
    };

    const registerNativeCaptureCleanup = (cleanup: () => void): (() => void) => {
      const registeredCleanup = () => {
        nativeCaptureCleanups.delete(registeredCleanup);
        cleanup();
      };
      nativeCaptureCleanups.add(registeredCleanup);
      return () => nativeCaptureCleanups.delete(registeredCleanup);
    };

    const handleNativeDrawBoundaryCapture = (request: AnatomyGpuCaptureRequest) => runCapture(
      request,
      async (operation) => {
        assertCaptureActive(operation);
        const runtime = resolveObserverRendererRuntime(gl);
        const selection = resolveTarget(request);
        if ("error" in selection) return rejectionDetail(selection.error ?? "invalid-renderable-selection");
        assertCaptureActive(operation);
        const result = await runAnatomyNativeWebGpuDrawBoundaryCapture({
          renderer: gl as unknown as Parameters<typeof runAnatomyNativeWebGpuDrawBoundaryCapture>[0]["renderer"],
          runtime,
          threeRevision: THREE.REVISION,
          generation,
          selected: selection.target,
          ...(request.sourceMaterialId ? { sourceMaterialId: request.sourceMaterialId } : {}),
          ...(request.boundarySelection ? { boundarySelection: request.boundarySelection } : {}),
          samplePixelIndices: request.samplePixelIndices ?? [],
          ...(request.baselineCanvas ? { baselineCanvas: request.baselineCanvas } : {}),
          ...(request.includeRawFramebuffer === true ? { includeRawFramebuffer: true } : {}),
          resolveSourceMaterial: sourceMaterialFor,
          isCaptureActive: () => captureIsActive(operation),
          awaitReadbacks: (readbacks) => awaitCaptureReadbacks(operation, readbacks),
          registerCleanup: registerNativeCaptureCleanup,
          onResourcesReleased: (lifecycle) => Object.assign(operation.resourceCleanup, lifecycle),
        });
        assertCaptureActive(operation);
        return result;
      },
    );

    const handleNativeFinalFrameCapture = (request: AnatomyGpuCaptureRequest) => runCapture(
      request,
      async (operation) => {
        assertCaptureActive(operation);
        const runtime = resolveObserverRendererRuntime(gl);
        const result = await runAnatomyNativeWebGpuFinalFrameCapture({
          renderer: gl as unknown as Parameters<typeof runAnatomyNativeWebGpuFinalFrameCapture>[0]["renderer"],
          runtime,
          threeRevision: THREE.REVISION,
          generation,
          samplePixelIndices: request.samplePixelIndices ?? [],
          includeRawFramebuffer: request.includeRawFramebuffer === true,
          isCaptureActive: () => captureIsActive(operation),
          awaitReadbacks: (readbacks) => awaitCaptureReadbacks(operation, readbacks),
          registerCleanup: registerNativeCaptureCleanup,
          onResourcesReleased: (lifecycle) => Object.assign(operation.resourceCleanup, lifecycle),
        });
        assertCaptureActive(operation);
        return result;
      },
    );

    const handleBellowsDrawMetadataCapture = (request: AnatomyGpuCaptureRequest) => runCapture(
      request,
      async (operation) => {
        assertCaptureActive(operation);
        const runtime = resolveObserverRendererRuntime(gl);
        const selection = resolveTarget(request);
        if ("error" in selection) return rejectionDetail(selection.error ?? "invalid-renderable-selection");
        const { target } = selection;
        const role = classifyAnatomyMaterialRole(target, scene);
        if (target.name !== "bellows-folded-surface" || role.role !== "conceptual-camera/bellows" ||
            role.cameraPart !== "bellows" || !request.sourceMaterialId) {
          return rejectionDetail("selected-renderable-is-not-mounted-bellows");
        }
        return runAnatomyBellowsDrawMetadataCapture({
          renderer: gl as unknown as Parameters<typeof runAnatomyBellowsDrawMetadataCapture>[0]["renderer"],
          runtime,
          generation,
          generationIdentity: mountIdentity,
          selected: target,
          sourceMaterialId: request.sourceMaterialId,
          isCaptureActive: () => captureIsActive(operation),
          registerCleanup: registerNativeCaptureCleanup,
        });
      },
    );

    const handleCapture = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as AnatomyGpuCaptureRequest | null;
      if (!request || typeof request.requestId !== "string" || request.requestId.length === 0) return;
      if (request.method === "calibration") {
        void handleCalibration(request).catch((error: unknown) => {
          reject(request.requestId, error instanceof Error ? error.message : String(error));
        });
      } else if (request.method === "draw-boundary") {
        try {
          handleDirectDrawCapture(request);
        } catch (error) {
          const operation = activeCapture;
          if (operation?.requestId === request.requestId) {
            completeCapture(
              operation,
              rejectionDetail(error instanceof Error ? error.message : String(error)),
              "failed",
            );
          }
        }
      } else if (request.method === "native-draw-boundary") {
        void handleNativeDrawBoundaryCapture(request).catch((error: unknown) => {
          reject(request.requestId, error instanceof Error ? error.message : String(error));
        });
      } else if (request.method === "native-final-frame") {
        void handleNativeFinalFrameCapture(request).catch((error: unknown) => {
          reject(request.requestId, error instanceof Error ? error.message : String(error));
        });
      } else if (request.method === "bellows-draw-metadata") {
        void handleBellowsDrawMetadataCapture(request).catch((error: unknown) => {
          reject(request.requestId, error instanceof Error ? error.message : String(error));
        });
      } else if (request.method === "single-renderable-replay") {
        void handleProxy(request).catch((error: unknown) => {
          reject(request.requestId, error instanceof Error ? error.message : String(error));
        });
      } else {
        reject(request.requestId, "invalid-capture-method");
      }
    };

    container.addEventListener(ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT, handleCapture);
    container.setAttribute("data-observer-anatomy-gpu-blend-probe", "ready");
    return () => {
      invalidateLifetime("probe-unmounted");
      gl.domElement.removeEventListener("webglcontextlost", handleWebGlContextLost);
      container.removeEventListener(ANATOMY_GPU_BLEND_INTERMEDIATE_CAPTURE_EVENT, handleCapture);
      if (anatomyGpuCaptureProbeOwners.get(container) === mountIdentity) {
        anatomyGpuCaptureProbeOwners.delete(container);
        container.removeAttribute("data-observer-anatomy-gpu-blend-probe");
      }
    };
  }, [camera, generation, gl, scene]);

  return null;
};
