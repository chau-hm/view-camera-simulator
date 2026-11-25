import { describe, expect, it, vi } from "vitest";
import {
  installMInv8NativePipelineObserverInRealm,
  qualifyMInv8NativePipelineEvidence,
} from "../../render/backend/anatomyBellowsNativePipelineEvidence";

const descriptor = (blend?: Readonly<Record<string, unknown>>) => ({
  fragment: { targets: [{ format: "bgra8unorm", ...(blend ? { blend } : {}), writeMask: 15 }] },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: false,
    depthCompare: "less-equal",
    stencilReadMask: 0xffffffff,
    stencilWriteMask: 0xffffffff,
  },
  multisample: { count: 1, alphaToCoverageEnabled: false, mask: 0xffffffff },
  primitive: { topology: "triangle-list", frontFace: "ccw", cullMode: "back" },
});

const createFixture = async (attachGeneration = true) => {
  const pipeline = {};
  const device = {
    createRenderPipeline: vi.fn((...args: unknown[]) => { void args; return pipeline; }),
    createRenderPipelineAsync: vi.fn(async (...args: unknown[]) => { void args; return pipeline; }),
    lost: new Promise<never>(() => undefined),
  };
  const adapter = { requestDevice: vi.fn(async () => device) };
  const gpu = { requestAdapter: vi.fn(async () => adapter) };
  const originalDeviceCreate = device.createRenderPipeline;
  const originalDeviceCreateAsync = device.createRenderPipelineAsync;
  const originalRequestAdapter = gpu.requestAdapter;
  const originalRequestDevice = adapter.requestDevice;
  const realm = { navigator: { gpu } };
  const observer = installMInv8NativePipelineObserverInRealm(realm as never);
  if (!observer) throw new Error("Observer did not install");
  await gpu.requestAdapter();
  await adapter.requestDevice();
  const generationIdentity = {};
  if (attachGeneration && !observer.attachDevice(device, 5, generationIdentity)) throw new Error("Observer did not attach");
  return {
    pipeline,
    device,
    adapter,
    gpu,
    observer,
    generationIdentity,
    originalDeviceCreate,
    originalDeviceCreateAsync,
    originalRequestAdapter,
    originalRequestDevice,
  };
};

describe("M-INV8 native pipeline descriptor evidence", () => {
  it("qualifies the exact device-created pipeline descriptor and distinguishes absent blend", async () => {
    const fixture = await createFixture();
    const actual = descriptor();
    const pipeline = fixture.device.createRenderPipeline(actual);
    expect(pipeline).toBe(fixture.pipeline);
    const lookup = fixture.observer.read(fixture.device, pipeline, 5, fixture.generationIdentity);
    expect(lookup).toMatchObject({
      status: "observed",
      evidence: {
        createdBy: "GPUDevice.createRenderPipeline",
        descriptorProvenance: "gpu-device-create-render-pipeline-argument",
        descriptor: { colorTargets: [{ format: "bgra8unorm", blend: { field: "absent" }, writeMask: 15 }] },
      },
    });
    const qualification = qualifyMInv8NativePipelineEvidence({
      lookup,
      generation: 5,
      threeRevision: "186",
      pipelineAvailable: true,
      pipelineHasError: false,
      selectedDrawAssociationVerified: true,
      colorTargetFormats: ["bgra8unorm"],
      depthStencilFormat: "depth24plus",
      expectedSampleCount: 1,
    });
    expect(qualification).toMatchObject({ status: "qualified", blendEnabled: false, colorTargetWriteMask: 15 });
    fixture.observer.restoreDevice(fixture.device, 5, fixture.generationIdentity);
  });

  it("rejects a pipeline created before a renderer generation identity was attached", async () => {
    const fixture = await createFixture(false);
    const pipeline = fixture.device.createRenderPipeline(descriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    }));
    expect(fixture.observer.attachDevice(fixture.device, 5, fixture.generationIdentity)).toBe(true);
    expect(fixture.observer.read(fixture.device, pipeline, 5, fixture.generationIdentity)).toMatchObject({
      status: "unsupported",
      reason: "pipeline-creation-outside-renderer-generation",
    });
    fixture.observer.restoreDevice(fixture.device, 5, fixture.generationIdentity);
  });

  it("preserves sync and async pipeline creation failures and restores installed wrappers", async () => {
    const failure = new Error("native-pipeline-create-failed");
    const createRenderPipeline = vi.fn((...args: unknown[]) => { void args; throw failure; });
    const createRenderPipelineAsync = vi.fn((...args: unknown[]) => { void args; return Promise.reject(failure); });
    const device = { createRenderPipeline, createRenderPipelineAsync, lost: new Promise<never>(() => undefined) };
    const adapter = { requestDevice: vi.fn(async () => device) };
    const gpu = { requestAdapter: vi.fn(async () => adapter) };
    const originalRequestAdapter = gpu.requestAdapter;
    const originalRequestDevice = adapter.requestDevice;
    const realm = { navigator: { gpu } };
    const observer = installMInv8NativePipelineObserverInRealm(realm as never);
    if (!observer) throw new Error("Observer did not install");
    await gpu.requestAdapter();
    await adapter.requestDevice();
    const generationIdentity = {};
    expect(observer.attachDevice(device, 11, generationIdentity)).toBe(true);

    expect(() => device.createRenderPipeline(descriptor())).toThrow(failure);
    const rejected = device.createRenderPipelineAsync(descriptor());
    expect(rejected).toBe(createRenderPipelineAsync.mock.results[0]?.value);
    await expect(rejected).rejects.toBe(failure);

    expect(observer.restoreDevice(device, 11, generationIdentity)).toBe(true);
    expect(device.createRenderPipeline).toBe(createRenderPipeline);
    expect(device.createRenderPipelineAsync).toBe(createRenderPipelineAsync);
    expect(adapter.requestDevice).toBe(originalRequestDevice);
    expect(gpu.requestAdapter).toBe(originalRequestAdapter);
  });

  it("preserves the original asynchronous pipeline promise while recording its descriptor", async () => {
    const fixture = await createFixture();
    const descriptorWithBlend = descriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    });
    const result = fixture.device.createRenderPipelineAsync(descriptorWithBlend);
    expect(result).toBe(fixture.originalDeviceCreateAsync.mock.results[0]?.value);
    const pipeline = await result;
    expect(fixture.observer.read(fixture.device, pipeline, 5, fixture.generationIdentity)).toMatchObject({
      status: "observed",
      evidence: {
        createdBy: "GPUDevice.createRenderPipelineAsync",
        descriptor: { colorTargets: [{ blend: { field: "present" } }] },
      },
    });
    fixture.observer.restoreDevice(fixture.device, 5, fixture.generationIdentity);
  });

  it("keeps descriptor inspection failures from changing pipeline creation", async () => {
    const fixture = await createFixture();
    const throwingDescriptor = new Proxy({}, {
      get(target, property, receiver) {
        if (property === "fragment") throw new Error("diagnostic getter failed");
        return Reflect.get(target, property, receiver);
      },
    });
    expect(() => fixture.device.createRenderPipeline(throwingDescriptor)).not.toThrow();
    expect(fixture.originalDeviceCreate).toHaveBeenCalledWith(throwingDescriptor);
    expect(fixture.observer.read(fixture.device, fixture.pipeline, 5, fixture.generationIdentity)).toMatchObject({
      status: "unsupported",
      reason: "pipeline-creation-descriptor-not-observed",
    });
    fixture.observer.restoreDevice(fixture.device, 5, fixture.generationIdentity);
  });

  it("rejects an old mount token and does not let stale cleanup restore a newer mount", async () => {
    const fixture = await createFixture();
    const oldToken = fixture.generationIdentity;
    const pipeline = fixture.device.createRenderPipeline(descriptor({
      color: { srcFactor: "one", dstFactor: "zero", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "zero", operation: "add" },
    }));
    const wrappedDeviceCreate = fixture.device.createRenderPipeline;
    const nextToken = {};
    expect(fixture.observer.attachDevice(fixture.device, 5, nextToken)).toBe(true);
    expect(fixture.observer.read(fixture.device, pipeline, 5, oldToken)).toMatchObject({
      status: "unsupported",
      reason: "renderer-generation-identity-not-attached",
    });
    expect(fixture.observer.read(fixture.device, pipeline, 5, nextToken)).toMatchObject({
      status: "unsupported",
      reason: "pipeline-descriptor-from-different-renderer-generation-identity",
    });
    expect(fixture.observer.restoreDevice(fixture.device, 5, oldToken)).toBe(false);
    expect(fixture.device.createRenderPipeline).toBe(wrappedDeviceCreate);
    expect(fixture.observer.restoreDevice(fixture.device, 5, nextToken)).toBe(true);
    expect(fixture.device.createRenderPipeline).toBe(fixture.originalDeviceCreate);
    expect(fixture.gpu.requestAdapter).toBe(fixture.originalRequestAdapter);
    expect(fixture.adapter.requestDevice).toBe(fixture.originalRequestDevice);
  });

  it("qualifies actual blend state independently of material or expected state", async () => {
    const fixture = await createFixture();
    const pipeline = fixture.device.createRenderPipeline(descriptor({
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    }));
    const lookup = fixture.observer.read(fixture.device, pipeline, 5, fixture.generationIdentity);
    const qualification = qualifyMInv8NativePipelineEvidence({
      lookup,
      generation: 5,
      threeRevision: "186",
      pipelineAvailable: true,
      pipelineHasError: false,
      selectedDrawAssociationVerified: true,
      colorTargetFormats: ["bgra8unorm"],
      depthStencilFormat: "depth24plus",
      expectedSampleCount: 1,
    });
    expect(qualification).toMatchObject({ status: "qualified", blendEnabled: true });
    expect(qualification.blendDescriptor?.color).toMatchObject({ srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" });
    fixture.observer.restoreDevice(fixture.device, 5, fixture.generationIdentity);
  });
});
