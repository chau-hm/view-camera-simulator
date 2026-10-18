import * as THREE from "three";
import type { AnatomyGpuCaptureRuntime } from "./anatomyGpuBlendIntermediate";
import { readObserverOutputSourceMaterial } from "./observerMaterialOutputIdentity";
import {
  qualifyMInv8NativePipelineEvidence,
  readMInv8NativePipelineObserver,
  type MInv8NativePipelineBlendQualification,
  type MInv8NativePipelineLookup,
} from "./anatomyBellowsNativePipelineEvidence";

type SelectedRenderable = THREE.Object3D & {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
};

type NativeRenderObject = Readonly<{
  object?: THREE.Object3D;
  material?: THREE.Material;
  context?: object | null;
  pipeline?: object;
  passId?: string | null;
  getDrawParameters?: () => unknown;
  getIndex?: () => unknown;
}>;

type NativeBackend = {
  draw: (renderObject: NativeRenderObject, info: unknown) => unknown;
  finishRender: (context: object) => unknown;
  device?: object;
  data?: WeakMap<object, Readonly<{ pipeline?: object; error?: boolean }>>;
  utils?: Readonly<{
    getCurrentColorFormats?: (context: object) => readonly string[];
    getCurrentDepthStencilFormat?: (context: object) => string | null | undefined;
    getSampleCountRenderContext?: (context: object) => number;
  }>;
};

type CaptureRenderer = {
  render?: (scene: THREE.Scene, camera: THREE.Camera) => unknown;
  renderBufferDirect?: (...args: unknown[]) => unknown;
  getContext?: () => unknown;
  backend?: NativeBackend;
};

export type AnatomyBellowsDrawMetadataCaptureOptions = Readonly<{
  renderer: CaptureRenderer;
  runtime: AnatomyGpuCaptureRuntime;
  generation: number;
  generationIdentity: object;
  selected: SelectedRenderable;
  sourceMaterialId: string;
  isCaptureActive: () => boolean;
  registerCleanup: (cleanup: () => void) => () => void;
}>;

type MaterialMetadata = Readonly<Record<string, unknown>>;

const materialMetadata = (material: THREE.Material): MaterialMetadata => {
  const candidate = material as THREE.Material & {
    outputTransform?: string;
    outputInterventionId?: string;
    forceSinglePass?: boolean;
    alphaWrite?: boolean;
    color?: THREE.Color;
    roughness?: number;
    metalness?: number;
  };
  const source = readObserverOutputSourceMaterial(material) ?? material;
  return {
    id: material.uuid,
    sourceMaterialId: source.uuid,
    type: material.type,
    color: candidate.color?.getHexString() ?? null,
    opacity: material.opacity,
    transparent: material.transparent,
    blending: material.blending,
    premultipliedAlpha: material.premultipliedAlpha,
    alphaWrite: candidate.alphaWrite ?? null,
    side: material.side,
    forceSinglePass: candidate.forceSinglePass ?? null,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    depthFunction: material.depthFunc,
    toneMapped: material.toneMapped,
    roughness: candidate.roughness ?? null,
    metalness: candidate.metalness ?? null,
    outputTransform: candidate.outputTransform ?? null,
    outputInterventionId: candidate.outputInterventionId ?? null,
  };
};

const glEnumName = (gl: WebGL2RenderingContext, value: number): string => {
  const names = [
    "ZERO", "ONE", "SRC_COLOR", "ONE_MINUS_SRC_COLOR", "DST_COLOR", "ONE_MINUS_DST_COLOR",
    "SRC_ALPHA", "ONE_MINUS_SRC_ALPHA", "DST_ALPHA", "ONE_MINUS_DST_ALPHA", "CONSTANT_COLOR",
    "ONE_MINUS_CONSTANT_COLOR", "CONSTANT_ALPHA", "ONE_MINUS_CONSTANT_ALPHA", "SRC_ALPHA_SATURATE",
    "FUNC_ADD", "FUNC_SUBTRACT", "FUNC_REVERSE_SUBTRACT", "MIN", "MAX", "NEVER", "LESS",
    "EQUAL", "LEQUAL", "GREATER", "NOTEQUAL", "GEQUAL", "ALWAYS",
  ] as const;
  return names.find((name) => (gl as unknown as Record<string, unknown>)[name] === value) ?? `enum:${value}`;
};

const webGlState = (gl: WebGL2RenderingContext) => ({
  blendEnabled: gl.isEnabled(gl.BLEND),
  blendSourceRgb: glEnumName(gl, gl.getParameter(gl.BLEND_SRC_RGB) as number),
  blendDestinationRgb: glEnumName(gl, gl.getParameter(gl.BLEND_DST_RGB) as number),
  blendEquationRgb: glEnumName(gl, gl.getParameter(gl.BLEND_EQUATION_RGB) as number),
  blendSourceAlpha: glEnumName(gl, gl.getParameter(gl.BLEND_SRC_ALPHA) as number),
  blendDestinationAlpha: glEnumName(gl, gl.getParameter(gl.BLEND_DST_ALPHA) as number),
  blendEquationAlpha: glEnumName(gl, gl.getParameter(gl.BLEND_EQUATION_ALPHA) as number),
  depthTest: gl.isEnabled(gl.DEPTH_TEST),
  depthWrite: gl.getParameter(gl.DEPTH_WRITEMASK) as boolean,
  depthFunction: glEnumName(gl, gl.getParameter(gl.DEPTH_FUNC) as number),
  stencilTest: gl.isEnabled(gl.STENCIL_TEST),
});

const plainDrawParameters = (value: unknown): Readonly<Record<string, unknown>> | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const names = ["vertexCount", "firstVertex", "instanceCount", "firstInstance", "indexCount", "firstIndex", "baseVertex"];
  return Object.fromEntries(names.filter((name) => name in record).map((name) => [name, record[name]]));
};

const unsupportedNativePipeline = (reason: string): MInv8NativePipelineBlendQualification => ({ status: "unsupported", reason });

/** Records real Bellows draw metadata without copies, readbacks, or extra render calls. */
export const runAnatomyBellowsDrawMetadataCapture = (
  options: AnatomyBellowsDrawMetadataCaptureOptions,
): Promise<Readonly<Record<string, unknown>>> => new Promise((resolve) => {
  const { renderer, runtime, selected } = options;
  const records: Array<Readonly<Record<string, unknown>>> = [];
  let settled = false;
  let timer = 0;
  let unregisterCleanup: (() => void) | null = null;
  let restore: () => void = () => {};

  const finish = (status: "ok" | "unsupported" | "failed", reason?: string) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    let cleanupFailure: string | null = null;
    try {
      restore();
    } catch (cause) {
      cleanupFailure = cause instanceof Error ? cause.message : String(cause);
    }
    try {
      unregisterCleanup?.();
    } catch (cause) {
      cleanupFailure ??= cause instanceof Error ? cause.message : String(cause);
    }
    const active = options.isCaptureActive();
    const nativeEvidenceQualified = runtime.rendererFamily !== "webgpu-renderer" ||
      (records.length > 0 && records.every((record) => {
        const qualification = record.nativePipelineBlendQualification as MInv8NativePipelineBlendQualification | undefined;
        const execution = record.nativeDrawExecution as Readonly<{ completed?: boolean }> | undefined;
        return qualification?.status === "qualified" && execution?.completed === true;
      }));
    resolve({
      status: active ? (cleanupFailure ? "unsupported" : status) : "cancelled",
      feasibility: status === "ok" && active && cleanupFailure === null && nativeEvidenceQualified ? "F1" : "F0",
      method: "bellows-draw-metadata",
      generation: options.generation,
      rendererRuntime: runtime,
      selectedRenderable: {
        id: selected.uuid,
        name: selected.name,
        geometryId: selected.geometry.uuid,
        sourceMaterialId: options.sourceMaterialId,
      },
      drawObservations: records,
      drawCount: records.length,
      readbackStarted: false,
      framebufferCopyStarted: false,
      ...(cleanupFailure ? { reason: `hook-cleanup-failed:${cleanupFailure}` } : reason ? { reason } : {}),
    });
  };

  const selectedSourceMatches = (material: THREE.Material | undefined): material is THREE.Material =>
    material !== undefined && (readObserverOutputSourceMaterial(material) ?? material).uuid === options.sourceMaterialId;

  const failAndRethrow = (cause: unknown): never => {
    finish("failed", cause instanceof Error ? cause.message : String(cause));
    throw cause;
  };

  try {
    if (!options.isCaptureActive()) {
      finish("unsupported", "capture-generation-retired-before-install");
      return;
    }
    if (runtime.rendererFamily === "webgl-renderer" && runtime.executionBackend === "webgl2") {
      const gl = renderer.getContext?.() as WebGL2RenderingContext | undefined;
      if (!gl || typeof renderer.render !== "function" || typeof renderer.renderBufferDirect !== "function") {
        finish("unsupported", "webgl-metadata-hook-api-unavailable");
        return;
      }
      const methods = ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"] as const;
      const originals = new Map<string, (...args: unknown[]) => unknown>();
      const wrappers = new Map<string, (...args: unknown[]) => unknown>();
      const hadOwnGlMethod = new Map<string, boolean>();
      const hadOwnRender = Object.prototype.hasOwnProperty.call(renderer, "render");
      const originalRender = renderer.render;
      const hadOwnRenderBufferDirect = Object.prototype.hasOwnProperty.call(renderer, "renderBufferDirect");
      const originalRenderBufferDirect = renderer.renderBufferDirect;
      let activeObject: THREE.Object3D | null = null;
      let activeMaterial: THREE.Material | null = null;
      const wrappedRender = function (this: CaptureRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        try {
          return originalRender!.call(this, scene, camera);
        } catch (cause) {
          return failAndRethrow(cause);
        } finally {
          if (records.length > 0) finish("ok");
        }
      };
      const wrappedRenderBufferDirect = (...args: unknown[]) => {
        if (!options.isCaptureActive()) return originalRenderBufferDirect!.apply(renderer, args);
        const material = args[3] as THREE.Material | undefined;
        const object = args[4] as THREE.Object3D | undefined;
        const previousObject = activeObject;
        const previousMaterial = activeMaterial;
        if (object === selected && selectedSourceMatches(material)) {
          activeObject = object;
          activeMaterial = material;
        }
        try {
          return originalRenderBufferDirect!.apply(renderer, args);
        } catch (cause) {
          return failAndRethrow(cause);
        } finally {
          activeObject = previousObject;
          activeMaterial = previousMaterial;
        }
      };
      try {
        renderer.render = wrappedRender as CaptureRenderer["render"];
        renderer.renderBufferDirect = wrappedRenderBufferDirect;
        methods.forEach((name) => {
          const method = (gl as unknown as Record<string, unknown>)[name];
          if (typeof method !== "function") return;
          const original = method as (...args: unknown[]) => unknown;
          originals.set(name, original);
          hadOwnGlMethod.set(name, Object.prototype.hasOwnProperty.call(gl, name));
          const wrapper = (...args: unknown[]) => {
            if (activeObject === selected && activeMaterial && options.isCaptureActive()) {
              try {
                records.push({
                  order: records.length,
                  command: name,
                  commandArguments: args.map((value) => typeof value === "number" ? value : null),
                  objectId: activeObject.uuid,
                  renderOrder: activeObject.renderOrder,
                  material: materialMetadata(activeMaterial),
                  state: webGlState(gl),
                });
              } catch (cause) {
                finish("unsupported", `webgl-draw-state-unavailable:${cause instanceof Error ? cause.message : String(cause)}`);
              }
            }
            try {
              return original.apply(gl, args);
            } catch (cause) {
              return failAndRethrow(cause);
            }
          };
          wrappers.set(name, wrapper);
          (gl as unknown as Record<string, unknown>)[name] = wrapper;
        });
        if (originals.size === 0) throw new Error("webgl-metadata-draw-entrypoints-unavailable");
      } catch (cause) {
        methods.forEach((name) => {
          const original = originals.get(name);
          const wrapper = wrappers.get(name);
          if (!original || (gl as unknown as Record<string, unknown>)[name] !== wrapper) return;
          if (hadOwnGlMethod.get(name)) (gl as unknown as Record<string, unknown>)[name] = original;
          else delete (gl as unknown as Record<string, unknown>)[name];
        });
        if (hadOwnRender) renderer.render = originalRender;
        else delete renderer.render;
        if (hadOwnRenderBufferDirect) renderer.renderBufferDirect = originalRenderBufferDirect;
        else delete renderer.renderBufferDirect;
        finish("unsupported", cause instanceof Error ? cause.message : String(cause));
        return;
      }
      restore = () => {
        methods.forEach((name) => {
          const original = originals.get(name);
          const wrapper = wrappers.get(name);
          if (!original || (gl as unknown as Record<string, unknown>)[name] !== wrapper) return;
          if (hadOwnGlMethod.get(name)) (gl as unknown as Record<string, unknown>)[name] = original;
          else delete (gl as unknown as Record<string, unknown>)[name];
        });
        if (renderer.render === wrappedRender) {
          if (hadOwnRender) renderer.render = originalRender;
          else delete renderer.render;
        }
        if (renderer.renderBufferDirect === wrappedRenderBufferDirect) {
          if (hadOwnRenderBufferDirect) renderer.renderBufferDirect = originalRenderBufferDirect;
          else delete renderer.renderBufferDirect;
        }
      };
    } else if (runtime.rendererFamily === "webgpu-renderer" && runtime.executionBackend === "webgpu") {
      const backend = renderer.backend;
      if (!backend || typeof backend.draw !== "function" || typeof backend.finishRender !== "function") {
        finish("unsupported", "native-metadata-hook-api-unavailable");
        return;
      }
      const hadOwnDraw = Object.prototype.hasOwnProperty.call(backend, "draw");
      const hadOwnFinish = Object.prototype.hasOwnProperty.call(backend, "finishRender");
      const originalDraw = backend.draw;
      const originalFinish = backend.finishRender;
      let selectedContext: object | null = null;
      const collectPipelineEvidence = (renderObject: NativeRenderObject, material: THREE.Material) => {
        try {
          const context = renderObject.context;
          const pipelineKey = renderObject.pipeline;
          const pipelineData = pipelineKey ? backend.data?.get(pipelineKey) : undefined;
          const pipeline = pipelineData?.pipeline;
          const device = backend.device;
          const utils = backend.utils;
          const colorTargetFormats = context ? utils?.getCurrentColorFormats?.(context) ?? null : null;
          const sampleCount = context ? utils?.getSampleCountRenderContext?.(context) ?? null : null;
          const contextRecord = context as (Record<string, unknown> | null | undefined);
          const hasDepthOrStencil = contextRecord?.depth === true || contextRecord?.stencil === true;
          const rawDepthStencilFormat = context ? utils?.getCurrentDepthStencilFormat?.(context) : undefined;
          const depthStencilFormat = typeof rawDepthStencilFormat === "string" ? rawDepthStencilFormat : null;
          let lookup: MInv8NativePipelineLookup | null = null;
          const observer = readMInv8NativePipelineObserver();
          if (observer && device && pipeline) {
            lookup = observer.read(device, pipeline, options.generation, options.generationIdentity);
          }
          const qualification = qualifyMInv8NativePipelineEvidence({
            lookup: lookup ?? { status: "unsupported", reason: "native-pipeline-observer-unavailable" },
            generation: options.generation,
            threeRevision: THREE.REVISION,
            pipelineAvailable: Boolean(pipeline),
            pipelineHasError: pipelineData?.error === true,
            selectedDrawAssociationVerified: Boolean(pipelineKey && pipeline && pipelineData?.pipeline === pipeline),
            colorTargetFormats,
            depthStencilFormat: hasDepthOrStencil ? depthStencilFormat : null,
            expectedSampleCount: sampleCount,
          });
          if (hasDepthOrStencil && typeof rawDepthStencilFormat !== "string") {
            return { qualification: unsupportedNativePipeline("render-context-depth-stencil-format-unavailable"), pipelineIdentity: null };
          }
          const inferredMaterialBlendEnabled = material.blending !== THREE.NoBlending &&
            !(material.blending === THREE.NormalBlending && material.transparent === false);
          return {
            qualification,
            pipelineIdentity: qualification.pipelineIdentity ?? null,
            inferredMaterialBlendEnabled,
            colorTargetFormats,
            depthStencilFormat,
            sampleCount,
          };
        } catch (cause) {
          return {
            qualification: unsupportedNativePipeline(`native-pipeline-observation-failed:${cause instanceof Error ? cause.message : String(cause)}`),
            pipelineIdentity: null,
            inferredMaterialBlendEnabled: null,
            colorTargetFormats: null,
            depthStencilFormat: null,
            sampleCount: null,
          };
        }
      };
      const wrappedDraw = function (this: NativeBackend, renderObject: NativeRenderObject, info: unknown) {
        const isSelected = renderObject.object === selected && selectedSourceMatches(renderObject.material);
        let observation: Readonly<Record<string, unknown>> | null = null;
        let drawCallsBefore: number | null = null;
        if (isSelected && options.isCaptureActive()) {
          selectedContext = renderObject.context ?? null;
          const renderCalls = (info as { render?: { drawCalls?: unknown } } | null)?.render?.drawCalls;
          drawCallsBefore = typeof renderCalls === "number" ? renderCalls : null;
          try {
            const material = renderObject.material!;
            const source = readObserverOutputSourceMaterial(material) ?? material;
            const native = collectPipelineEvidence(renderObject, material);
            observation = {
              order: records.length,
              command: renderObject.getIndex?.() ? "drawIndexed" : "draw",
              objectId: renderObject.object?.uuid ?? null,
              renderOrder: renderObject.object?.renderOrder ?? null,
              material: materialMetadata(material),
              effectiveMaterialState: {
                blending: material.blending,
                transparent: material.transparent,
                forceSinglePass: (material as THREE.Material & { forceSinglePass?: boolean }).forceSinglePass ?? null,
              },
              sourceMaterialId: source.uuid,
              pipelineId: native.pipelineIdentity,
              passId: renderObject.passId ?? null,
              drawParameters: plainDrawParameters(renderObject.getDrawParameters?.()),
              gpuBlendEnabled: native.qualification.status === "qualified" ? native.qualification.blendEnabled ?? null : null,
              gpuBlendDescriptor: native.qualification.status === "qualified" ? native.qualification.blendDescriptor ?? null : null,
              gpuDepthCompare: native.qualification.status === "qualified" ? native.qualification.depthStencil?.depthCompare ?? null : null,
              inferredMaterialBlendEnabled: native.inferredMaterialBlendEnabled,
              inferredMaterialBlendEvidence: "material-flags-inference-F3",
              nativePipelineBlendQualification: native.qualification,
              nativePipelineRenderContext: {
                colorTargetFormats: native.colorTargetFormats,
                depthStencilFormat: native.depthStencilFormat,
                sampleCount: native.sampleCount,
              },
              info: info && typeof info === "object" ? Object.fromEntries(
                Object.entries(info as Record<string, unknown>).filter(([, value]) =>
                  typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
              ) : null,
            };
          } catch (cause) {
            observation = {
              order: records.length,
              command: "draw",
              objectId: selected.uuid,
              sourceMaterialId: options.sourceMaterialId,
              gpuBlendEnabled: null,
              gpuBlendDescriptor: null,
              nativePipelineBlendQualification: unsupportedNativePipeline(
                `native-pipeline-observation-failed:${cause instanceof Error ? cause.message : String(cause)}`,
              ),
            };
          }
        }
        let result: unknown;
        try {
          result = originalDraw.call(this, renderObject, info);
        } catch (cause) {
          return failAndRethrow(cause);
        }
        if (observation) {
          try {
            const renderCallsAfter = (info as { render?: { drawCalls?: unknown } } | null)?.render?.drawCalls;
            const drawCallsAfter = typeof renderCallsAfter === "number" ? renderCallsAfter : null;
            records.push({
              ...observation,
              order: records.length,
              nativeDrawExecution: {
                backendDrawReturned: true,
                drawCallsBefore: drawCallsBefore,
                drawCallsAfter,
                completed: drawCallsBefore !== null && drawCallsAfter !== null && drawCallsAfter > drawCallsBefore,
              },
            });
          } catch {
            records.push({
              ...observation,
              order: records.length,
              nativeDrawExecution: { backendDrawReturned: true, completed: false, reason: "r186-draw-completion-counter-unavailable" },
            });
          }
        }
        return result;
      };
      const wrappedFinish = function (this: NativeBackend, context: object) {
        try {
          return originalFinish.call(this, context);
        } catch (cause) {
          return failAndRethrow(cause);
        } finally {
          if (records.length > 0 && (selectedContext === null || selectedContext === context)) finish("ok");
        }
      };
      backend.draw = wrappedDraw as NativeBackend["draw"];
      backend.finishRender = wrappedFinish as NativeBackend["finishRender"];
      restore = () => {
        if (backend.draw === wrappedDraw) {
          if (hadOwnDraw) backend.draw = originalDraw;
          else delete (backend as unknown as Record<string, unknown>).draw;
        }
        if (backend.finishRender === wrappedFinish) {
          if (hadOwnFinish) backend.finishRender = originalFinish;
          else delete (backend as unknown as Record<string, unknown>).finishRender;
        }
      };
    } else {
      finish("unsupported", `unqualified-renderer:${runtime.rendererFamily}/${runtime.executionBackend}`);
      return;
    }

    unregisterCleanup = options.registerCleanup(() => finish("unsupported", "renderer-generation-retired"));
    timer = window.setTimeout(() => finish(
      records.length > 0 ? "unsupported" : "unsupported",
      records.length > 0 ? "selected-draw-frame-did-not-reach-a-qualified-boundary" : "selected-renderable-did-not-draw-before-timeout",
    ), 5_000);
  } catch (cause) {
    finish("unsupported", cause instanceof Error ? cause.message : String(cause));
  }
});
