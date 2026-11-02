import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";
import {
  ACCEPTABLE_COC_DIAMETER_MM,
} from "../../core/optics/physicalSharpness";
import {
  decodeGroundGlassFootprintAxesMm,
  decodeGroundGlassFootprintOrientation,
  decodeGroundGlassSignedCoC,
  encodeGroundGlassFootprintAxesMm,
  encodeGroundGlassFootprintOrientation,
  encodeGroundGlassSignedCoC,
  quantizeGroundGlassFootprintByte,
  quantizeGroundGlassSignedCoCByte,
} from "../../render/groundGlassCocTarget";
import {
  BINARY16_RANGE_PROBE_SAMPLES,
  FOOTPRINT_STORAGE_MAX_MM,
  MAX_FINITE_BINARY16,
  PHYSICAL_STORAGE_SAMPLES,
  SIGNED_COC_STORAGE_MAX_MM,
} from "./fixtures/ground-glass-webgpu-coc-footprint-cases";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-coc-footprint.html";
const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const BYTE_ORIENTATION_TOLERANCE_RAD = 0.02;
const halfFloatTolerance = (value: number) => Math.max(1e-7, Math.abs(value) * 0.001);

type Candidate = "half-float-mm" | "encoded-byte";
type Operation = {
  operationId: string;
  candidate: Candidate | "lifecycle";
  kind: "roundtrip" | "binary16-range-probe" | "held-readback" | "injected-failure";
  state: "queued" | "running" | "completed" | "failed" | "retired";
  stage: string;
  failureClassification: "readback" | "execution" | null;
  error: string | null;
  writerCompleted: boolean;
  consumerCompleted: boolean;
  readbackStarted: boolean;
  readbackOutcome: "not-started" | "pending" | "succeeded" | "failed";
  readbackError: string | null;
  resultPublished: boolean;
};
type Resource = {
  role: string;
  resourceId: string;
  state: "active" | "disposed" | "failed";
  disposalRequestCount: number;
  disposalCompletionCount: number;
  disposalFailed: string | null;
  disposeEventCount: number;
  gpuTextureId?: string | null;
};
type CandidateEvidence = {
  candidate: Candidate;
  requested: { format: string; type: string };
  actualGpuFormat: string | null;
  actualGpuUsage: number | null;
  texture: {
    colorSpace: string;
    minFilter: string;
    magFilter: string;
    generateMipmaps: boolean;
    width: number;
    height: number;
    textureUuid: string;
  };
  range: { cocDiameterMm: number; footprintRadiusMm: number };
  writerCompleted: boolean;
  storageReadback: { status: string; typedArray: string; sampleCount: number };
  consumerCompleted: boolean;
  classificationCompleted: boolean;
  outputColorSpace: string;
  toneMapping: number;
  filtering: {
    targetMinFilter: string;
    targetMagFilter: string;
    sourceCoCValuesMm: number[];
    midpointCoCMm: number;
    midpointClassification: "negative" | "neutral" | "positive";
  };
  resize: {
    completed: boolean;
    from: { width: number; height: number };
    to: { width: number; height: number };
    targetDisposeEvents: number;
    actualGpuFormatAfterResize: string | null;
    readbackSampleCount: number;
  };
  samples: Array<{
    id: string;
    source: string;
    input: {
      signedCoCDiameterMm: number;
      majorRadiusMm: number;
      minorRadiusMm: number;
      orientationRad: number;
    };
    storedRaw: number[];
    storedPhysical: number[];
    gpuDecoded: number[];
    gpuClassification: number;
  }>;
  metrics: {
    maximumSignedCoCErrorMm: number;
    maximumUnsaturatedSignedCoCErrorMm: number;
    maximumMajorRadiusErrorMm: number;
    maximumUnsaturatedMajorRadiusErrorMm: number;
    maximumMinorRadiusErrorMm: number;
    maximumUnsaturatedMinorRadiusErrorMm: number;
    maximumOrientationPeriodicErrorRad: number;
    maximumAnisotropyRatioAbsoluteError: number;
    signPreservedCount: number;
    nonzeroCoCCount: number;
    invalidAxisFailClosedCount: number;
    neutralByteCount: number;
    saturatedSignedCoCCount: number;
    saturatedFootprintAxisCount: number;
  };
};
type SerializableFloat = number | "Infinity" | "-Infinity" | "NaN";
type Binary16RangeProbeEvidence = {
  maxFiniteBinary16: number;
  actualGpuFormat: string | null;
  policy: string;
  storageReadback: { status: "completed"; typedArray: string; sampleCount: number };
  metrics: {
    unsupportedPhysicalSampleCount: number;
    unrepresentableChannelCount: number;
    channelsSaturatedToMaxFinite: number;
  };
  samples: Array<{
    id: string;
    input: {
      signedCoCDiameterMm: number;
      majorRadiusMm: number;
      minorRadiusMm: number;
      orientationRad: number;
    };
    representableChannels: [boolean, boolean, boolean, boolean];
    storedHalfBits: number[];
    storedValues: SerializableFloat[];
    gpuDecodedValues: SerializableFloat[];
    absolutePhysicalChannelErrorMm: [SerializableFloat, SerializableFloat, SerializableFloat];
    gpuClassification: number;
    physicalInterpretation: "supported-binary16-range" | "unsupported-binary16-range";
  }>;
};
type Handle = {
  instanceId: string;
  generation: number;
  state: "initializing" | "active" | "retiring" | "disposed" | "failed";
  runtime: null | {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
    deviceFeatures: string[];
  };
  operations: Operation[];
  candidates: CandidateEvidence[];
  binary16RangeProbe: Binary16RangeProbeEvidence | null;
  resources: Resource[];
  cleanupStartedAt: number | null;
  cleanupCompletedAt: number | null;
  cleanupError: string | null;
};
type Diagnostics = {
  route: string;
  documentId: string;
  status: string;
  error: string | null;
  filmScale: null | {
    physicalRadiusMm: number;
    targetWidthPx: number;
    full: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
    centeredFourX: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
    offCenterFourX: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
  };
  handles: Handle[];
};

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("coc-storage-diagnostics").textContent();
  if (!text) throw new Error("The CoC storage fixture has not published diagnostics");
  return JSON.parse(text) as Diagnostics;
};

const waitForDiagnostics = async (
  page: Page,
  predicate: (diagnostics: Diagnostics) => boolean,
  label: string,
) => {
  await expect.poll(async () => {
    try {
      return predicate(await readDiagnostics(page));
    } catch {
      return false;
    }
  }, { message: `Waiting for ${label}`, timeout: 90_000, intervals: [100, 250, 500] }).toBe(true);
  return readDiagnostics(page);
};

const handleById = (diagnostics: Diagnostics, instanceId: string): Handle | undefined =>
  diagnostics.handles.find((handle) => handle.instanceId === instanceId);

const lastHandle = (diagnostics: Diagnostics): Handle => {
  const handle = diagnostics.handles.at(-1);
  if (!handle) throw new Error("No renderer handle was recorded");
  return handle;
};

const latestOperation = (handle: Handle, kind: Operation["kind"]): Operation | undefined =>
  [...handle.operations].reverse().find((operation) => operation.kind === kind);

const successfulStaleReadback = (operation: Operation | undefined): boolean => Boolean(
  operation
  && operation.state === "retired"
  && operation.stage === "stale-readback-discarded"
  && operation.readbackStarted
  && operation.readbackOutcome === "succeeded"
  && operation.error === null
  && operation.readbackError === null
  && !operation.resultPublished,
);

const allOwnedResourcesDisposed = (handle: Handle): boolean => Boolean(
  handle.state === "disposed"
  && handle.cleanupCompletedAt
  && !handle.cleanupError
  && handle.resources.length > 0
  && handle.resources.every((resource) =>
    resource.state === "disposed"
    && resource.disposalRequestCount === 1
    && resource.disposalCompletionCount === 1
    && resource.disposalFailed === null,
  ),
);

const half = (value: number): number => THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(value));
const sampleById = (id: string): (typeof PHYSICAL_STORAGE_SAMPLES)[number] => {
  const sample = PHYSICAL_STORAGE_SAMPLES.find((entry) => entry.id === id);
  if (!sample) throw new Error(`Missing fixed physical storage sample ${id}`);
  return sample;
};
const periodicError = (a: number, b: number): number => {
  const raw = Math.abs(a - b) % Math.PI;
  return Math.min(raw, Math.PI - raw);
};

const cpuExpected = (candidate: Candidate, sample: (typeof PHYSICAL_STORAGE_SAMPLES)[number]) => {
  const coc = encodeGroundGlassSignedCoC(
    sample.signedCoCDiameterMm,
    candidate,
    SIGNED_COC_STORAGE_MAX_MM,
  );
  const axes = encodeGroundGlassFootprintAxesMm({
    majorRadiusMm: sample.majorRadiusMm,
    minorRadiusMm: sample.minorRadiusMm,
    storageFormat: candidate,
    maximumRadiusMm: FOOTPRINT_STORAGE_MAX_MM,
  });
  const orientation = encodeGroundGlassFootprintOrientation(sample.orientationRad);

  if (candidate === "half-float-mm") {
    const stored = [half(coc), half(axes.encodedMajorRadius), half(axes.encodedMinorRadius), half(orientation)];
    return {
      stored,
      decoded: [stored[0], stored[1], stored[2], half(stored[3] * Math.PI)],
    };
  }

  const stored = [
    quantizeGroundGlassSignedCoCByte(coc),
    quantizeGroundGlassFootprintByte(axes.encodedMajorRadius),
    quantizeGroundGlassFootprintByte(axes.encodedMinorRadius),
    quantizeGroundGlassFootprintByte(orientation),
  ];
  const decodedAxes = decodeGroundGlassFootprintAxesMm({
    encodedMajorRadius: stored[1] / 255,
    encodedMinorRadius: stored[2] / 255,
    storageFormat: candidate,
    maximumRadiusMm: FOOTPRINT_STORAGE_MAX_MM,
  });
  return {
    stored,
    decoded: [
      half(decodeGroundGlassSignedCoC(stored[0] / 255, candidate, SIGNED_COC_STORAGE_MAX_MM)),
      half(decodedAxes.majorRadiusMm),
      half(decodedAxes.minorRadiusMm),
      half(decodeGroundGlassFootprintOrientation(stored[3] / 255, candidate)),
    ],
  };
};

const expectPhysicalConformance = (candidate: CandidateEvidence) => {
  expect(candidate.samples.map((sample) => sample.id)).toEqual(PHYSICAL_STORAGE_SAMPLES.map((sample) => sample.id));
  for (const sample of candidate.samples) {
    const expected = cpuExpected(candidate.candidate, sampleById(sample.id));
    if (candidate.candidate === "half-float-mm") {
      for (const [channel, value] of sample.storedRaw.entries()) {
        expect(
          Math.abs(value - expected.stored[channel]),
          `${candidate.candidate}/${sample.id} half-float channel ${channel}`,
        ).toBeLessThan(halfFloatTolerance(expected.stored[channel]));
      }
    } else {
      expect(sample.storedRaw, `${candidate.candidate}/${sample.id} byte channels`).toEqual(expected.stored);
    }
    expect(Math.abs(sample.gpuDecoded[0] - expected.decoded[0]), `${candidate.candidate}/${sample.id} signed CoC`).toBeLessThan(halfFloatTolerance(expected.decoded[0]));
    expect(Math.abs(sample.gpuDecoded[1] - expected.decoded[1]), `${candidate.candidate}/${sample.id} major radius`).toBeLessThan(halfFloatTolerance(expected.decoded[1]));
    expect(Math.abs(sample.gpuDecoded[2] - expected.decoded[2]), `${candidate.candidate}/${sample.id} minor radius`).toBeLessThan(halfFloatTolerance(expected.decoded[2]));
    expect(periodicError(sample.gpuDecoded[3], expected.decoded[3]), `${candidate.candidate}/${sample.id} orientation`).toBeLessThan(0.003);
    expect(sample.gpuClassification, `${candidate.candidate}/${sample.id} sign classification`).toBe(Math.sign(expected.decoded[0]));
  }

  const exactZero = candidate.samples.find((sample) => sample.id === "exact-neutral");
  expect(exactZero?.input.signedCoCDiameterMm).toBe(0);
  expect(exactZero?.gpuDecoded[0]).toBe(0);
  if (candidate.candidate === "encoded-byte") expect(exactZero?.storedRaw[0]).toBe(128);

  const adjacentNegative = candidate.samples.find((sample) => sample.id === "adjacent-negative");
  const adjacentPositive = candidate.samples.find((sample) => sample.id === "adjacent-positive");
  expect(adjacentNegative?.gpuClassification).toBe(-1);
  expect(adjacentPositive?.gpuClassification).toBe(1);
  if (candidate.candidate === "encoded-byte") {
    expect(adjacentNegative?.storedRaw[0]).toBeLessThan(128);
    expect(adjacentPositive?.storedRaw[0]).toBeGreaterThan(128);
  }

  const knownEllipse = candidate.samples.find((sample) => sample.id === "in-range-channel-layout");
  const knownEllipseExpected = cpuExpected(candidate.candidate, sampleById("in-range-channel-layout"));
  expect(knownEllipse?.input.majorRadiusMm).toBe(2.5);
  expect(knownEllipse?.input.minorRadiusMm).toBe(1);
  expect(Math.abs((knownEllipse?.gpuDecoded[1] ?? 0) - knownEllipseExpected.decoded[1])).toBeLessThan(halfFloatTolerance(knownEllipseExpected.decoded[1]));
  expect(Math.abs((knownEllipse?.gpuDecoded[2] ?? 0) - knownEllipseExpected.decoded[2])).toBeLessThan(halfFloatTolerance(knownEllipseExpected.decoded[2]));

  const nearPi = candidate.samples.find((sample) => sample.id === "strong-ellipse-near-pi");
  expect(periodicError(nearPi?.gpuDecoded[3] ?? 0, Math.PI - 0.0001)).toBeLessThan(
    candidate.candidate === "encoded-byte" ? BYTE_ORIENTATION_TOLERANCE_RAD : 0.003,
  );
  const negativeOrientation = candidate.samples.find((sample) => sample.id === "over-range-pair-scale");
  expect(periodicError(negativeOrientation?.gpuDecoded[3] ?? 0, 3 * Math.PI / 4)).toBeLessThan(
    candidate.candidate === "encoded-byte" ? BYTE_ORIENTATION_TOLERANCE_RAD : 0.003,
  );

  expect(candidate.filtering.targetMinFilter).toBe("NearestFilter");
  expect(candidate.filtering.targetMagFilter).toBe("NearestFilter");
  expect(candidate.filtering.midpointClassification).not.toBe("neutral");
  expect(
    Math.min(...candidate.filtering.sourceCoCValuesMm.map((value) => Math.abs(value - candidate.filtering.midpointCoCMm))),
  ).toBeLessThan(0.003);
  expect(candidate.texture.colorSpace).toBe(THREE.NoColorSpace);
  expect(candidate.outputColorSpace).toBe(THREE.NoColorSpace);
  expect(candidate.toneMapping).toBe(THREE.NoToneMapping);
  expect(candidate.writerCompleted).toBe(true);
  expect(candidate.consumerCompleted).toBe(true);
  expect(candidate.classificationCompleted).toBe(true);
  expect(candidate.resize.completed).toBe(true);
  expect(candidate.resize.targetDisposeEvents).toBe(1);
  expect(candidate.resize.readbackSampleCount).toBe(PHYSICAL_STORAGE_SAMPLES.length + 1);
  expect(candidate.resize.actualGpuFormatAfterResize).toBe(candidate.actualGpuFormat);
  if (candidate.candidate === "half-float-mm") {
    expect(candidate.metrics.maximumSignedCoCErrorMm).toBeLessThan(0.001);
    expect(candidate.metrics.maximumMajorRadiusErrorMm).toBeLessThan(0.001);
    expect(candidate.metrics.maximumMinorRadiusErrorMm).toBeLessThan(0.001);
    expect(candidate.metrics.maximumOrientationPeriodicErrorRad).toBeLessThan(0.004);
    expect(candidate.metrics.signPreservedCount).toBe(candidate.metrics.nonzeroCoCCount);
  } else {
    const cocQuantizationBound = SIGNED_COC_STORAGE_MAX_MM / (2 * 127)
      + SIGNED_COC_STORAGE_MAX_MM * 2 ** -10;
    const axisQuantizationBound = FOOTPRINT_STORAGE_MAX_MM / (2 * 255)
      + FOOTPRINT_STORAGE_MAX_MM * 2 ** -10;
    const orientationQuantizationBound = Math.PI / (2 * 255) + Math.PI * 2 ** -10;
    expect(candidate.metrics.maximumUnsaturatedSignedCoCErrorMm).toBeLessThan(cocQuantizationBound);
    expect(candidate.metrics.maximumUnsaturatedMajorRadiusErrorMm).toBeLessThan(axisQuantizationBound);
    expect(candidate.metrics.maximumUnsaturatedMinorRadiusErrorMm).toBeLessThan(axisQuantizationBound);
    expect(candidate.metrics.maximumOrientationPeriodicErrorRad).toBeLessThan(orientationQuantizationBound);
    expect(candidate.metrics.signPreservedCount).toBe(candidate.metrics.nonzeroCoCCount - 6);
    const pairScaled = candidate.samples.find((sample) => sample.id === "over-range-pair-scale");
    expect((pairScaled?.gpuDecoded[1] ?? 0) / (pairScaled?.gpuDecoded[2] ?? 1)).toBeCloseTo(4, 1);
  }
  if (candidate.candidate === "encoded-byte") {
    expect(candidate.metrics.neutralByteCount).toBe(
      candidate.samples.filter((sample) => sample.storedRaw[0] === 128).length,
    );
    expect(candidate.metrics.neutralByteCount).toBe(8);
    expect(candidate.metrics.saturatedSignedCoCCount).toBe(2);
    expect(candidate.metrics.saturatedFootprintAxisCount).toBeGreaterThanOrEqual(3);
  } else {
    expect(candidate.metrics.saturatedSignedCoCCount).toBe(0);
    expect(candidate.metrics.saturatedFootprintAxisCount).toBe(0);
  }
  expect(candidate.metrics.invalidAxisFailClosedCount).toBe(1);
  const invalidAxes = candidate.samples.find((sample) => sample.id === "invalid-axis-ordering");
  expect(invalidAxes?.gpuDecoded[1]).toBe(0);
  expect(invalidAxes?.gpuDecoded[2]).toBe(0);

  expect(ACCEPTABLE_COC_DIAMETER_MM).toBe(0.1);
  const sharpnessNegative = candidate.samples.find((sample) => sample.id === "sharpness-boundary-negative");
  const sharpnessPositive = candidate.samples.find((sample) => sample.id === "sharpness-boundary-positive");
  expect(sharpnessNegative?.input.signedCoCDiameterMm).toBe(-ACCEPTABLE_COC_DIAMETER_MM);
  expect(sharpnessPositive?.input.signedCoCDiameterMm).toBe(ACCEPTABLE_COC_DIAMETER_MM);
  const negativeNeutralEdge = candidate.samples.find((sample) => sample.id === "byte-neutral-transition-negative");
  const positiveNeutralEdge = candidate.samples.find((sample) => sample.id === "byte-neutral-transition-positive");
  const negativeSignedEdge = candidate.samples.find((sample) => sample.id === "byte-sign-transition-negative");
  const positiveSignedEdge = candidate.samples.find((sample) => sample.id === "byte-sign-transition-positive");
  expect(negativeNeutralEdge?.input.signedCoCDiameterMm).toBe(-0.14);
  expect(positiveNeutralEdge?.input.signedCoCDiameterMm).toBe(0.14);
  expect(negativeSignedEdge?.input.signedCoCDiameterMm).toBe(-0.15);
  expect(positiveSignedEdge?.input.signedCoCDiameterMm).toBe(0.15);
  if (candidate.candidate === "half-float-mm") {
    for (const sample of [sharpnessNegative, sharpnessPositive, negativeNeutralEdge, positiveNeutralEdge, negativeSignedEdge, positiveSignedEdge]) {
      expect(sample?.gpuClassification, `half-float ${sample?.id} retains its nonzero physical CoC sign`).toBe(
        Math.sign(sample?.input.signedCoCDiameterMm ?? 0),
      );
    }
  } else {
    for (const sample of [sharpnessNegative, sharpnessPositive, negativeNeutralEdge, positiveNeutralEdge]) {
      expect(sample?.storedRaw[0], `encoded-byte ${sample?.id} falls in the neutral code`).toBe(128);
      expect(sample?.gpuDecoded[0]).toBe(0);
      expect(sample?.gpuClassification).toBe(0);
    }
    expect(negativeSignedEdge?.storedRaw[0]).toBe(127);
    expect(negativeSignedEdge?.gpuClassification).toBe(-1);
    expect(positiveSignedEdge?.storedRaw[0]).toBe(129);
    expect(positiveSignedEdge?.gpuClassification).toBe(1);
  }
};

const assertNativeExecutionWhenRequired = (handle: Handle) => {
  expect(handle.runtime, `runtime evidence for ${handle.instanceId}`).not.toBeNull();
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.rendererFamily).toBe("webgpu-renderer");
  expect(handle.runtime?.threeRevision).toBe(nativeWebGpuRequired ? "186" : THREE.REVISION);
  if (nativeWebGpuRequired) {
    expect(handle.runtime?.executionBackend).toBe("webgpu");
    expect(handle.runtime?.applicationFallback).toBe(false);
  } else {
    expect(handle.runtime?.executionBackend).not.toBe("webgpu");
  }
};

const navigateAwayAndWait = async (page: Page, instanceId: string) => {
  await page.getByTestId("coc-storage-nav-away").click();
  await expect(page).toHaveURL(/#\/away$/);
  await expect(page.getByTestId("coc-storage-away")).toBeVisible();
  return waitForDiagnostics(page, (diagnostics) => handleById(diagnostics, instanceId)?.state === "disposed", `handle ${instanceId} cleanup`);
};

test("GPU CoC/footprint writers and TSL consumers match the CPU codec contract", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("coc-storage-experiment")).toBeVisible();
  const diagnostics = await waitForDiagnostics(page, (value) => {
    const handle = value.handles.at(-1);
    return Boolean(
      value.status === "ready"
      && handle?.state === "active"
      && handle.runtime?.initialized
      && handle.candidates.length === 2
      && handle.operations.filter((operation) => operation.kind === "roundtrip" && operation.state === "completed").length === 2,
    );
  }, "both storage round trips to complete");
  const handle = lastHandle(diagnostics);
  assertNativeExecutionWhenRequired(handle);
  expect(handle.runtime?.applicationFallback).toBe(false);
  for (const candidateName of ["half-float-mm", "encoded-byte"] as const) {
    const candidate = handle.candidates.find((item) => item.candidate === candidateName);
    expect(candidate, `${candidateName} candidate evidence`).toBeDefined();
    if (!candidate) continue;
    expect(candidate.requested.format).toBe("RGBAFormat");
    expect(candidate.requested.type).toBe(candidateName === "half-float-mm" ? "HalfFloatType" : "UnsignedByteType");
    expect(candidate.texture.width).toBe(PHYSICAL_STORAGE_SAMPLES.length);
    expect(candidate.texture.height).toBe(1);
    expect(candidate.storageReadback.status).toBe("completed");
    expect(candidate.storageReadback.sampleCount).toBe(PHYSICAL_STORAGE_SAMPLES.length);
    expectPhysicalConformance(candidate);
    if (nativeWebGpuRequired) {
      expect(candidate.actualGpuFormat).toBe(candidateName === "half-float-mm" ? "rgba16float" : "rgba8unorm");
      expect(candidate.actualGpuUsage).not.toBeNull();
      const target = handle.resources.find((resource) => resource.role === `${candidateName}:storage-target`);
      expect(target?.gpuTextureId).toBeTruthy();
      expect(target?.resourceId).toBe(candidate.texture.textureUuid);
      expect(candidate.storageReadback.typedArray).toBe(candidateName === "half-float-mm" ? "Uint16Array" : "Uint8Array");
    }
  }
  const scale = diagnostics.filmScale;
  expect(scale).not.toBeNull();
  if (!scale) throw new Error("Physical full-film and Loupe scale evidence is missing");
  expect(scale.full.sampledWidthMm).toBeCloseTo(127, 6);
  expect(scale.full.sampledHeightMm).toBeCloseTo(101.6, 6);
  expect(scale.centeredFourX.sampledWidthMm).toBeCloseTo(31.75, 6);
  expect(scale.centeredFourX.sampledHeightMm).toBeCloseTo(25.4, 6);
  expect(scale.offCenterFourX.sampledWidthMm).toBeCloseTo(31.75, 6);
  expect(scale.offCenterFourX.sampledHeightMm).toBeCloseTo(25.4, 6);
  expect(scale.full.window.widthFraction).toBe(1);
  expect(scale.centeredFourX.window.widthFraction).toBe(0.25);
  expect(scale.centeredFourX.window.heightFraction).toBe(0.25);
  expect(scale.centeredFourX.window.centerU).toBe(0.5);
  expect(scale.offCenterFourX.window.centerU).toBeCloseTo(0.3125, 6);
  expect(scale.offCenterFourX.window.centerV).toBeCloseTo(0.59375, 6);
  expect(scale.centeredFourX.majorAxisPx[0] / scale.full.majorAxisPx[0]).toBeCloseTo(4, 6);
  expect(scale.offCenterFourX.majorAxisPx[0]).toBeCloseTo(scale.centeredFourX.majorAxisPx[0], 6);

  await testInfo.attach("storage-roundtrip-diagnostics.json", {
    body: Buffer.from(JSON.stringify({ runtime: handle.runtime, candidates: handle.candidates, filmScale: scale }, null, 2)),
    contentType: "application/json",
  });
});

test("native binary16 range probe records finite and saturated storage separately", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired, "Binary16 overflow measurements require the native WebGPU renderer");
  test.setTimeout(150_000);
  await page.goto(FIXTURE_PATH);
  const ready = await waitForDiagnostics(page, (diagnostics) => {
    const handle = diagnostics.handles.at(-1);
    return Boolean(diagnostics.status === "ready" && handle?.state === "active" && handle.candidates.length === 2);
  }, "ordinary storage round trips before the isolated binary16 range probe");
  const handle = lastHandle(ready);
  assertNativeExecutionWhenRequired(handle);

  await page.getByTestId("coc-storage-run-binary16-range-probe").click();
  const completed = await waitForDiagnostics(page, (diagnostics) => {
    const current = handleById(diagnostics, handle.instanceId);
    const operation = current?.operations.find((entry) => entry.kind === "binary16-range-probe");
    return Boolean(operation?.state === "completed" && operation.stage === "binary16-range-probe-published" && current?.binary16RangeProbe);
  }, "the dedicated binary16 range storage and sampling probe");
  const probedHandle = handleById(completed, handle.instanceId);
  const operation = probedHandle?.operations.find((entry) => entry.kind === "binary16-range-probe");
  const range = probedHandle?.binary16RangeProbe;
  expect(operation?.operationId).toBe(`${handle.instanceId}-op3`);
  expect(operation?.writerCompleted).toBe(true);
  expect(operation?.consumerCompleted).toBe(true);
  expect(operation?.readbackOutcome).toBe("succeeded");
  expect(range?.maxFiniteBinary16).toBe(MAX_FINITE_BINARY16);
  if (nativeWebGpuRequired) expect(range?.actualGpuFormat).toBe("rgba16float");
  else expect(range?.actualGpuFormat).toBeNull();
  expect(range?.storageReadback.status).toBe("completed");
  expect(range?.storageReadback.typedArray).toBe("Uint16Array");
  expect(range?.storageReadback.sampleCount).toBe(BINARY16_RANGE_PROBE_SAMPLES.length);
  expect(range?.samples.map((sample) => sample.id)).toEqual(BINARY16_RANGE_PROBE_SAMPLES.map((sample) => sample.id));
  expect(range?.policy).toContain("explicitly unsupported physical data");

  for (const sample of range?.samples ?? []) {
    const input = BINARY16_RANGE_PROBE_SAMPLES.find((entry) => entry.id === sample.id);
    expect(input, `fixed boundary input ${sample.id}`).toBeDefined();
    if (!input) continue;
    expect(sample.input.signedCoCDiameterMm).toBe(input.signedCoCDiameterMm);
    expect(sample.input.majorRadiusMm).toBe(input.majorRadiusMm);
    expect(sample.input.minorRadiusMm).toBe(input.minorRadiusMm);
    expect(sample.representableChannels).toEqual([
      Math.abs(input.signedCoCDiameterMm) <= MAX_FINITE_BINARY16,
      input.majorRadiusMm <= MAX_FINITE_BINARY16,
      input.minorRadiusMm <= MAX_FINITE_BINARY16,
      Math.abs(input.orientationRad / Math.PI) <= 1,
    ]);
    expect(sample.physicalInterpretation).toBe(
      Math.max(Math.abs(input.signedCoCDiameterMm), input.majorRadiusMm, input.minorRadiusMm) <= MAX_FINITE_BINARY16
        ? "supported-binary16-range"
        : "unsupported-binary16-range",
    );
    expect(sample.storedHalfBits).toHaveLength(4);
    expect(sample.storedValues).toHaveLength(4);
    expect(sample.gpuDecodedValues).toHaveLength(4);
    expect(sample.absolutePhysicalChannelErrorMm).toHaveLength(3);
    expect(sample.gpuDecodedValues).toEqual(sample.storedValues);
    const physicalInputs = [input.signedCoCDiameterMm, input.majorRadiusMm, input.minorRadiusMm];
    for (const [channel, physicalInput] of physicalInputs.entries()) {
      const decodedValue = sample.gpuDecodedValues[channel];
      expect(sample.absolutePhysicalChannelErrorMm[channel]).toBe(
        typeof decodedValue === "number" ? Math.abs(decodedValue - physicalInput) : "Infinity",
      );
    }
    expect(sample.gpuClassification).toBe(Math.sign(input.signedCoCDiameterMm));
    if (sample.physicalInterpretation === "supported-binary16-range") {
      const expectedChannels = [
        input.signedCoCDiameterMm,
        input.majorRadiusMm,
        input.minorRadiusMm,
        ((input.orientationRad / Math.PI) % 1 + 1) % 1,
      ];
      for (const [channel, value] of expectedChannels.entries()) {
        expect(typeof sample.storedValues[channel], `${sample.id} supported channel ${channel} stays finite`).toBe("number");
        if (nativeWebGpuRequired) {
          expect(sample.storedValues[channel], `${sample.id} native channel ${channel} matches binary16 rounding`).toBe(half(value));
        } else {
          expect(Number.isFinite(sample.storedValues[channel]), `${sample.id} fallback channel ${channel} remains finite`).toBe(true);
        }
      }
    }
  }
  const rangeSampleById = (id: string) => {
    const sample = range?.samples.find((entry) => entry.id === id);
    if (!sample) throw new Error(`Missing GPU binary16 range sample ${id}`);
    return sample;
  };
  if (nativeWebGpuRequired) {
    expect(range?.metrics.unsupportedPhysicalSampleCount).toBe(7);
    expect(range?.metrics.unrepresentableChannelCount).toBe(14);
    expect(range?.metrics.channelsSaturatedToMaxFinite).toBe(14);
    expect(rangeSampleById("maximum-finite-positive").storedHalfBits[0]).toBe(0x7bff);
    expect(rangeSampleById("maximum-finite-negative").storedHalfBits[0]).toBe(0xfbff);
    for (const id of [
      "slightly-above-maximum-positive",
      "binary16-overflow-edge-positive",
      "clearly-overflow-positive",
    ]) {
      expect(rangeSampleById(id).storedValues[0], `${id} is observed as finite-range saturation`).toBe(MAX_FINITE_BINARY16);
    }
    for (const id of [
      "slightly-above-maximum-negative",
      "binary16-overflow-edge-negative",
      "clearly-overflow-negative",
    ]) {
      expect(rangeSampleById(id).storedValues[0], `${id} preserves sign at finite-range saturation`).toBe(-MAX_FINITE_BINARY16);
    }
    expect(rangeSampleById("clearly-overflow-positive").storedValues.slice(0, 3)).toEqual([65504, 65504, 49984]);
    expect(rangeSampleById("clearly-overflow-negative").storedValues.slice(0, 3)).toEqual([-65504, 65504, 49984]);
    expect(rangeSampleById("oversized-ellipse-axes").storedValues.slice(0, 3)).toEqual([1, 65504, 65504]);
  }

  await testInfo.attach("binary16-range-probe.json", {
    body: Buffer.from(JSON.stringify({ runtime: probedHandle?.runtime, probe: range }, null, 2)),
    contentType: "application/json",
  });
  const disposed = await navigateAwayAndWait(page, handle.instanceId);
  expect(allOwnedResourcesDisposed(handleById(disposed, handle.instanceId)!)).toBe(true);
});

test("successful readback retirement and handle-owned resource cleanup survive SPA remount", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto(FIXTURE_PATH);
  const ready = await waitForDiagnostics(page, (diagnostics) => {
    const handle = diagnostics.handles.at(-1);
    return Boolean(diagnostics.status === "ready" && handle?.state === "active" && handle.candidates.length === 2);
  }, "first renderer handle to initialize");
  const first = lastHandle(ready);
  assertNativeExecutionWhenRequired(first);
  const firstDocumentId = ready.documentId;
  const target = first.resources.find((resource) => resource.role === "half-float-mm:storage-target");
  expect(target).toBeDefined();
  expect(target?.resourceId).toBe(first.candidates.find((item) => item.candidate === "half-float-mm")?.texture.textureUuid);

  await page.getByRole("button", { name: "Start held readback" }).click();
  const held = await waitForDiagnostics(page, (diagnostics) => {
    const operation = latestOperation(handleById(diagnostics, first.instanceId)!, "held-readback");
    return Boolean(operation?.state === "running" && operation.stage === "readback-settled-held" && operation.readbackStarted && operation.readbackOutcome === "succeeded");
  }, "native readback to settle at the test barrier");
  const heldOperation = latestOperation(handleById(held, first.instanceId)!, "held-readback");
  expect(heldOperation?.operationId).toBe(`${first.instanceId}-op3`);

  await page.getByTestId("coc-storage-nav-away").click();
  await expect(page).toHaveURL(/#\/away$/);
  const retiring = await waitForDiagnostics(page, (diagnostics) => handleById(diagnostics, first.instanceId)?.state === "retiring", "first handle to retire on SPA navigation");
  expect(retiring.documentId).toBe(firstDocumentId);
  const retiringHandle = handleById(retiring, first.instanceId)!;
  expect(retiringHandle.state).toBe("retiring");
  expect(retiringHandle.resources.every((resource) => resource.state === "active")).toBe(true);
  expect(latestOperation(retiringHandle, "held-readback")?.state).toBe("running");

  await page.getByTestId("coc-storage-release-readback").click();
  const retiredDiagnostics = await waitForDiagnostics(page, (diagnostics) => handleById(diagnostics, first.instanceId)?.state === "disposed", "first handle resources to finish disposal");
  expect(retiredDiagnostics.documentId).toBe(firstDocumentId);
  const retired = handleById(retiredDiagnostics, first.instanceId)!;
  const operation = latestOperation(retired, "held-readback");
  expect(successfulStaleReadback(operation)).toBe(true);
  expect(operation?.stage).toBe("stale-readback-discarded");
  expect(operation?.error).toBeNull();
  expect(allOwnedResourcesDisposed(retired)).toBe(true);

  await page.getByTestId("coc-storage-nav-experiment").click();
  await expect(page).toHaveURL(/#\/experiment$/);
  const remounted = await waitForDiagnostics(page, (diagnostics) => {
    const handle = diagnostics.handles.at(-1);
    return Boolean(handle && handle.instanceId !== first.instanceId && handle.state === "active" && handle.candidates.length === 2);
  }, "new renderer handle to render after SPA return");
  const second = lastHandle(remounted);
  assertNativeExecutionWhenRequired(second);
  expect(second.generation).not.toBe(first.generation);
  expect(second.instanceId).not.toBe(first.instanceId);
  expect(second.runtime?.executionBackend).toBe(first.runtime?.executionBackend);
  expect(second.candidates.some((candidate) => candidate.samples.some((sample) => sample.id === "canonical-near-side"))).toBe(true);

  const finalDiagnostics = await navigateAwayAndWait(page, second.instanceId);
  expect(finalDiagnostics.documentId).toBe(firstDocumentId);
  expect(allOwnedResourcesDisposed(handleById(finalDiagnostics, first.instanceId)!)).toBe(true);
  expect(allOwnedResourcesDisposed(handleById(finalDiagnostics, second.instanceId)!)).toBe(true);
  await testInfo.attach("native-lifecycle-success.json", {
    body: Buffer.from(JSON.stringify({
      documentId: finalDiagnostics.documentId,
      route: finalDiagnostics.route,
      handles: [first.instanceId, second.instanceId].map((instanceId) => {
        const handle = handleById(finalDiagnostics, instanceId)!;
        return {
          instanceId: handle.instanceId,
          generation: handle.generation,
          state: handle.state,
          runtime: handle.runtime,
          cleanupStartedAt: handle.cleanupStartedAt,
          cleanupCompletedAt: handle.cleanupCompletedAt,
          cleanupError: handle.cleanupError,
          operations: handle.operations,
          resources: handle.resources,
        };
      }),
    }, null, 2)),
    contentType: "application/json",
  });
});

test("a rejected accepted readback remains a failure while SPA cleanup succeeds", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.goto(FIXTURE_PATH);
  const ready = await waitForDiagnostics(page, (diagnostics) => {
    const handle = diagnostics.handles.at(-1);
    return Boolean(diagnostics.status === "ready" && handle?.state === "active" && handle.candidates.length === 2);
  }, "native handle to initialize before injected readback rejection");
  const handle = lastHandle(ready);
  assertNativeExecutionWhenRequired(handle);

  await page.getByRole("button", { name: "Start held readback" }).click();
  await waitForDiagnostics(page, (diagnostics) => {
    const operation = latestOperation(handleById(diagnostics, handle.instanceId)!, "held-readback");
    return Boolean(operation?.state === "running" && operation.stage === "readback-settled-held" && operation.readbackOutcome === "succeeded");
  }, "actual native readback to settle before failure injection");

  await page.getByTestId("coc-storage-nav-away").click();
  await expect(page).toHaveURL(/#\/away$/);
  await waitForDiagnostics(page, (diagnostics) => handleById(diagnostics, handle.instanceId)?.state === "retiring", "handle to retire before readback rejection");
  await page.getByTestId("coc-storage-reject-readback").click();

  const failed = await waitForDiagnostics(page, (diagnostics) => handleById(diagnostics, handle.instanceId)?.state === "disposed", "cleanup after injected readback rejection");
  const retired = handleById(failed, handle.instanceId)!;
  const operation = latestOperation(retired, "held-readback");
  expect(operation?.state).toBe("failed");
  expect(operation?.stage).toBe("readback-failed");
  expect(operation?.failureClassification).toBe("readback");
  expect(operation?.readbackOutcome).toBe("failed");
  expect(operation?.error).toBe("Injected test-only rejection of the accepted WebGPU readback Promise");
  expect(operation?.readbackError).toBe(operation?.error);
  expect(successfulStaleReadback(operation)).toBe(false);
  expect(allOwnedResourcesDisposed(retired)).toBe(true);

  await page.getByTestId("coc-storage-nav-experiment").click();
  const remount = await waitForDiagnostics(page, (diagnostics) => {
    const latest = diagnostics.handles.at(-1);
    return Boolean(latest && latest.instanceId !== handle.instanceId && latest.state === "active" && latest.candidates.length === 2);
  }, "new generation to render after rejected readback");
  assertNativeExecutionWhenRequired(lastHandle(remount));
  await testInfo.attach("native-lifecycle-readback-rejection.json", {
    body: Buffer.from(JSON.stringify({
      documentId: failed.documentId,
      route: failed.route,
      retiredHandle: {
        instanceId: retired.instanceId,
        generation: retired.generation,
        state: retired.state,
        runtime: retired.runtime,
        cleanupStartedAt: retired.cleanupStartedAt,
        cleanupCompletedAt: retired.cleanupCompletedAt,
        cleanupError: retired.cleanupError,
        operations: retired.operations,
        resources: retired.resources,
      },
      remountedHandle: {
        instanceId: lastHandle(remount).instanceId,
        generation: lastHandle(remount).generation,
        state: lastHandle(remount).state,
        runtime: lastHandle(remount).runtime,
      },
    }, null, 2)),
    contentType: "application/json",
  });
});

test("post-writer failure is explicit and does not prevent resource cleanup", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE_PATH);
  const ready = await waitForDiagnostics(page, (diagnostics) => {
    const handle = diagnostics.handles.at(-1);
    return Boolean(diagnostics.status === "ready" && handle?.state === "active" && handle.candidates.length === 2);
  }, "handle to complete successful storage comparisons");
  const handle = lastHandle(ready);
  assertNativeExecutionWhenRequired(handle);
  await page.getByRole("button", { name: "Inject writer failure" }).click();
  const failedOperation = await waitForDiagnostics(page, (diagnostics) => {
    const operation = latestOperation(handleById(diagnostics, handle.instanceId)!, "injected-failure");
    return operation?.state === "failed" && operation.writerCompleted;
  }, "test-only post-writer failure to be recorded");
  const operation = latestOperation(handleById(failedOperation, handle.instanceId)!, "injected-failure");
  expect(operation?.failureClassification).toBe("execution");
  expect(operation?.stage).toBe("operation-failed");
  expect(operation?.error).toBe("Injected Phase D failure after native numeric writer pass");

  const disposedDiagnostics = await navigateAwayAndWait(page, handle.instanceId);
  expect(allOwnedResourcesDisposed(handleById(disposedDiagnostics, handle.instanceId)!)).toBe(true);
});
