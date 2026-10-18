export const M_INV8_NATIVE_PIPELINE_OBSERVER_KEY = "__vcsMInv8NativePipelineObserver";
export const M_INV8_NATIVE_PIPELINE_OBSERVER_VERSION = "three-r186-m-inv8-pipeline-v1";

export type MInv8PipelineBlendState = Readonly<{
  field: "present" | "absent" | "unknown";
  descriptor: Readonly<{
    color: Readonly<{ srcFactor: string | null; dstFactor: string | null; operation: string | null }> | null;
    alpha: Readonly<{ srcFactor: string | null; dstFactor: string | null; operation: string | null }> | null;
  }> | null;
}>;

export type MInv8NativeRenderPipelineDescriptor = Readonly<{
  colorTargets: readonly Readonly<{
    format: string | null;
    blend: MInv8PipelineBlendState;
    writeMask: number | null;
  }>[] | null;
  depthStencil: Readonly<{
    format: string | null;
    depthWriteEnabled: boolean | null;
    depthCompare: string | null;
    stencilReadMask: number | null;
    stencilWriteMask: number | null;
    stencilFront: Readonly<Record<string, string | number | null>> | null;
    stencilBack: Readonly<Record<string, string | number | null>> | null;
  }> | null;
  multisample: Readonly<{ count: number | null; alphaToCoverageEnabled: boolean | null; mask: number | null }>;
  primitive: Readonly<{ topology: string | null; frontFace: string | null; cullMode: string | null; stripIndexFormat: string | null }>;
}>;

export type MInv8NativePipelineEvidence = Readonly<{
  pipelineIdentity: string;
  deviceIdentity: string;
  createdBy: "GPUDevice.createRenderPipeline" | "GPUDevice.createRenderPipelineAsync";
  descriptorProvenance: "gpu-device-create-render-pipeline-argument";
  creationGeneration: number | null;
  creationGenerationIdentity: string | null;
  descriptor: MInv8NativeRenderPipelineDescriptor;
}>;

export type MInv8NativePipelineLookup =
  | Readonly<{ status: "observed"; evidence: MInv8NativePipelineEvidence }>
  | Readonly<{ status: "unsupported"; reason: string }>;

export type MInv8NativePipelineBlendQualification = Readonly<{
  status: "qualified" | "unsupported";
  reason?: string;
  evidence?: "bound-pipeline-creation-descriptor";
  pipelineIdentity?: string;
  deviceIdentity?: string;
  createdBy?: MInv8NativePipelineEvidence["createdBy"];
  descriptorProvenance?: MInv8NativePipelineEvidence["descriptorProvenance"];
  bindingProvenance?: "three-r186-WebGPUBackend.draw-renderObject-pipeline-to-_draw";
  targetCount?: number;
  colorTargetFormat?: string;
  colorTargetWriteMask?: number;
  blendEnabled?: boolean;
  blendDescriptor?: MInv8PipelineBlendState["descriptor"];
  depthStencil?: MInv8NativeRenderPipelineDescriptor["depthStencil"];
  multisample?: MInv8NativeRenderPipelineDescriptor["multisample"];
  primitive?: MInv8NativeRenderPipelineDescriptor["primitive"];
  creationGeneration?: number | null;
}>;

export type MInv8NativePipelineObserverBridge = Readonly<{
  version: string;
  attachDevice: (device: object, generation: number, generationIdentity: object) => boolean;
  read: (device: object, pipeline: object, generation: number, generationIdentity: object) => MInv8NativePipelineLookup;
  restoreDevice: (device: object, generation: number, generationIdentity: object) => boolean;
  restoreAll: () => void;
}>;

type MInv8PipelineObserverRealm = {
  navigator?: { gpu?: Record<string, unknown> };
  [M_INV8_NATIVE_PIPELINE_OBSERVER_KEY]?: MInv8NativePipelineObserverBridge;
};

/**
 * Installs a read-only, test-realm observer before WebGPU renderer startup.
 * Keep this function self-contained: the M-INV8 Playwright test serializes it
 * with Function#toString and runs it as an init script before page scripts.
 */
export const installMInv8NativePipelineObserverInRealm = (
  realm: MInv8PipelineObserverRealm,
): MInv8NativePipelineObserverBridge | null => {
  const bridgeKey = "__vcsMInv8NativePipelineObserver";
  if (realm[bridgeKey]) return realm[bridgeKey] ?? null;
  const gpu = realm.navigator?.gpu;
  if (!gpu || typeof gpu.requestAdapter !== "function") return null;

  type ObserverMethod = (this: unknown, ...args: unknown[]) => unknown;
  type MethodHook = { target: object; name: string; original: ObserverMethod; wrapper: ObserverMethod; descriptor?: PropertyDescriptor };
  type DescriptorTarget = {
    format?: unknown;
    blend?: unknown;
    writeMask?: unknown;
  };
  type PipelineDescriptor = {
    fragment?: { targets?: unknown };
    depthStencil?: Record<string, unknown> | null;
    multisample?: Record<string, unknown>;
    primitive?: Record<string, unknown>;
  };
  type EvidenceRecord = MInv8NativePipelineEvidence;

  const pipelineRecords = new WeakMap<object, WeakMap<object, EvidenceRecord>>();
  const deviceIdentities = new WeakMap<object, string>();
  const activeGenerations = new WeakMap<object, number>();
  const activeGenerationIdentities = new WeakMap<object, object>();
  const generationIdentityIds = new WeakMap<object, string>();
  const deviceHooks = new WeakMap<object, MethodHook[]>();
  const adapterHooks = new WeakMap<object, MethodHook[]>();
  const activeDevices = new Set<object>();
  const adapters = new Set<object>();
  let nextDeviceId = 1;
  let nextPipelineId = 1;
  let nextGenerationIdentityId = 1;
  let restored = false;
  let gpuHook: MethodHook | null = null;

  const snapshotBlendPart = (value: unknown) => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    return {
      srcFactor: typeof item.srcFactor === "string" ? item.srcFactor : null,
      dstFactor: typeof item.dstFactor === "string" ? item.dstFactor : null,
      operation: typeof item.operation === "string" ? item.operation : null,
    };
  };
  const snapshotDescriptor = (input: unknown): MInv8NativeRenderPipelineDescriptor => {
    const descriptor = (input && typeof input === "object" ? input : {}) as PipelineDescriptor;
    const rawTargets = descriptor.fragment?.targets;
    const colorTargets = Array.isArray(rawTargets)
      ? rawTargets.map((rawTarget) => {
          const target = (rawTarget && typeof rawTarget === "object" ? rawTarget : {}) as DescriptorTarget;
          const hasBlend = Object.prototype.hasOwnProperty.call(target, "blend") && target.blend !== undefined;
          const rawBlend = target.blend;
          const blendObject = rawBlend && typeof rawBlend === "object" ? rawBlend as Record<string, unknown> : null;
          const blendDescriptor = blendObject ? {
            color: snapshotBlendPart(blendObject.color),
            alpha: snapshotBlendPart(blendObject.alpha),
          } : null;
          return {
            format: typeof target.format === "string" ? target.format : null,
            blend: {
              field: hasBlend ? (blendDescriptor ? "present" as const : "unknown" as const) : "absent" as const,
              descriptor: blendDescriptor,
            },
            writeMask: typeof target.writeMask === "number" ? target.writeMask : null,
          };
        })
      : null;
    const rawDepth = descriptor.depthStencil;
    const depthStencil = rawDepth && typeof rawDepth === "object" ? {
      format: typeof rawDepth.format === "string" ? rawDepth.format : null,
      depthWriteEnabled: typeof rawDepth.depthWriteEnabled === "boolean" ? rawDepth.depthWriteEnabled : null,
      depthCompare: typeof rawDepth.depthCompare === "string" ? rawDepth.depthCompare : null,
      stencilReadMask: typeof rawDepth.stencilReadMask === "number" ? rawDepth.stencilReadMask : null,
      stencilWriteMask: typeof rawDepth.stencilWriteMask === "number" ? rawDepth.stencilWriteMask : null,
      stencilFront: snapshotStencil(rawDepth.stencilFront),
      stencilBack: snapshotStencil(rawDepth.stencilBack),
    } : null;
    const rawMultisample = descriptor.multisample ?? {};
    const rawPrimitive = descriptor.primitive ?? {};
    return {
      colorTargets,
      depthStencil,
      multisample: {
        count: typeof rawMultisample.count === "number" ? rawMultisample.count : null,
        alphaToCoverageEnabled: typeof rawMultisample.alphaToCoverageEnabled === "boolean" ? rawMultisample.alphaToCoverageEnabled : null,
        mask: typeof rawMultisample.mask === "number" ? rawMultisample.mask : null,
      },
      primitive: {
        topology: typeof rawPrimitive.topology === "string" ? rawPrimitive.topology : null,
        frontFace: typeof rawPrimitive.frontFace === "string" ? rawPrimitive.frontFace : null,
        cullMode: typeof rawPrimitive.cullMode === "string" ? rawPrimitive.cullMode : null,
        stripIndexFormat: typeof rawPrimitive.stripIndexFormat === "string" ? rawPrimitive.stripIndexFormat : null,
      },
    };
  };
  function snapshotStencil(value: unknown): Readonly<Record<string, string | number | null>> | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const result: Record<string, string | number | null> = {};
    for (const name of ["compare", "failOp", "depthFailOp", "passOp"]) {
      const entry = item[name];
      result[name] = typeof entry === "string" ? entry : null;
    }
    return result;
  }
  const setMethod = (target: object, propertyName: string, wrap: (original: ObserverMethod) => ObserverMethod): MethodHook | null => {
    const record = target as Record<string, unknown>;
    const original = record[propertyName];
    if (typeof original !== "function") return null;
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyName);
    const wrapper = wrap(original as ObserverMethod);
    try {
      Object.defineProperty(target, propertyName, { configurable: true, enumerable: descriptor?.enumerable ?? false, writable: true, value: wrapper });
    } catch {
      return null;
    }
    return { target, name: propertyName, original: original as ObserverMethod, wrapper, descriptor };
  };
  const restoreHooks = (hooks: readonly MethodHook[] | undefined) => {
    for (const hook of hooks ?? []) {
      const record = hook.target as Record<string, unknown>;
      if (record[hook.name] !== hook.wrapper) continue;
      try {
        if (hook.descriptor) Object.defineProperty(hook.target, hook.name, hook.descriptor);
        else delete record[hook.name];
      } catch {
        // Never replace a wrapper installed by a newer observer.
      }
    }
  };
  const recordPipeline = (
    device: object,
    createdBy: EvidenceRecord["createdBy"],
    descriptor: MInv8NativeRenderPipelineDescriptor,
    pipeline: unknown,
    creationGeneration: number | null,
    creationGenerationIdentity: string | null,
  ) => {
    if (!pipeline || typeof pipeline !== "object") return;
    let records = pipelineRecords.get(device);
    if (!records) {
      records = new WeakMap<object, EvidenceRecord>();
      pipelineRecords.set(device, records);
    }
    let deviceIdentity = deviceIdentities.get(device);
    if (!deviceIdentity) {
      deviceIdentity = `device-${nextDeviceId++}`;
      deviceIdentities.set(device, deviceIdentity);
    }
    records.set(pipeline as object, {
      pipelineIdentity: `${deviceIdentity}-pipeline-${nextPipelineId++}`,
      deviceIdentity,
      createdBy,
      descriptorProvenance: "gpu-device-create-render-pipeline-argument",
      creationGeneration,
      creationGenerationIdentity,
      descriptor,
    });
  };
  const wrapDevice = (device: object) => {
    if (deviceHooks.has(device)) return true;
    const hooks: MethodHook[] = [];
    const createSync = setMethod(device, "createRenderPipeline", (original) => function (this: unknown, descriptor: unknown) {
      let snapshot: MInv8NativeRenderPipelineDescriptor | null = null;
      try { snapshot = snapshotDescriptor(descriptor); } catch { /* Introspection must never alter rendering. */ }
      const creationGeneration = activeGenerations.get(device) ?? null;
      const generationIdentity = activeGenerationIdentities.get(device);
      let creationGenerationIdentity: string | null = null;
      if (generationIdentity) {
        creationGenerationIdentity = generationIdentityIds.get(generationIdentity) ?? `generation-${nextGenerationIdentityId++}`;
        generationIdentityIds.set(generationIdentity, creationGenerationIdentity);
      }
      const pipeline = original.call(this, descriptor);
      if (snapshot) {
        try { recordPipeline(device, "GPUDevice.createRenderPipeline", snapshot, pipeline, creationGeneration, creationGenerationIdentity); } catch { /* Evidence failure must not alter rendering. */ }
      }
      return pipeline;
    });
    if (createSync) hooks.push(createSync);
    const createAsync = setMethod(device, "createRenderPipelineAsync", (original) => function (this: unknown, descriptor: unknown) {
      let snapshot: MInv8NativeRenderPipelineDescriptor | null = null;
      try { snapshot = snapshotDescriptor(descriptor); } catch { /* Introspection must never alter rendering. */ }
      const creationGeneration = activeGenerations.get(device) ?? null;
      const generationIdentity = activeGenerationIdentities.get(device);
      let creationGenerationIdentity: string | null = null;
      if (generationIdentity) {
        creationGenerationIdentity = generationIdentityIds.get(generationIdentity) ?? `generation-${nextGenerationIdentityId++}`;
        generationIdentityIds.set(generationIdentity, creationGenerationIdentity);
      }
      const result = original.call(this, descriptor);
      if (snapshot && result && typeof (result as PromiseLike<unknown>).then === "function") {
        try {
          (result as PromiseLike<unknown>).then(
            (pipeline) => { try { recordPipeline(device, "GPUDevice.createRenderPipelineAsync", snapshot!, pipeline, creationGeneration, creationGenerationIdentity); } catch { /* Evidence failure must not change renderer behavior. */ } },
            () => undefined,
          );
        } catch {
          // Preserve the renderer's original promise and rejection behavior.
        }
      }
      return result;
    });
    if (createAsync) hooks.push(createAsync);
    if (hooks.length === 0) return false;
    deviceHooks.set(device, hooks);
    activeDevices.add(device);
    return true;
  };
  const wrapAdapter = (adapter: object) => {
    if (adapterHooks.has(adapter)) return;
    const hooks: MethodHook[] = [];
    const requestDevice = setMethod(adapter, "requestDevice", (original) => function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        try {
          (result as PromiseLike<unknown>).then(
            (device) => { if (device && typeof device === "object") wrapDevice(device as object); },
            () => undefined,
          );
        } catch {
          // Preserve the adapter's original promise and rejection behavior.
        }
      }
      return result;
    });
    if (requestDevice) hooks.push(requestDevice);
    if (hooks.length > 0) {
      adapterHooks.set(adapter, hooks);
      adapters.add(adapter);
    }
  };
  const bridge: MInv8NativePipelineObserverBridge = {
    version: "three-r186-m-inv8-pipeline-v1",
    attachDevice(device, generation, generationIdentity) {
      if (restored || !Number.isInteger(generation) || !generationIdentity || typeof generationIdentity !== "object") return false;
      activeGenerations.set(device, generation);
      activeGenerationIdentities.set(device, generationIdentity);
      if (!deviceHooks.has(device) && !wrapDevice(device)) {
        activeGenerations.delete(device);
        activeGenerationIdentities.delete(device);
        if (activeDevices.size === 0) bridge.restoreAll();
        return false;
      }
      if (!generationIdentityIds.has(generationIdentity)) {
        generationIdentityIds.set(generationIdentity, `generation-${nextGenerationIdentityId++}`);
      }
      const lost = (device as { lost?: Promise<unknown> }).lost;
      if (lost && typeof lost.then === "function") {
        lost.then(
          () => bridge.restoreDevice(device, generation, generationIdentity),
          () => bridge.restoreDevice(device, generation, generationIdentity),
        );
      }
      return true;
    },
    read(device, pipeline, generation, generationIdentity) {
      if (restored) return { status: "unsupported", reason: "observer-restored" };
      if (activeGenerations.get(device) !== generation || activeGenerationIdentities.get(device) !== generationIdentity) {
        return { status: "unsupported", reason: "renderer-generation-identity-not-attached" };
      }
      const evidence = pipelineRecords.get(device)?.get(pipeline);
      if (!evidence) return { status: "unsupported", reason: "pipeline-creation-descriptor-not-observed" };
      const currentIdentityId = generationIdentityIds.get(generationIdentity) ?? null;
      if (evidence.creationGeneration === null || evidence.creationGenerationIdentity === null) {
        return { status: "unsupported", reason: "pipeline-creation-outside-renderer-generation" };
      }
      if (evidence.creationGeneration !== generation) {
        return { status: "unsupported", reason: "pipeline-descriptor-from-different-renderer-generation" };
      }
      if (evidence.creationGenerationIdentity !== currentIdentityId) {
        return { status: "unsupported", reason: "pipeline-descriptor-from-different-renderer-generation-identity" };
      }
      return { status: "observed", evidence };
    },
    restoreDevice(device, generation, generationIdentity) {
      if (activeGenerations.get(device) !== generation || activeGenerationIdentities.get(device) !== generationIdentity) return false;
      activeGenerations.delete(device);
      activeGenerationIdentities.delete(device);
      restoreHooks(deviceHooks.get(device));
      deviceHooks.delete(device);
      activeDevices.delete(device);
      if (activeDevices.size === 0) {
        for (const adapter of adapters) {
          restoreHooks(adapterHooks.get(adapter));
          adapterHooks.delete(adapter);
        }
        adapters.clear();
        if (gpuHook) restoreHooks([gpuHook]);
        gpuHook = null;
      }
      return true;
    },
    restoreAll() {
      if (restored) return;
      for (const device of [...activeDevices]) {
        const generation = activeGenerations.get(device);
        const generationIdentity = activeGenerationIdentities.get(device);
        if (generation !== undefined && generationIdentity) bridge.restoreDevice(device, generation, generationIdentity);
        else {
          restoreHooks(deviceHooks.get(device));
          deviceHooks.delete(device);
          activeDevices.delete(device);
          activeGenerations.delete(device);
          activeGenerationIdentities.delete(device);
        }
      }
      for (const adapter of adapters) {
        restoreHooks(adapterHooks.get(adapter));
        adapterHooks.delete(adapter);
      }
      adapters.clear();
      if (gpuHook) restoreHooks([gpuHook]);
      gpuHook = null;
      restored = true;
      if (realm[bridgeKey] === bridge) delete realm[bridgeKey];
    },
  };

  const requestAdapter = setMethod(gpu, "requestAdapter", (original) => function (this: unknown, ...args: unknown[]) {
    const result = original.apply(this, args);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      try {
        (result as PromiseLike<unknown>).then(
          (adapter) => { if (adapter && typeof adapter === "object") wrapAdapter(adapter as object); },
          () => undefined,
        );
      } catch {
        // Preserve the GPU object's original promise and rejection behavior.
      }
    }
    return result;
  });
  gpuHook = requestAdapter;
  if (!gpuHook) return null;
  Object.defineProperty(realm, bridgeKey, { configurable: true, enumerable: false, writable: false, value: bridge });
  return bridge;
};

export const readMInv8NativePipelineObserver = (): MInv8NativePipelineObserverBridge | null => {
  if (typeof window === "undefined") return null;
  const realm = window as unknown as MInv8PipelineObserverRealm;
  const observer = realm[M_INV8_NATIVE_PIPELINE_OBSERVER_KEY];
  return observer?.version === M_INV8_NATIVE_PIPELINE_OBSERVER_VERSION ? observer : null;
};

export const qualifyMInv8NativePipelineEvidence = (input: Readonly<{
  lookup: MInv8NativePipelineLookup;
  generation: number;
  threeRevision: string;
  pipelineAvailable: boolean;
  pipelineHasError: boolean;
  selectedDrawAssociationVerified: boolean;
  colorTargetFormats: readonly string[] | null;
  depthStencilFormat: string | null;
  expectedSampleCount: number | null;
}>): MInv8NativePipelineBlendQualification => {
  const unsupported = (reason: string): MInv8NativePipelineBlendQualification => ({ status: "unsupported", reason });
  if (input.threeRevision !== "186") return unsupported("unsupported-three-revision");
  if (!input.pipelineAvailable) return unsupported("native-gpu-pipeline-unavailable");
  if (input.pipelineHasError) return unsupported("native-gpu-pipeline-has-error");
  if (!input.selectedDrawAssociationVerified) return unsupported("pipeline-not-associated-with-selected-draw");
  if (input.lookup.status !== "observed") return unsupported(input.lookup.reason);
  const evidence = input.lookup.evidence;
  if (evidence.creationGeneration === null || evidence.creationGenerationIdentity === null) {
    return unsupported("pipeline-creation-outside-renderer-generation");
  }
  if (evidence.creationGeneration !== input.generation) {
    return unsupported("pipeline-descriptor-from-different-renderer-generation");
  }
  const descriptor = evidence.descriptor;
  if (!descriptor.colorTargets) return unsupported("pipeline-color-target-descriptor-unavailable");
  if (!input.colorTargetFormats || input.colorTargetFormats.length === 0) return unsupported("render-context-color-targets-unavailable");
  if (descriptor.colorTargets.length !== input.colorTargetFormats.length) return unsupported("unexpected-pipeline-color-target-count");
  if (descriptor.colorTargets.some((target, index) => target.format === null || target.format !== input.colorTargetFormats?.[index])) {
    return unsupported("pipeline-color-target-format-mismatch");
  }
  if (descriptor.colorTargets.some((target) => target.writeMask === null)) return unsupported("pipeline-color-write-mask-unavailable");
  if (descriptor.colorTargets.some((target) => target.blend.field === "unknown")) return unsupported("pipeline-color-target-blend-state-unknown");
  if (descriptor.colorTargets.some((target) => target.blend.field === "present" && target.blend.descriptor === null)) {
    return unsupported("pipeline-color-target-blend-descriptor-unavailable");
  }
  if (input.expectedSampleCount === null || descriptor.multisample.count !== input.expectedSampleCount) {
    return unsupported("pipeline-multisample-count-mismatch");
  }
  if (input.depthStencilFormat !== null && descriptor.depthStencil?.format !== input.depthStencilFormat) {
    return unsupported("pipeline-depth-stencil-format-mismatch");
  }
  if (input.depthStencilFormat === null && descriptor.depthStencil !== null) {
    return unsupported("unexpected-pipeline-depth-stencil-state");
  }
  if (descriptor.primitive.topology === null || descriptor.primitive.frontFace === null || descriptor.primitive.cullMode === null) {
    return unsupported("pipeline-primitive-state-unavailable");
  }
  const target = descriptor.colorTargets[0];
  return {
    status: "qualified",
    evidence: "bound-pipeline-creation-descriptor",
    pipelineIdentity: evidence.pipelineIdentity,
    deviceIdentity: evidence.deviceIdentity,
    createdBy: evidence.createdBy,
    descriptorProvenance: evidence.descriptorProvenance,
    bindingProvenance: "three-r186-WebGPUBackend.draw-renderObject-pipeline-to-_draw",
    targetCount: descriptor.colorTargets.length,
    colorTargetFormat: target?.format ?? undefined,
    colorTargetWriteMask: target?.writeMask ?? undefined,
    blendEnabled: target?.blend.field === "present",
    blendDescriptor: target?.blend.descriptor ?? null,
    depthStencil: descriptor.depthStencil,
    multisample: descriptor.multisample,
    primitive: descriptor.primitive,
    creationGeneration: evidence.creationGeneration,
  };
};
