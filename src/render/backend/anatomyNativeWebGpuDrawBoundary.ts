import type { AnatomyGpuCaptureRuntime } from "./anatomyGpuBlendIntermediate";

export type AnatomyNativeDrawBoundaryFeasibility = Readonly<{
  classification: "F1" | "F0";
  reason: string;
}>;

/**
 * Three r186's public copyFramebufferToTexture path can split a normal screen
 * render pass and resume it with Load. Pixel qualification still requires the
 * runtime pass guards and instrumented-versus-baseline parity check.
 */
export const classifyAnatomyNativeDrawBoundary = (
  runtime: AnatomyGpuCaptureRuntime,
  threeRevision: string,
): AnatomyNativeDrawBoundaryFeasibility => {
  if (runtime.rendererFamily !== "webgpu-renderer" || runtime.executionBackend !== "webgpu") {
    return {
      classification: "F0",
      reason: `Native pass segmentation requires webgpu-renderer/webgpu, received ${runtime.rendererFamily}/${runtime.executionBackend}.`,
    };
  }
  if (threeRevision !== "186") {
    return {
      classification: "F0",
      reason: `The pass adapter is guarded for Three.js r186; received revision ${threeRevision}.`,
    };
  }
  return {
    classification: "F1",
    reason: "Candidate F1 through Three.js r186 pass segmentation; the mounted pass shape and frame-parity control must also qualify.",
  };
};

export type AnatomyNativeDrawCommandDescription = Readonly<{
  supported: boolean;
  commandCount: number | null;
  kind: "draw" | "draw-indexed" | "draw-indirect" | "draw-indexed-indirect" | "batched" | "array-camera" | "unsupported";
  reason: string | null;
}>;

type NativeDrawObject = Readonly<{
  isBatchedMesh?: boolean;
  _multiDrawCount?: number;
  geometry?: Readonly<{ index?: unknown | null }>;
}>;

type NativeRenderObject = Readonly<{
  object?: NativeDrawObject;
  bundle?: unknown;
  camera?: Readonly<{ isArrayCamera?: boolean }>;
  getDrawParameters?: () => unknown | null;
  getIndirect?: () => unknown | null;
  getIndirectOffset?: () => unknown;
}>;

const unsupportedNativeDraw = (reason: string): AnatomyNativeDrawCommandDescription => ({
  supported: false,
  commandCount: null,
  kind: "unsupported",
  reason,
});

/** Describes only shapes whose r186 backend command count is explicit. */
export const describeAnatomyNativeDrawCommands = (
  renderObject: NativeRenderObject,
): AnatomyNativeDrawCommandDescription => {
  if (renderObject.bundle) return unsupportedNativeDraw("render-bundle-draws-cannot-be-split-at-the-live-pass-boundary");
  if (renderObject.camera?.isArrayCamera) {
    return {
      supported: false,
      commandCount: null,
      kind: "array-camera",
      reason: "Array-camera layers are deferred to render bundles until finishRender.",
    };
  }
  const object = renderObject.object;
  if (!object || typeof renderObject.getDrawParameters !== "function") {
    return unsupportedNativeDraw("r186-render-object-shape-unavailable");
  }
  const drawParameters = renderObject.getDrawParameters();
  if (drawParameters === null) return unsupportedNativeDraw("render-object-has-no-draw-parameters");

  if (object.isBatchedMesh) {
    const commandCount = object._multiDrawCount;
    const safeCommandCount = Number.isInteger(commandCount) && (commandCount ?? 0) > 0 ? commandCount! : null;
    if (safeCommandCount === null) {
      return unsupportedNativeDraw("batched-mesh-command-count-unavailable");
    }
    return {
      supported: safeCommandCount === 1,
      commandCount: safeCommandCount,
      kind: "batched",
      reason: safeCommandCount === 1 ? null : "one-backend-draw-contains-multiple-batched-native-commands",
    };
  }

  const indirect = renderObject.getIndirect?.() ?? null;
  const indexed = object.geometry?.index !== null && object.geometry?.index !== undefined;
  if (indirect !== null) {
    const offsets = renderObject.getIndirectOffset?.();
    const commandCount = Array.isArray(offsets) ? offsets.length : Number.isInteger(offsets) ? 1 : null;
    if (commandCount === null || commandCount < 1) {
      return unsupportedNativeDraw("indirect-command-count-unavailable");
    }
    return {
      supported: commandCount === 1,
      commandCount,
      kind: indexed ? "draw-indexed-indirect" : "draw-indirect",
      reason: commandCount === 1 ? null : "one-backend-draw-contains-multiple-indirect-native-commands",
    };
  }

  return {
    supported: true,
    commandCount: 1,
    kind: indexed ? "draw-indexed" : "draw",
    reason: null,
  };
};

export type AnatomyNativeFramebufferSample = Readonly<{
  index: number;
  x: number;
  y: number;
  rgba: readonly [number, number, number, number];
}>;

/** Converts one raw copyTextureToBuffer texel to a consistently reported RGBA tuple. */
export const anatomyNativeFramebufferTexelToRgba = (
  source: Uint8Array,
  format: string,
): readonly [number, number, number, number] => {
  if (source.length !== 4) throw new Error(`Expected one four-byte texel, received ${source.length} bytes`);
  if (format === "bgra8unorm" || format === "bgra8unorm-srgb") {
    return [source[2]!, source[1]!, source[0]!, source[3]!];
  }
  if (format === "rgba8unorm" || format === "rgba8unorm-srgb") {
    return [source[0]!, source[1]!, source[2]!, source[3]!];
  }
  throw new Error(`Framebuffer readback format is not four-channel 8-bit normalized color: ${format}`);
};

export const anatomyNativeFramebufferSamples = (
  pixels: Uint8Array,
  fullWidth: number,
  region: Readonly<{ x: number; y: number; width: number; height: number }>,
  format: string,
  indices: readonly number[],
): readonly AnatomyNativeFramebufferSample[] => {
  if (!Number.isInteger(fullWidth) || fullWidth < 1 || region.width < 1 || region.height < 1) {
    throw new Error("Native framebuffer sample dimensions are invalid");
  }
  if (pixels.length !== region.width * region.height * 4) {
    throw new Error(`Native framebuffer region has ${pixels.length} bytes; expected ${region.width * region.height * 4}`);
  }
  return indices.map((index) => {
    if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid native framebuffer pixel index ${index}`);
    const x = index % fullWidth;
    const y = Math.floor(index / fullWidth);
    const localX = x - region.x;
    const localY = y - region.y;
    if (localX < 0 || localX >= region.width || localY < 0 || localY >= region.height) {
      throw new Error(`Pixel ${index} lies outside the copied native framebuffer region`);
    }
    const byteOffset = (localY * region.width + localX) * 4;
    return {
      index,
      x,
      y,
      rgba: anatomyNativeFramebufferTexelToRgba(pixels.subarray(byteOffset, byteOffset + 4), format),
    };
  });
};
