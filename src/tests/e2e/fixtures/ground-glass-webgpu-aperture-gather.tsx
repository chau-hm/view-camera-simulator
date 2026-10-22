/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import type Node from "three/src/nodes/core/Node.js";
import {
  Loop,
  abs,
  atan,
  clamp,
  cos,
  cross,
  dot,
  float,
  exp,
  floor,
  fract,
  Fn,
  getViewPosition,
  int,
  length,
  max,
  min,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { getRenderQualitySettings } from "../../../render/renderQuality";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../../render/ArchitectureRiseSubjectFactory";
import {
  createInteriorCornerGroup,
  disposeInteriorCornerGroup,
} from "../../../render/InteriorCornerSubjectFactory";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../../scenes/presentation/architectureRise";
import { INTERIOR_CORNER_PRESENTATION } from "../../../scenes/presentation/interiorCorner";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";
import {
  APERTURE_GATHER_CASES,
  clampPixelEllipse,
  goldenAngleDiskSample,
  mapPhysicalEllipseToSourcePixels,
  maximumPixelEllipseRadius,
  orientedSampleOffsetPx,
  type GatherReferenceProbe,
  type SourceDimensions,
} from "./ground-glass-webgpu-aperture-gather-cases";
import {
  createSourceToGatherPixelCenterLookup,
  estimateGatherTargetMemory,
  gatherTexelAtSourcePixelCenter,
} from "./ground-glass-webgpu-gather-quality-cases";
import {
  auditCompatibleFarNeighbors,
  compareRadialEnergyProfiles,
  compareRgba,
  compareRgbaOnMask,
  compositeFarAndNear,
  gatherTexelForSourcePixelCenter,
  measureFarSignalMetrics,
  phaseIFarDepthToleranceMm,
  phaseISpatialWeight,
  reconstructFarToSourceGrid,
  reconstructSurfaceAwareFar,
  referenceFarGatherTarget,
  sourcePixelAtGatherPixelCenter,
} from "./ground-glass-webgpu-far-reconstruction-cases";

const WIDTH = APERTURE_GATHER_CASES.sourceWidthPx;
const HEIGHT = APERTURE_GATHER_CASES.sourceHeightPx;
const phaseGStudyEnabled = new URLSearchParams(window.location.search).get("phaseG") === "1";
const phaseIStudyEnabled = new URLSearchParams(window.location.search).get("phaseI") === "1";
const phaseHStudyEnabled = phaseIStudyEnabled || new URLSearchParams(window.location.search).get("phaseH") === "1";
const phaseResearchEnabled = phaseGStudyEnabled || phaseHStudyEnabled;
const CHANGE_EVENT = "ground-glass-webgpu-aperture-gather-change";
const GOLDEN_ANGLE = APERTURE_GATHER_CASES.goldenAngleRad;
type FailureStage = "physical-coc" | "far-gather" | "near-gather" | "composite" | "far-reconstruction" | "readback";
type QualityMode = "standard" | "low" | "stress-64" | "study";
type StudyScene = "phase-f-controlled" | "architecture-rise-geometry-proxy" | "interior-corner-geometry-proxy";
type PhaseHEdgeCase = "axis-aligned" | "vertical" | "diagonal" | "thin" | "multiple-far-depths";
type PhaseIBenchmarkVariant = "B0" | "B1" | "C1";
type StageTiming = {
  stage: string;
  cpuSubmissionTimeMs: number;
  observedQueueCompletionMs: number | null;
  queueWaitAfterSubmissionMs: number | null;
};
type OperationTiming = {
  operationWallTimeMs: number;
  readbackWallTimeMs: number | null;
  renderTargetResizeWallTimeMs: number;
  stages: StageTiming[];
  gpuTimestampDurationMs: null;
};
type ResourceEvidence = {
  id: string;
  role: string;
  allocation: "allocated";
  state: "active" | "disposal-requested" | "disposed" | "failed";
  error: string | null;
};
type OperationEvidence = {
  operationId: string;
  kind: "initial-render" | "render" | "held-readback" | "injected-failure";
  state: "accepted" | "running" | "completed" | "failed" | "retired";
  stage: string;
  acceptedAt: number;
  completedAt: number | null;
  resultPublished: boolean;
  readbackStarted: boolean;
  readbackOutcome: "not-started" | "pending" | "succeeded" | "failed";
  error: string | null;
  appliedState: {
    reconstructionVariant: "B0" | "B1" | "C1";
    scene: StudyScene;
    edgeCase: PhaseHEdgeCase;
    filmTiltDeg: number;
    filmNormal: [number, number, number];
    filmBasisX: [number, number, number];
    filmBasisY: [number, number, number];
    crop: boolean;
    cameraView: null | { enabled: boolean; fullWidth: number; fullHeight: number; offsetX: number; offsetY: number; width: number; height: number };
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
    apertureFNumber: number;
    sourceWidthPx: number;
    sourceHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    gatherScale: number;
    quality: QualityMode;
    sampleCount: number;
    maximumCoCRadiusPx: number;
    forceUnresolved: boolean;
  } | null;
  timing: OperationTiming | null;
};
type FixtureHandleEvidence = {
  instanceId: string;
  generation: number;
  state: "initializing" | "active" | "retiring" | "disposed" | "failed";
  runtime: {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
  } | null;
  dimensions: {
    sourceWidthPx: number;
    sourceHeightPx: number;
    physicalCocWidthPx: number;
    physicalCocHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    nearGatherWidthPx: number;
    nearGatherHeightPx: number;
    compositeWidthPx: number;
    compositeHeightPx: number;
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
    quality: QualityMode;
    sampleCount: number;
    maximumCoCRadiusPx: number;
    gatherScale: number;
    scene: StudyScene;
  } | null;
  formats: Record<string, { requested: string; actual: string | null }> | null;
  passes: Array<{ id: string; state: "completed" | "failed"; error: string | null }>;
  metrics: {
    rawRedPixelCount: number;
    compositeRedPixelCount: number;
    nearSpreadPixelGain: number;
    rawYellowPixelCount: number;
    compositeYellowPixelCount: number;
    farSpreadPixelGain: number;
    farYellowSignalOutsideBluePixelCount: number;
    farYellowSignalOutsideBlueEnergy: number;
    nearRedSpreadOutsideSharpPixelCount: number;
    nearBlueBackgroundLeakPixelCount: number;
    farRedForegroundLeakPixelCount: number;
    farRedForegroundLeakEnergy: number;
    farNativeTargetRedForegroundLeakPixelCount: number;
    farNativeTargetRedForegroundLeakEnergy: number;
    compositeRedForegroundLeakPixelCount: number;
    compositeRedForegroundLeakEnergy: number;
    blueBackgroundPixelCount: number;
    farRedForegroundLeakFraction: number;
    meanFarLeakDistanceToForegroundPx: number;
    maximumFarLeakDistanceToForegroundPx: number;
    nonzeroNearAlphaPixels: number;
    validPhysicalPixelCount: number;
    noDepthPixelCount: number;
    invalidPhysicalPixelCount: number;
    unresolvedPixelCount: number;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    maximumAbsSignedCoCMm: number;
    maximumPhysicalAxisMm: number;
  } | null;
  pointProbes: Array<{
    id: string;
    worldPointM: [number, number, number];
    pixelTopOrigin: { x: number; y: number };
    pixelReadbackOrigin: "top" | "bottom";
    gpuDepth: number;
    worldPositionMm: [number, number, number];
    physicalRgba16Float: [number, number, number, number];
    sourceColor: [number, number, number];
    farGatherRgba: [number, number, number, number];
    nearGatherRgba: [number, number, number, number];
    compositeColor: [number, number, number];
    validityCode: number;
  }>;
  gatherReferenceProbes: GatherReferenceProbe[];
  unresolvedSample: null | {
    validityCode: number;
    storedFootprint: [number, number, number, number];
    sourceColor: [number, number, number];
    farGather: [number, number, number, number];
    nearGather: [number, number, number, number];
  };
  sampleDiagnostics: null | {
    referencePixelRole: "far-gather-probe" | "center-pixel-fallback";
    pixelReadbackIndex: number;
    physicalMajorRadiusMm: number;
    physicalMinorRadiusMm: number;
    physicalOrientationRad: number;
    pixelMajorVectorPx: [number, number];
    pixelMinorVectorPx: [number, number];
    cpuReference: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
      firstApertureProposal: [number, number];
      firstTransformedFarSampleOffsetPx: [number, number];
      sampleCount: number;
    };
    gpu: {
      maximumTransformedEllipseRadiusPx: number;
      rendererMaximumRadiusPx: number;
      clampScale: number;
      maximumClampedEllipseRadiusPx: number;
    };
  };
  operations: OperationEvidence[];
  targetResizeCount: number;
  sceneProvenance: {
    scenarioId: StudyScene;
    geometrySource: string;
    placementAdaptation: "none" | "uniform-scale-and-recenter";
    proxyScale: number;
    canonicalOpticsReused: boolean;
  } | null;
  targetMemoryEstimate: {
    sourcePixels: number;
    gatherPixels: number;
    estimatedBytes: number;
    estimatedMiB: number;
    includes: string[];
  } | null;
  phaseH: Record<string, unknown> | null;
  phaseI: Record<string, unknown> | null;
  resources: ResourceEvidence[];
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type MountedHandle = {
  evidence: FixtureHandleEvidence;
  render: (input?: {
    quality?: QualityMode;
    apertureFNumber?: number;
    filmTiltDeg?: number;
    focusOffsetMm?: number;
    crop?: boolean;
    forceUnresolved?: boolean;
    gatherScale?: number;
    sampleCount?: number;
    maximumCoCRadiusPx?: number;
    sourceWidthPx?: number;
    sourceHeightPx?: number;
    scene?: StudyScene;
    candidate?: boolean;
    displayCandidate?: boolean;
    phaseI?: boolean;
    displayPhaseI?: boolean;
    edgeCase?: PhaseHEdgeCase;
  }) => Promise<string>;
  startHeldReadback: () => string;
  injectFailure: (stage: FailureStage) => Promise<string>;
  dispose: () => Promise<void>;
};
type FixtureStore = {
  revision: number;
  nextGeneration: number;
  handles: FixtureHandleEvidence[];
  activeHandleId: string | null;
  status: string;
  releaseReadback: (() => void) | null;
};
type WindowWithFixtureStore = Window & {
  __groundGlassWebGpuApertureGather?: FixtureStore;
  __groundGlassWebGpuFarReconstructionImages?: Record<string, string>;
};
const store = (window as WindowWithFixtureStore).__groundGlassWebGpuApertureGather ??= {
  revision: 0,
  nextGeneration: 1,
  handles: [],
  activeHandleId: null,
  status: "idle",
  releaseReadback: null,
};
const phaseIImageArtifacts = (window as WindowWithFixtureStore).__groundGlassWebGpuFarReconstructionImages ??= {};

const linearToSrgbByte = (value: number) => {
  const linear = Math.min(1, Math.max(0, value));
  const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
};

const rgbaToPngDataUrl = (rgba: Float32Array, width: number, height: number, scale = 1) => {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Phase I image evidence requires a 2D canvas context");
  const image = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    image.data[index * 4] = linearToSrgbByte(rgba[index * 4] ?? 0);
    image.data[index * 4 + 1] = linearToSrgbByte(rgba[index * 4 + 1] ?? 0);
    image.data[index * 4 + 2] = linearToSrgbByte(rgba[index * 4 + 2] ?? 0);
    image.data[index * 4 + 3] = 255;
  }
  if (scale === 1) context.putImageData(image, 0, 0);
  else {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    sourceCanvas.getContext("2d")!.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(sourceCanvas, 0, 0, width * scale, height * scale);
  }
  return canvas.toDataURL("image/png");
};

const cropRgbaToPngDataUrl = (
  rgba: Float32Array,
  width: number,
  height: number,
  crop: { x: number; y: number; width: number; height: number },
  scale = 4,
) => {
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) throw new Error("Phase I edge evidence requires a 2D canvas context");
  const image = sourceContext.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    image.data[index * 4] = linearToSrgbByte(rgba[index * 4] ?? 0);
    image.data[index * 4 + 1] = linearToSrgbByte(rgba[index * 4 + 1] ?? 0);
    image.data[index * 4 + 2] = linearToSrgbByte(rgba[index * 4 + 2] ?? 0);
    image.data[index * 4 + 3] = 255;
  }
  sourceContext.putImageData(image, 0, 0);
  const output = document.createElement("canvas");
  output.width = crop.width * scale;
  output.height = crop.height * scale;
  const context = output.getContext("2d");
  if (!context) throw new Error("Phase I edge evidence requires a 2D canvas context");
  context.imageSmoothingEnabled = false;
  context.drawImage(sourceCanvas, crop.x, crop.y, crop.width, crop.height, 0, 0, output.width, output.height);
  return output.toDataURL("image/png");
};

const differenceToPngDataUrl = (expected: Float32Array, actual: Float32Array, width: number, height: number) => {
  const image = new Float32Array(width * height * 4);
  const scale = 0.25;
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const difference = Math.max(
      Math.abs((expected[offset] ?? 0) - (actual[offset] ?? 0)),
      Math.abs((expected[offset + 1] ?? 0) - (actual[offset + 1] ?? 0)),
      Math.abs((expected[offset + 2] ?? 0) - (actual[offset + 2] ?? 0)),
    );
    const normalized = Math.min(1, difference / scale);
    image[offset] = normalized;
    image[offset + 1] = 1 - normalized;
    image[offset + 2] = 0;
    image[offset + 3] = 1;
  }
  return rgbaToPngDataUrl(image, width, height);
};

const signalToPngDataUrl = (rgba: Float32Array, roiMask: Uint8Array, width: number, height: number) => {
  const image = new Float32Array(width * height * 4);
  const signalCap = 0.5;
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const signal = roiMask[index] === 1
      ? Math.max(0,
        ((rgba[offset] ?? 0) - 0.025) * 0.925
        + ((rgba[offset + 1] ?? 0) - 0.08) * 0.54
        - ((rgba[offset + 2] ?? 0) - 0.85) * 0.825,
      )
      : 0;
    const amount = Math.min(1, signal / signalCap);
    image[offset] = amount;
    image[offset + 1] = amount * 0.8;
    image[offset + 2] = 0;
    image[offset + 3] = 1;
  }
  return rgbaToPngDataUrl(image, width, height);
};

const nearAlphaToPngDataUrl = (near: Float32Array, source: SourceDimensions, gather: SourceDimensions) => {
  const expanded = new Float32Array(source.widthPx * source.heightPx * 4);
  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const gx = Math.min(gather.widthPx - 1, Math.floor((x + 0.5) * gather.widthPx / source.widthPx));
      const gy = Math.min(gather.heightPx - 1, Math.floor((y + 0.5) * gather.heightPx / source.heightPx));
      const alpha = near[(gy * gather.widthPx + gx) * 4 + 3] ?? 0;
      const offset = (y * source.widthPx + x) * 4;
      expanded[offset] = alpha;
      expanded[offset + 1] = alpha;
      expanded[offset + 2] = alpha;
      expanded[offset + 3] = 1;
    }
  }
  return rgbaToPngDataUrl(expanded, source.widthPx, source.heightPx);
};
const signal = () => {
  store.revision += 1;
  window.dispatchEvent(new Event(CHANGE_EVENT));
};
const subscribeToFixture = (callback: () => void) => {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
};
const getFixtureRevision = () => store.revision;
const useDiagnosticsVersion = () => useSyncExternalStore(subscribeToFixture, getFixtureRevision, getFixtureRevision);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const half = (data: Uint16Array, index: number) => THREE.DataUtils.fromHalfFloat(data[index] ?? 0);
const countColor = (data: Uint16Array, predicate: (r: number, g: number, b: number) => boolean) => {
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (predicate(half(data, offset), half(data, offset + 1), half(data, offset + 2))) count += 1;
  }
  return count;
};

const toTopOriginRgba = (
  data: Uint16Array | Float32Array,
  width: number,
  height: number,
  readbackOrigin: "top" | "bottom",
  isHalfFloat: boolean,
) => {
  const result = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const readbackY = readbackOrigin === "top" ? y : height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (readbackY * width + x) * 4;
      const destinationOffset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const value = data[sourceOffset + channel] ?? 0;
        result[destinationOffset + channel] = isHalfFloat && data instanceof Uint16Array
          ? THREE.DataUtils.fromHalfFloat(value)
          : value;
      }
    }
  }
  return result;
};

const toTopOriginValidity = (
  data: Uint8Array,
  width: number,
  height: number,
  readbackOrigin: "top" | "bottom",
) => {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const readbackY = readbackOrigin === "top" ? y : height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      result[y * width + x] = data[(readbackY * width + x) * 4] ?? 0;
    }
  }
  return result;
};

const buildPhaseHDiagnostics = (input: {
  source: { widthPx: number; heightPx: number };
  gather: { widthPx: number; heightPx: number };
  film: { widthMm: number; heightMm: number };
  sampleCount: number;
  maximumCoCRadiusPx: number;
  cameraZMm: number;
  edgeCase: PhaseHEdgeCase;
  readbackOrigin: "top" | "bottom";
  colorsRaw: Uint16Array;
  physicalRaw: Uint16Array;
  validityRaw: Uint8Array;
  worldRaw: Float32Array;
  farRaw: Uint16Array;
  nearRaw: Uint16Array;
  compositeRaw: Uint16Array;
  sourceIdentityRaw: Float32Array;
  gatherProvenanceRaw: Float32Array;
  selectedProvenanceRaw: Float32Array;
  candidateFarRaw: Uint16Array | null;
  candidateCompositeRaw: Uint16Array | null;
  phaseICandidateFarRaw: Uint16Array | null;
  phaseICandidateCompositeRaw: Uint16Array | null;
  phaseIEnabled: boolean;
  phaseIReferenceFarRasters: Map<string, Float32Array>;
  apertureFNumber: number;
  filmTiltDeg: number;
  focusOffsetMm: number;
  crop: boolean;
  scene: StudyScene;
  stageTimings: StageTiming[];
}) => {
  const { source, gather, readbackOrigin } = input;
  const colors = toTopOriginRgba(input.colorsRaw, source.widthPx, source.heightPx, readbackOrigin, true);
  const physical = toTopOriginRgba(input.physicalRaw, source.widthPx, source.heightPx, readbackOrigin, true);
  const validity = toTopOriginValidity(input.validityRaw, source.widthPx, source.heightPx, readbackOrigin);
  const worldAndDepth = toTopOriginRgba(input.worldRaw, source.widthPx, source.heightPx, readbackOrigin, false);
  const farNative = toTopOriginRgba(input.farRaw, gather.widthPx, gather.heightPx, readbackOrigin, true);
  const near = toTopOriginRgba(input.nearRaw, gather.widthPx, gather.heightPx, readbackOrigin, true);
  const compositeNative = toTopOriginRgba(input.compositeRaw, source.widthPx, source.heightPx, readbackOrigin, true);
  const sourceIdentity = toTopOriginRgba(input.sourceIdentityRaw, source.widthPx, source.heightPx, readbackOrigin, false);
  const gatherProvenance = toTopOriginRgba(input.gatherProvenanceRaw, gather.widthPx, gather.heightPx, readbackOrigin, false);
  const selectedProvenance = toTopOriginRgba(input.selectedProvenanceRaw, source.widthPx, source.heightPx, readbackOrigin, false);
  const candidateFar = input.candidateFarRaw
    ? toTopOriginRgba(input.candidateFarRaw, source.widthPx, source.heightPx, readbackOrigin, true)
    : null;
  const candidateComposite = input.candidateCompositeRaw
    ? toTopOriginRgba(input.candidateCompositeRaw, source.widthPx, source.heightPx, readbackOrigin, true)
    : null;
  const phaseICandidateFar = input.phaseICandidateFarRaw
    ? toTopOriginRgba(input.phaseICandidateFarRaw, source.widthPx, source.heightPx, readbackOrigin, true)
    : null;
  const phaseICandidateComposite = input.phaseICandidateCompositeRaw
    ? toTopOriginRgba(input.phaseICandidateCompositeRaw, source.widthPx, source.heightPx, readbackOrigin, true)
    : null;
  const pixelCount = source.widthPx * source.heightPx;
  const gatherPixelCount = gather.widthPx * gather.heightPx;
  const identityMismatch = {
    source: 0,
    gatherCoordinates: 0,
    gatherCenterFormula: 0,
    gatherCenterOutOfBounds: 0,
    selectedGatherFormula: 0,
    selectedCenterProvenance: 0,
    selectedGatherOutOfBounds: 0,
  };
  const observedGatherCenterPixels = new Int16Array(gatherPixelCount * 2);
  const selectedGatherPixels = new Uint16Array(pixelCount * 2);
  const samplingExamples: Array<Record<string, unknown>> = [];
  const gatherMismatchExamples: Array<Record<string, unknown>> = [];
  const compositeMismatchExamples: Array<Record<string, unknown>> = [];
  let gatherCenterMaximumDeviationPx = 0;

  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const sourceIndex = y * source.widthPx + x;
      const offset = sourceIndex * 4;
      if (sourceIdentity[offset] !== x || sourceIdentity[offset + 1] !== y) identityMismatch.source += 1;
      const expectedGather = gatherTexelForSourcePixelCenter([x, y], source, gather);
      const selectedGatherX = selectedProvenance[offset] ?? -1;
      const selectedGatherY = selectedProvenance[offset + 1] ?? -1;
      const selectedCenterX = selectedProvenance[offset + 2] ?? -1;
      const selectedCenterY = selectedProvenance[offset + 3] ?? -1;
      const inBounds = Number.isInteger(selectedGatherX) && Number.isInteger(selectedGatherY)
        && selectedGatherX >= 0 && selectedGatherX < gather.widthPx
        && selectedGatherY >= 0 && selectedGatherY < gather.heightPx;
      if (!inBounds) identityMismatch.selectedGatherOutOfBounds += 1;
      else {
        const gatherOffset = (selectedGatherY * gather.widthPx + selectedGatherX) * 4;
        if (gatherProvenance[gatherOffset + 2] !== selectedCenterX
            || gatherProvenance[gatherOffset + 3] !== selectedCenterY) {
          identityMismatch.selectedCenterProvenance += 1;
        }
        selectedGatherPixels[sourceIndex * 2] = selectedGatherX;
        selectedGatherPixels[sourceIndex * 2 + 1] = selectedGatherY;
      }
      if (selectedGatherX !== expectedGather[0] || selectedGatherY !== expectedGather[1]) {
        identityMismatch.selectedGatherFormula += 1;
        if (compositeMismatchExamples.length < 12) compositeMismatchExamples.push({
          sourcePixel: [x, y],
          actual: Array.from(selectedProvenance.subarray(offset, offset + 4)),
          expectedGather,
          centerIdMatchesSelectedGather: inBounds
            && gatherProvenance[(selectedGatherY * gather.widthPx + selectedGatherX) * 4 + 2] === selectedCenterX
            && gatherProvenance[(selectedGatherY * gather.widthPx + selectedGatherX) * 4 + 3] === selectedCenterY,
        });
      }
    }
  }
  for (let y = 0; y < gather.heightPx; y += 1) {
    for (let x = 0; x < gather.widthPx; x += 1) {
      const index = (y * gather.widthPx + x) * 4;
      const expectedCenter = sourcePixelAtGatherPixelCenter([x, y], gather, source);
      const actualCenterX = gatherProvenance[index + 2] ?? -1;
      const actualCenterY = gatherProvenance[index + 3] ?? -1;
      const centerInBounds = Number.isInteger(actualCenterX) && Number.isInteger(actualCenterY)
        && actualCenterX >= 0 && actualCenterX < source.widthPx
        && actualCenterY >= 0 && actualCenterY < source.heightPx;
      if (!centerInBounds) identityMismatch.gatherCenterOutOfBounds += 1;
      const deltaX = actualCenterX - expectedCenter[0];
      const deltaY = actualCenterY - expectedCenter[1];
      gatherCenterMaximumDeviationPx = Math.max(gatherCenterMaximumDeviationPx, Math.abs(deltaX), Math.abs(deltaY));
      if (actualCenterX !== expectedCenter[0] || actualCenterY !== expectedCenter[1]) {
        identityMismatch.gatherCenterFormula += 1;
        if (gatherMismatchExamples.length < 12) gatherMismatchExamples.push({
          gatherPixel: [x, y],
          actual: Array.from(gatherProvenance.subarray(index, index + 4)),
          expectedGather: [x, y],
          expectedCenter,
          deltaFromNominal: [deltaX, deltaY],
        });
      }
      if (gatherProvenance[index] !== x || gatherProvenance[index + 1] !== y) identityMismatch.gatherCoordinates += 1;
      observedGatherCenterPixels[(y * gather.widthPx + x) * 2] = actualCenterX;
      observedGatherCenterPixels[(y * gather.widthPx + x) * 2 + 1] = actualCenterY;
    }
  }
  const samplingPoints = ([
    [0, 0], [1, 1], [31, 47], [63, 47], [64, 48], [source.widthPx - 1, source.heightPx - 1],
  ] as const).filter(([x, y]) => x < source.widthPx && y < source.heightPx);
  for (const [x, y] of samplingPoints) {
    const offset = (y * source.widthPx + x) * 4;
    samplingExamples.push({
      sourcePixel: [x, y],
      sourcePixelCenterUvTop: [(x + 0.5) / source.widthPx, (y + 0.5) / source.heightPx],
      actualGpuSelectedGather: [selectedProvenance[offset], selectedProvenance[offset + 1]],
      actualGatherCenterSourcePixel: [selectedProvenance[offset + 2], selectedProvenance[offset + 3]],
      cpuSelectedGather: gatherTexelForSourcePixelCenter([x, y], source, gather),
      cpuGatherCenterSourcePixel: sourcePixelAtGatherPixelCenter(gatherTexelForSourcePixelCenter([x, y], source, gather), gather, source),
      gpuObservedGatherCenterSourcePixel: [
        gatherProvenance[(selectedProvenance[offset + 1]! * gather.widthPx + selectedProvenance[offset]!) * 4 + 2],
        gatherProvenance[(selectedProvenance[offset + 1]! * gather.widthPx + selectedProvenance[offset]!) * 4 + 3],
      ],
    });
  }

  const cpuGather = referenceFarGatherTarget({
    source,
    gather,
    film: input.film,
    sampleCount: input.sampleCount,
    maximumCoCRadiusPx: input.maximumCoCRadiusPx,
    cameraZMm: input.cameraZMm,
    colors,
    physical,
    validity,
    worldAndDepth,
    centerSourcePixels: observedGatherCenterPixels,
  });
  const gatherComparison = compareRgba(cpuGather.rgba, farNative);
  const nativeFarReconstruction = reconstructFarToSourceGrid({
    source,
    gather,
    gatherFar: farNative,
    colors,
    physical,
    validity,
    selectedGatherPixels,
    centerSourcePixels: observedGatherCenterPixels,
  });
  const baselineCompositeReference = compositeFarAndNear(nativeFarReconstruction.baselineFar, (() => {
    const nearFullResolution = new Float32Array(pixelCount * 4);
    for (let y = 0; y < source.heightPx; y += 1) {
      for (let x = 0; x < source.widthPx; x += 1) {
        const sourceIndex = y * source.widthPx + x;
        const gx = selectedGatherPixels[sourceIndex * 2]!;
        const gy = selectedGatherPixels[sourceIndex * 2 + 1]!;
        const gatherOffset = (gy * gather.widthPx + gx) * 4;
        nearFullResolution.set(near.subarray(gatherOffset, gatherOffset + 4), sourceIndex * 4);
      }
    }
    return nearFullResolution;
  })());
  const reconstructionComparison = compareRgba(baselineCompositeReference, compositeNative);

  const sourceIsRed = (offset: number) => {
    const r = colors[offset] ?? 0;
    const g = colors[offset + 1] ?? 0;
    const b = colors[offset + 2] ?? 0;
    return r > 0.5 && g < 0.12 && b < 0.12;
  };
  const sourceIsBlue = (offset: number) => {
    const r = colors[offset] ?? 0;
    const g = colors[offset + 1] ?? 0;
    const b = colors[offset + 2] ?? 0;
    return b > 0.5 && r < 0.15 && g < 0.2;
  };
  const isRed = (data: Float32Array, offset: number) =>
    (data[offset] ?? 0) > 0.5 && (data[offset + 1] ?? 0) < 0.12 && (data[offset + 2] ?? 0) < 0.12;
  const isGreen = (data: Float32Array, offset: number) =>
    (data[offset + 1] ?? 0) > 0.5 && (data[offset] ?? 0) < 0.15 && (data[offset + 2] ?? 0) < 0.2;
  const phaseI = input.phaseIEnabled ? (() => {
    const blueRoiMask = new Uint8Array(pixelCount);
    const nearForegroundMask = new Uint8Array(pixelCount);
    const focusMask = new Uint8Array(pixelCount);
    const featureMask = new Uint8Array(pixelCount);
    let featureX = 0;
    let featureY = 0;
    let featurePixelCount = 0;
    for (let index = 0; index < pixelCount; index += 1) {
      const offset = index * 4;
      blueRoiMask[index] = sourceIsBlue(offset) ? 1 : 0;
      nearForegroundMask[index] = sourceIsRed(offset) ? 1 : 0;
      focusMask[index] = isGreen(colors, offset) ? 1 : 0;
      const yellowFeature = (colors[offset] ?? 0) > 0.8
        && (colors[offset + 1] ?? 0) > 0.4
        && (colors[offset + 2] ?? 0) < 0.12;
      featureMask[index] = yellowFeature ? 1 : 0;
      if (yellowFeature) {
        featureX += index % source.widthPx;
        featureY += Math.floor(index / source.widthPx);
        featurePixelCount += 1;
      }
    }
    const featureCenterPx: [number, number] = featurePixelCount > 0
      ? [featureX / featurePixelCount, featureY / featurePixelCount]
      : [source.widthPx * 0.5, source.heightPx * 0.5];
    const edgeMask = new Uint8Array(pixelCount);
    for (let y = 0; y < source.heightPx; y += 1) {
      for (let x = 0; x < source.widthPx; x += 1) {
        const index = y * source.widthPx + x;
        let edge = nearForegroundMask[index] === 1;
        for (let dy = -1; dy <= 1 && !edge; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < source.widthPx && ny >= 0 && ny < source.heightPx
                && nearForegroundMask[ny * source.widthPx + nx] === 1) {
              edge = true;
              break;
            }
          }
        }
        edgeMask[index] = edge ? 1 : 0;
      }
    }
    const metricInput = (farRgba: Float32Array) => measureFarSignalMetrics({
      source,
      sourceColors: colors,
      farRgba,
      roiMask: blueRoiMask,
      featureCenterPx,
      backgroundRgb: [0.025, 0.08, 0.85],
      signalWeights: [0.925, 0.54, -0.825],
      threshold: 0.02,
      radialBinWidthPx: 2,
      radialBinCount: 24,
    });
    const cpuFullFar = reconstructFarToSourceGrid({
      source,
      gather,
      gatherFar: cpuGather.rgba,
      colors,
      physical,
      validity,
      selectedGatherPixels,
      centerSourcePixels: observedGatherCenterPixels,
    }).baselineFar;
    const phaseHCompatibleCpu = reconstructFarToSourceGrid({
      source,
      gather,
      gatherFar: cpuGather.rgba,
      colors,
      physical,
      validity,
      selectedGatherPixels,
      centerSourcePixels: observedGatherCenterPixels,
    }).compatibleFar;
    const c1Cpu = reconstructSurfaceAwareFar({
      source,
      gather,
      gatherFar: cpuGather.rgba,
      colors,
      physical,
      validity,
      worldAndDepth,
      selectedGatherPixels,
      centerSourcePixels: observedGatherCenterPixels,
      cameraZMm: input.cameraZMm,
      depthTolerance: phaseIFarDepthToleranceMm,
      spatialWeight: phaseISpatialWeight,
    });
    const allPixelsMask = new Uint8Array(pixelCount).fill(1);
    const referenceComparable = input.scene === "phase-f-controlled"
      && input.apertureFNumber === 2
      && input.filmTiltDeg === 0
      && input.focusOffsetMm === 0
      && !input.crop
      && input.edgeCase === "axis-aligned"
      && source.widthPx === WIDTH
      && source.heightPx === HEIGHT;
    const full32 = referenceComparable ? input.phaseIReferenceFarRasters.get("full-32") ?? null : null;
    const full64 = referenceComparable ? input.phaseIReferenceFarRasters.get("full-64") ?? null : null;
    const full32Signal = full32 ? metricInput(full32) : null;
    const full64Signal = full64 ? metricInput(full64) : null;
    const rasterQuality = (farRgba: Float32Array) => {
      const farSignal = metricInput(farRgba);
      return {
      farSignal,
      radialEnergyProfileAgainstFull32: full32Signal
        ? compareRadialEnergyProfiles(full32Signal, farSignal)
        : null,
      radialEnergyProfileAgainstFull64: full64Signal
        ? compareRadialEnergyProfiles(full64Signal, farSignal)
        : null,
      rgbErrorAgainstFull32: full32 ? compareRgbaOnMask(full32, farRgba, allPixelsMask) : null,
      rgbErrorAgainstFull64: full64 ? compareRgbaOnMask(full64, farRgba, allPixelsMask) : null,
      edgeRgbErrorAgainstFull32: full32 ? compareRgbaOnMask(full32, farRgba, edgeMask) : null,
      focusRgbErrorAgainstSource: compareRgbaOnMask(colors, farRgba, focusMask),
      };
    };
    const b0 = rasterQuality(nativeFarReconstruction.baselineFar);
    const b1Cpu = rasterQuality(phaseHCompatibleCpu);
    const b1Gpu = candidateFar ? rasterQuality(candidateFar) : null;
    const b1 = b1Gpu ?? b1Cpu;
    const c1 = phaseICandidateFar ?? null;
    const c1Quality = c1 ? rasterQuality(c1) : rasterQuality(c1Cpu.rgba);
    const c1CpuComparison = phaseICandidateFar
      ? compareRgba(c1Cpu.rgba, phaseICandidateFar)
      : null;
    const c1PathMismatch = phaseICandidateFar ? (() => {
      let countMismatch = 0;
      let fallbackMismatch = 0;
      let fallbackReasonMismatch = 0;
      let maximumWeightSumError = 0;
      for (let index = 0; index < pixelCount; index += 1) {
        const alpha = phaseICandidateFar[index * 4 + 3] ?? 0;
        const expectedFallback = c1Cpu.fallbackReason[index] ?? 0;
        const actualFallback = alpha <= -1.5 ? 3 : alpha <= -0.5 ? 2 : alpha < 1 ? 1 : 0;
        if (actualFallback !== expectedFallback) fallbackReasonMismatch += 1;
        if (gather.widthPx === source.widthPx && gather.heightPx === source.heightPx) {
          if (alpha > -1.5) fallbackMismatch += 1;
          continue;
        }
        if ((physical[index * 4] ?? 0) <= 0.00001 || validity[index] !== 1) {
          if (alpha > -0.5) fallbackMismatch += 1;
        } else {
          if (alpha < -0.5) fallbackMismatch += 1;
          else {
            const actualCount = Math.floor(alpha + 1e-4);
            if (actualCount !== (c1Cpu.acceptedNeighborCount[index] ?? 0)) countMismatch += 1;
            const actualWeightSum = (alpha - actualCount) * 10;
            maximumWeightSumError = Math.max(maximumWeightSumError,
              Math.abs(actualWeightSum - (c1Cpu.acceptedWeightSum[index] ?? 0)));
          }
        }
        if (expectedFallback === 1 && alpha < -0.5) fallbackMismatch += 1;
      }
      return { countMismatch, fallbackMismatch, fallbackReasonMismatch, maximumWeightSumError };
    })() : null;
    const candidateLeakage = (farRgba: Float32Array) => {
      let pixels = 0;
      let energy = 0;
      for (let index = 0; index < pixelCount; index += 1) {
        if (blueRoiMask[index] !== 1) continue;
        const offset = index * 4;
        const red = farRgba[offset] ?? 0;
        if (red > 0.5 && (farRgba[offset + 1] ?? 0) < 0.12 && (farRgba[offset + 2] ?? 0) < 0.12) {
          pixels += 1;
          energy += Math.max(0, red - (colors[offset] ?? 0));
        }
      }
      return { farRedLeakPixels: pixels, farRedLeakEnergy: energy };
    };
    const coverageAudit = auditCompatibleFarNeighbors({
      source,
      gather,
      gatherFar: farNative,
      colors,
      physical,
      validity,
      worldAndDepth,
      selectedGatherPixels,
      centerSourcePixels: observedGatherCenterPixels,
      cameraZMm: input.cameraZMm,
      depthTolerance: phaseIFarDepthToleranceMm,
      spatialWeight: phaseISpatialWeight,
      baselineFar: nativeFarReconstruction.baselineFar,
      blueRoiMask,
      foregroundMask: nearForegroundMask,
    });
    const surfaceDepthAudit = (() => {
      let secondFarSurfacePixelCount = 0;
      let validSecondFarSurfacePixelCount = 0;
      let incompatibleFarNeighborObservationCount = 0;
      let compatibleFarNeighborObservationCount = 0;
      let maximumObservedFarDepthSpanMm = 0;
      const depthGroups = new Set<number>();
      const examples: Array<Record<string, unknown>> = [];
      for (let sourceIndex = 0; sourceIndex < pixelCount; sourceIndex += 1) {
        const sourceOffset = sourceIndex * 4;
        const worldXmm = worldAndDepth[sourceOffset] ?? 0;
        const worldYmm = worldAndDepth[sourceOffset + 1] ?? 0;
        const worldZmm = worldAndDepth[sourceOffset + 2] ?? 0;
        const worldDepth = worldAndDepth[sourceOffset + 3] ?? 1;
        const belongsToSecondFarPlane = worldDepth < 1
        && Math.abs(worldZmm - 620) <= 5
          && worldXmm >= 125 && worldXmm <= 255
          && worldYmm >= -155 && worldYmm <= 95;
        if (!belongsToSecondFarPlane) continue;
        secondFarSurfacePixelCount += 1;
        if (validity[sourceIndex] !== 1 || (physical[sourceOffset] ?? 0) <= 0.00001) continue;
        validSecondFarSurfacePixelCount += 1;
        const sourceX = sourceIndex % source.widthPx;
        const sourceY = Math.floor(sourceIndex / source.widthPx);
        const selectedOffset = sourceIndex * 2;
        const selectedX = selectedGatherPixels[selectedOffset] ?? 0;
        const selectedY = selectedGatherPixels[selectedOffset + 1] ?? 0;
        const destinationDistance = Math.abs((worldAndDepth[sourceOffset + 2] ?? 0) - input.cameraZMm);
        const observedDistances: number[] = [];
        const neighbors: Array<Record<string, unknown>> = [];
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const gx = selectedX + dx;
            const gy = selectedY + dy;
            if (gx < 0 || gx >= gather.widthPx || gy < 0 || gy >= gather.heightPx) continue;
            const centerOffset = (gy * gather.widthPx + gx) * 2;
            const centerX = observedGatherCenterPixels[centerOffset] ?? 0;
            const centerY = observedGatherCenterPixels[centerOffset + 1] ?? 0;
            const centerIndex = centerY * source.widthPx + centerX;
            const neighborOffset = centerIndex * 4;
            const centerDistanceMm = Math.abs((worldAndDepth[neighborOffset + 2] ?? 0) - input.cameraZMm);
            const validFar = validity[centerIndex] === 1
              && (worldAndDepth[neighborOffset + 3] ?? 1) < 1
              && (physical[neighborOffset] ?? 0) > 0.00001;
            if (!validFar) continue;
            observedDistances.push(centerDistanceMm);
            const depthDeltaMm = Math.abs(centerDistanceMm - destinationDistance);
            const depthCompatible = depthDeltaMm <= phaseIFarDepthToleranceMm(destinationDistance);
            if (depthCompatible) compatibleFarNeighborObservationCount += 1;
            else incompatibleFarNeighborObservationCount += 1;
            depthGroups.add(Math.round(centerDistanceMm));
            neighbors.push({
              gatherPixel: [gx, gy],
              centerSourcePixel: [centerX, centerY],
              centerDistanceMm,
              destinationDistanceMm: destinationDistance,
              signedCoCMm: physical[neighborOffset] ?? 0,
              depthDeltaMm,
              toleranceMm: phaseIFarDepthToleranceMm(destinationDistance),
              depthCompatible,
            });
          }
        }
        if (observedDistances.length > 1) {
          maximumObservedFarDepthSpanMm = Math.max(
            maximumObservedFarDepthSpanMm,
            Math.max(...observedDistances) - Math.min(...observedDistances),
          );
        }
        if (examples.length < 12 && neighbors.some((neighbor) => neighbor.depthCompatible === false)) {
          examples.push({ sourcePixel: [sourceX, sourceY], destinationDistanceMm: destinationDistance, neighbors });
        }
      }
      return {
        scene: input.edgeCase,
        targetSurfaceDefinition: "native reconstructed world position lies on the test-only plane centered at [190,-30,620] mm with bounds x=[125,255], y=[-155,95], z=620±5 mm",
        secondFarSurfacePixelCount,
        validSecondFarSurfacePixelCount,
        distinctRoundedFarDepthCount: depthGroups.size,
        incompatibleFarNeighborObservationCount,
        compatibleFarNeighborObservationCount,
        maximumObservedFarDepthSpanMm,
        examples,
      };
    })();
    const leakMaskToPngDataUrl = (farRgba: Float32Array) => {
      const image = new Float32Array(pixelCount * 4);
      for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * 4;
        const redLeak = blueRoiMask[index] === 1
          && (farRgba[offset] ?? 0) > 0.5
          && (farRgba[offset + 1] ?? 0) < 0.12
          && (farRgba[offset + 2] ?? 0) < 0.12;
        if (redLeak) image.set([1, 0.02, 0.02, 1], offset);
        else if (blueRoiMask[index] === 1) image.set([0.02, 0.08, 0.32, 1], offset);
        else image.set([0.08, 0.08, 0.08, 1], offset);
      }
      return rgbaToPngDataUrl(image, source.widthPx, source.heightPx);
    };
    const neighborCoverageToPngDataUrl = () => {
      const image = new Float32Array(pixelCount * 4);
      for (const record of coverageAudit.records) {
        const [x, y] = record.sourcePixel as [number, number];
        const count = record.compatibleNeighborCount as number;
        const offset = (y * source.widthPx + x) * 4;
        const color: [number, number, number, number] = count === 0
          ? [1, 0, 0, 1]
          : count === 1 ? [1, 0.72, 0, 1] : [0.04, 0.85, 0.16, 1];
        image.set(color, offset);
      }
      return rgbaToPngDataUrl(image, source.widthPx, source.heightPx);
    };
    const fallbackToPngDataUrl = () => {
      const image = new Float32Array(pixelCount * 4);
      for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * 4;
        const reason = c1Cpu.fallbackReason[index] ?? 0;
        const color: [number, number, number, number] = reason === 1
          ? [1, 0, 1, 1]
          : reason === 2 ? [0.1, 0.3, 1, 1]
            : reason === 3 ? [0, 0.8, 0.8, 1] : [0.03, 0.03, 0.03, 1];
        image.set(color, offset);
      }
      return rgbaToPngDataUrl(image, source.widthPx, source.heightPx);
    };
    const nearAlphaCoverage = near.reduce((count, value, offset) => offset % 4 === 3 && value > 0.02 ? count + 1 : count, 0);
    let nearLayerSignature = 2166136261;
    let nearAlphaSum = 0;
    let maximumNearAlpha = 0;
    for (let offset = 0; offset < near.length; offset += 4) {
      const alpha = near[offset + 3] ?? 0;
      nearAlphaSum += alpha;
      maximumNearAlpha = Math.max(maximumNearAlpha, alpha);
      for (let channel = 0; channel < 4; channel += 1) {
        nearLayerSignature = Math.imul(nearLayerSignature ^ Math.round((near[offset + channel] ?? 0) * 65536), 16777619);
      }
    }
    const candidateCompositeCpu = compositeFarAndNear(c1Cpu.rgba, (() => {
      const expandedNear = new Float32Array(pixelCount * 4);
      for (let y = 0; y < source.heightPx; y += 1) {
        for (let x = 0; x < source.widthPx; x += 1) {
          const index = y * source.widthPx + x;
          const [gx, gy] = [selectedGatherPixels[index * 2]!, selectedGatherPixels[index * 2 + 1]!];
          expandedNear.set(near.subarray((gy * gather.widthPx + gx) * 4, (gy * gather.widthPx + gx) * 4 + 4), index * 4);
        }
      }
      return expandedNear;
    })());
    let c1CompositeCpuComparison = null;
    if (phaseICandidateComposite) c1CompositeCpuComparison = compareRgba(candidateCompositeCpu, phaseICandidateComposite);
    const c1Output = phaseICandidateFar ?? c1Cpu.rgba;
    const c1Leakage = candidateLeakage(c1Output);
    const c1FallbackPixelCount = c1Cpu.fallbackReason.reduce((count, reason) => reason === 1 ? count + 1 : count, 0);
    const c1FallbackReasonHistogram = [0, 1, 2, 3].map((reason) => ({
      reason,
      pixels: c1Cpu.fallbackReason.reduce((count, value) => value === reason ? count + 1 : count, 0),
    }));
    const c1MaximumAcceptedNeighborCount = c1Cpu.acceptedNeighborCount.reduce((maximum, value) => Math.max(maximum, value), 0);
    const edgeCandidateDiagnostics = coverageAudit.records.map((record) => {
      const sourcePixel = record.sourcePixel as [number, number];
      const sourceIndex = sourcePixel[1] * source.widthPx + sourcePixel[0];
      const offset = sourceIndex * 4;
      const alpha = phaseICandidateFar?.[offset + 3] ?? c1Cpu.rgba[offset + 3] ?? 0;
      const expectedReason = c1Cpu.fallbackReason[sourceIndex] ?? 0;
      const reasonNames: Record<number, string> = {
        0: "none",
        1: "no-compatible-neighbor-source-color-fallback",
        2: "destination-not-valid-far-baseline-far-fallback",
        3: "full-resolution-baseline-passthrough",
      };
      const neighbors = c1Cpu.neighborRecords[sourceIndex] ?? [];
      return {
        sourcePixel,
        selectedGatherCoordinates: record.selectedGatherPixel,
        destinationSurfaceDepth: worldAndDepth[offset + 3] ?? 1,
        destinationCameraDistanceMm: Math.abs((worldAndDepth[offset + 2] ?? 0) - input.cameraZMm),
        destinationSignedCoC: physical[offset] ?? 0,
        compatibleNeighborCount: c1Cpu.acceptedNeighborCount[sourceIndex] ?? 0,
        acceptedWeightSum: c1Cpu.acceptedWeightSum[sourceIndex] ?? 0,
        fallbackUsed: expectedReason !== 0,
        fallbackReason: reasonNames[expectedReason] ?? "unknown",
        selectedNeighborCoordinates: neighbors.filter((neighbor) => neighbor.accepted).map((neighbor) => neighbor.gatherPixel),
        candidateCenterDepths: neighbors.map((neighbor) => ({
          gatherPixel: neighbor.gatherPixel,
          centerSourcePixel: neighbor.centerSourcePixel,
          depth: neighbor.centerDepth,
          cameraDistanceMm: neighbor.centerDistanceMm,
          signedCoC: neighbor.centerSignedCoCMm,
          validityCode: neighbor.validityCode,
          depthCompatible: neighbor.depthCompatible,
          spatialWeight: neighbor.spatialWeight,
          accepted: neighbor.accepted,
        })),
        gpuPackedDiagnosticAlpha: phaseICandidateFar ? alpha : null,
        gpuDecodedAcceptedNeighborCount: phaseICandidateFar && alpha >= 0 ? Math.floor(alpha + 1e-4) : null,
        candidateFarRgb: Array.from(c1Output.subarray(offset, offset + 3)),
      };
    });
    const referenceComparison = {
      full32VsFull64: full32 && full64 ? compareRgbaOnMask(full32, full64, allPixelsMask) : null,
      full32NativeVsCpu: input.gather.widthPx === source.widthPx && input.sampleCount === 32
        ? compareRgbaOnMask(cpuFullFar, nativeFarReconstruction.baselineFar, allPixelsMask)
        : null,
      full64NativeVsCpu: input.gather.widthPx === source.widthPx && input.sampleCount === 64
        ? compareRgbaOnMask(cpuFullFar, nativeFarReconstruction.baselineFar, allPixelsMask)
        : null,
    };
    const eligibleReference = input.scene === "phase-f-controlled"
      && input.apertureFNumber === 2
      && input.filmTiltDeg === 0
      && input.focusOffsetMm === 0
      && !input.crop
      && input.edgeCase === "axis-aligned"
      && source.widthPx === WIDTH
      && source.heightPx === HEIGHT;
    if (eligibleReference && gather.widthPx === source.widthPx && input.sampleCount === 32) {
      input.phaseIReferenceFarRasters.set("full-32", nativeFarReconstruction.baselineFar.slice());
    }
    if (eligibleReference && gather.widthPx === source.widthPx && input.sampleCount === 64) {
      input.phaseIReferenceFarRasters.set("full-64", nativeFarReconstruction.baselineFar.slice());
    }
    if (eligibleReference) {
      phaseIImageArtifacts["raw-source"] ??= rgbaToPngDataUrl(colors, source.widthPx, source.heightPx);
      const gatherLabel = gather.widthPx === source.widthPx ? "full" : "half";
      const variantKey = `${gatherLabel}-${input.sampleCount}`;
      if (gatherLabel === "full" && input.sampleCount === 32) {
        phaseIImageArtifacts["full32-far-B0"] = rgbaToPngDataUrl(nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
        phaseIImageArtifacts["full32-composite-B0"] = rgbaToPngDataUrl(compositeNative, source.widthPx, source.heightPx);
      }
      if (gatherLabel === "full" && input.sampleCount === 64) {
        phaseIImageArtifacts["full64-far-B0"] = rgbaToPngDataUrl(nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
        phaseIImageArtifacts["full64-composite-B0"] = rgbaToPngDataUrl(compositeNative, source.widthPx, source.heightPx);
      }
      if (gatherLabel === "half" && input.sampleCount === 32) {
        phaseIImageArtifacts["half32-far-B0"] = rgbaToPngDataUrl(nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
        phaseIImageArtifacts["half32-composite-B0"] = rgbaToPngDataUrl(compositeNative, source.widthPx, source.heightPx);
        phaseIImageArtifacts["half32-far-signal-B0"] = signalToPngDataUrl(nativeFarReconstruction.baselineFar, blueRoiMask, source.widthPx, source.heightPx);
        phaseIImageArtifacts["half32-near-alpha"] = nearAlphaToPngDataUrl(near, source, gather);
        phaseIImageArtifacts["half32-b0-red-leak-mask"] = leakMaskToPngDataUrl(nativeFarReconstruction.baselineFar);
        phaseIImageArtifacts["half32-neighbor-coverage"] = neighborCoverageToPngDataUrl();
        phaseIImageArtifacts["half32-c1-fallback-regions"] = fallbackToPngDataUrl();
        if (full32) phaseIImageArtifacts["half32-difference-B0-full32"] = differenceToPngDataUrl(full32, nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
        if (full64) phaseIImageArtifacts["half32-difference-B0-full64"] = differenceToPngDataUrl(full64, nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
        if (candidateFar && candidateComposite) {
          phaseIImageArtifacts["half32-far-B1"] = rgbaToPngDataUrl(candidateFar, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-composite-B1"] = rgbaToPngDataUrl(candidateComposite, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-far-signal-B1"] = signalToPngDataUrl(candidateFar, blueRoiMask, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-b1-red-leak-mask"] = leakMaskToPngDataUrl(candidateFar);
          if (full32) phaseIImageArtifacts["half32-difference-B1-full32"] = differenceToPngDataUrl(full32, candidateFar, source.widthPx, source.heightPx);
          if (full64) phaseIImageArtifacts["half32-difference-B1-full64"] = differenceToPngDataUrl(full64, candidateFar, source.widthPx, source.heightPx);
        }
        if (phaseICandidateFar && phaseICandidateComposite) {
          phaseIImageArtifacts["half32-far-C1"] = rgbaToPngDataUrl(phaseICandidateFar, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-composite-C1"] = rgbaToPngDataUrl(phaseICandidateComposite, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-far-signal-C1"] = signalToPngDataUrl(phaseICandidateFar, blueRoiMask, source.widthPx, source.heightPx);
          phaseIImageArtifacts["half32-c1-red-leak-mask"] = leakMaskToPngDataUrl(phaseICandidateFar);
          if (full32) phaseIImageArtifacts["half32-difference-C1-full32"] = differenceToPngDataUrl(full32, phaseICandidateFar, source.widthPx, source.heightPx);
          if (full64) phaseIImageArtifacts["half32-difference-C1-full64"] = differenceToPngDataUrl(full64, phaseICandidateFar, source.widthPx, source.heightPx);
        }
        let foregroundMinX = source.widthPx;
        let foregroundMinY = source.heightPx;
        let foregroundMaxX = -1;
        let foregroundMaxY = -1;
        for (let index = 0; index < nearForegroundMask.length; index += 1) {
          if (nearForegroundMask[index] !== 1) continue;
          const x = index % source.widthPx;
          const y = Math.floor(index / source.widthPx);
          foregroundMinX = Math.min(foregroundMinX, x);
          foregroundMinY = Math.min(foregroundMinY, y);
          foregroundMaxX = Math.max(foregroundMaxX, x);
          foregroundMaxY = Math.max(foregroundMaxY, y);
        }
        if (foregroundMaxX >= 0) {
          const cropSize = 32;
          const crop = {
            x: Math.max(0, Math.min(source.widthPx - cropSize, foregroundMaxX - 10)),
            y: Math.max(0, Math.min(source.heightPx - cropSize, Math.floor((foregroundMinY + foregroundMaxY) / 2) - cropSize / 2)),
            width: cropSize,
            height: cropSize,
          };
          phaseIImageArtifacts["half32-edge-B0"] = cropRgbaToPngDataUrl(nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx, crop);
          if (candidateFar) phaseIImageArtifacts["half32-edge-B1"] = cropRgbaToPngDataUrl(candidateFar, source.widthPx, source.heightPx, crop);
          if (phaseICandidateFar) phaseIImageArtifacts["half32-edge-C1"] = cropRgbaToPngDataUrl(phaseICandidateFar, source.widthPx, source.heightPx, crop);
        }
      }
      if (gatherLabel === "half" && input.sampleCount !== 32) {
        phaseIImageArtifacts[`${variantKey}-far-B0`] = rgbaToPngDataUrl(nativeFarReconstruction.baselineFar, source.widthPx, source.heightPx);
      }
    }
    return {
      referenceClass: "R2-independent-CPU-aperture-sampling and R3-native-full-resolution-gather; both are finite-sample references, not ideal optical ground truth",
      setup: {
        sourceGridRoi: "pixels whose source readback matches the controlled linear blue background (R<0.15, G<0.2, B>0.5)",
        roiPixelCount: blueRoiMask.reduce((count, value) => count + value, 0),
        featureCenterPx: featureCenterPx,
        featureCenterSourceYellowPixels: featurePixelCount,
        signal: "max(0, 0.925*(far.r-0.025) + 0.54*(far.g-0.08) - 0.825*(far.b-0.85)); this reuses the Phase H yellow-signal projection",
        threshold: 0.02,
        signalColorSpace: "linear RGB from native half-float target readback; no per-image normalization",
        apertureFNumber: input.apertureFNumber,
        crop: input.crop,
        edgeCase: input.edgeCase,
        scene: input.scene,
      },
      baselineB0: { ...b0, leakage: candidateLeakage(nativeFarReconstruction.baselineFar) },
      phaseHB1Cpu: { ...b1Cpu, leakage: candidateLeakage(phaseHCompatibleCpu) },
      phaseHB1: {
        available: Boolean(candidateFar),
        ...(b1Gpu ?? {}),
        leakage: candidateFar ? candidateLeakage(candidateFar) : null,
        nativeGpuVsCpu: candidateFar ? compareRgba(phaseHCompatibleCpu, candidateFar) : null,
      },
      phaseIC1: {
        ...c1Quality,
        available: Boolean(phaseICandidateFar),
        candidateExecution: phaseICandidateFar ? "native WebGPU surface-aware output target" : "CPU oracle only",
        leakage: c1Leakage,
        fallbackPixelCount: c1FallbackPixelCount,
        fallbackReasonHistogram: c1FallbackReasonHistogram,
        maximumAcceptedNeighborCount: c1MaximumAcceptedNeighborCount,
        acceptedNeighborCountHistogram: Array.from({ length: 10 }, (_, count) => ({
          count,
          pixels: c1Cpu.acceptedNeighborCount.reduce((sum, value) => value === count ? sum + 1 : sum, 0),
        })),
        nativeGpuVsCpu: c1CpuComparison,
        nativePathVsCpu: c1PathMismatch,
        compositeGpuVsCpu: c1CompositeCpuComparison,
        nearAlphaCoveragePixels: nearAlphaCoverage,
        nearLayerSignature: {
          rgbaHalfReadbackHash: nearLayerSignature >>> 0,
          alphaSum: nearAlphaSum,
          maximumAlpha: maximumNearAlpha,
          coveredPixelCount: nearAlphaCoverage,
          pixelCount: gatherPixelCount,
        },
        nearLayerReuse: "same native near target and alpha used by B0/B1; no Phase I near-gather pass",
        affectedEdgeDiagnostics: edgeCandidateDiagnostics,
      },
      references: {
        available: { full32: Boolean(full32), full64: Boolean(full64) },
        agreement: referenceComparison,
        full32B0: full32 ? rasterQuality(full32) : null,
        full64B0: full64 ? rasterQuality(full64) : null,
      },
      comparisons: {
        B0: { againstFull32: b0.rgbErrorAgainstFull32, againstFull64: b0.rgbErrorAgainstFull64 },
        B1: { againstFull32: b1.rgbErrorAgainstFull32, againstFull64: b1.rgbErrorAgainstFull64 },
        C1: { againstFull32: c1Quality.rgbErrorAgainstFull32, againstFull64: c1Quality.rgbErrorAgainstFull64 },
      },
      coverageAudit,
      surfaceDepthAudit,
      edgeRgbErrorAgainstFull32: b0.edgeRgbErrorAgainstFull32,
      focusRgbErrorAgainstSource: b0.focusRgbErrorAgainstSource,
    };
  })() : null;
  const nearRedForeground = Array.from({ length: pixelCount }, (_, index) => sourceIsRed(index * 4));
  const distanceToForeground = (x: number, y: number) => {
    let minimum = Number.POSITIVE_INFINITY;
    for (let fy = 0; fy < source.heightPx; fy += 1) {
      for (let fx = 0; fx < source.widthPx; fx += 1) {
        if (nearRedForeground[fy * source.widthPx + fx]) minimum = Math.min(minimum, Math.abs(x - fx) + Math.abs(y - fy));
      }
    }
    return Number.isFinite(minimum) ? minimum : null;
  };
  const classCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  const leakageRecords: Array<Record<string, unknown>> = [];
  const leakRows: Record<string, number> = {};
  const leakColumns: Record<string, number> = {};
  let baselineLeakEnergy = 0;
  let candidateLeakEnergy = 0;
  let candidateLeakCount = 0;
  let baselineLeakDistanceTotal = 0;
  let baselineLeakMaxDistance = 0;
  let farYellowEnergyBaseline = 0;
  let farYellowEnergyCandidate = 0;
  let farYellowPixelsBaseline = 0;
  let farYellowPixelsCandidate = 0;
  let nearSpreadPixels = 0;
  let nearBlueLeakPixels = 0;
  let nearAlphaPixels = 0;
  let focusedGreenPixels = 0;
  let focusedGreenCandidateError = 0;
  let candidateDifferenceTotal = 0;
  let candidateDifferenceMax = 0;
  let candidateDifferencePixels = 0;
  let candidatePathMismatchCount = 0;
  const candidatePathMismatchExamples: Array<Record<string, unknown>> = [];
  let candidateCpuReconstructionComparison: ReturnType<typeof compareRgba> | null = null;
  let candidateCompositeCpuComparison: ReturnType<typeof compareRgba> | null = null;
  const candidateReconstructionMismatchExamples: Array<Record<string, unknown>> = [];

  if (candidateFar && candidateComposite) {
    const cpuReconstruction = reconstructFarToSourceGrid({
      source,
      gather,
      gatherFar: cpuGather.rgba,
      colors,
      physical,
      validity,
      selectedGatherPixels,
      centerSourcePixels: observedGatherCenterPixels,
    });
    candidateCpuReconstructionComparison = compareRgba(cpuReconstruction.compatibleFar, candidateFar);
    for (let sourceIndex = 0; sourceIndex < pixelCount; sourceIndex += 1) {
      const offset = sourceIndex * 4;
      const expectedPathCode = cpuReconstruction.candidateAccepted[sourceIndex] ?? 0;
      const actualPathCode = (candidateFar[offset + 3] ?? 0) > 0.75
        ? 1
        : (candidateFar[offset + 3] ?? 0) > 0.25 ? 2 : 0;
      if (actualPathCode !== expectedPathCode) {
        candidatePathMismatchCount += 1;
        if (candidatePathMismatchExamples.length < 12) {
          candidatePathMismatchExamples.push({
            sourcePixel: [sourceIndex % source.widthPx, Math.floor(sourceIndex / source.widthPx)],
            expectedPathCode,
            actualPathCode,
            rawAlpha: candidateFar[offset + 3],
          });
        }
      }
      const error = Math.max(
        Math.abs((candidateFar[offset] ?? 0) - (cpuReconstruction.compatibleFar[offset] ?? 0)),
        Math.abs((candidateFar[offset + 1] ?? 0) - (cpuReconstruction.compatibleFar[offset + 1] ?? 0)),
        Math.abs((candidateFar[offset + 2] ?? 0) - (cpuReconstruction.compatibleFar[offset + 2] ?? 0)),
      );
      if (error <= 0.04 || candidateReconstructionMismatchExamples.length >= 12) continue;
      const sourceX = sourceIndex % source.widthPx;
      const sourceY = Math.floor(sourceIndex / source.widthPx);
      const gatherIndex = sourceIndex * 2;
      const chosenGatherX = cpuReconstruction.candidateGatherPixels[gatherIndex]!;
      const chosenGatherY = cpuReconstruction.candidateGatherPixels[gatherIndex + 1]!;
      const centerOffset = (chosenGatherY * gather.widthPx + chosenGatherX) * 2;
      const selectedX = selectedGatherPixels[gatherIndex]!;
      const selectedY = selectedGatherPixels[gatherIndex + 1]!;
      const selectedFarOffset = (selectedY * gather.widthPx + selectedX) * 4;
      const sourcePixelOffset = sourceIndex * 4;
      candidateReconstructionMismatchExamples.push({
        sourcePixel: [sourceX, sourceY],
        selectedGatherPixel: [selectedX, selectedY],
        cpuCompatibleGatherPixel: [chosenGatherX, chosenGatherY],
        cpuCompatibleCenterSourcePixel: [observedGatherCenterPixels[centerOffset], observedGatherCenterPixels[centerOffset + 1]],
        cpuAcceptedCode: cpuReconstruction.candidateAccepted[sourceIndex],
        sourceColor: Array.from(colors.subarray(offset, offset + 3)),
        sourceValidityCode: validity[sourceIndex],
        sourceSignedCoCMm: physical[sourcePixelOffset],
        selectedFarGpuColor: Array.from(farNative.subarray(selectedFarOffset, selectedFarOffset + 3)),
        selectedFarCpuColor: Array.from(cpuGather.rgba.subarray(selectedFarOffset, selectedFarOffset + 3)),
        expectedCandidateColor: Array.from(cpuReconstruction.compatibleFar.subarray(offset, offset + 3)),
        actualCandidateColor: Array.from(candidateFar.subarray(offset, offset + 3)),
        actualCandidatePathCode: actualPathCode,
        maxRgbError: error,
      });
    }
    const nearFullResolution = new Float32Array(pixelCount * 4);
    for (let y = 0; y < source.heightPx; y += 1) {
      for (let x = 0; x < source.widthPx; x += 1) {
        const sourceIndex = y * source.widthPx + x;
        const gx = selectedGatherPixels[sourceIndex * 2]!;
        const gy = selectedGatherPixels[sourceIndex * 2 + 1]!;
        const gatherOffset = (gy * gather.widthPx + gx) * 4;
        nearFullResolution.set(near.subarray(gatherOffset, gatherOffset + 4), sourceIndex * 4);
      }
    }
    candidateCompositeCpuComparison = compareRgba(
      compositeFarAndNear(cpuReconstruction.compatibleFar, nearFullResolution),
      candidateComposite,
    );
  }

  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const index = y * source.widthPx + x;
      const offset = index * 4;
      const [cpuGatherX, cpuGatherY] = gatherTexelForSourcePixelCenter([x, y], source, gather);
      const selectedGatherX = selectedProvenance[offset] ?? -1;
      const selectedGatherY = selectedProvenance[offset + 1] ?? -1;
      const centerSourceX = selectedProvenance[offset + 2] ?? -1;
      const centerSourceY = selectedProvenance[offset + 3] ?? -1;
      const gatherX = selectedGatherX >= 0 && selectedGatherX < gather.widthPx ? selectedGatherX : cpuGatherX;
      const gatherY = selectedGatherY >= 0 && selectedGatherY < gather.heightPx ? selectedGatherY : cpuGatherY;
      const gatherOffset = (gatherY * gather.widthPx + gatherX) * 4;
      const centerX = centerSourceX >= 0 && centerSourceX < source.widthPx ? centerSourceX : sourcePixelAtGatherPixelCenter([gatherX, gatherY], gather, source)[0];
      const centerY = centerSourceY >= 0 && centerSourceY < source.heightPx ? centerSourceY : sourcePixelAtGatherPixelCenter([gatherX, gatherY], gather, source)[1];
      const centerIndex = centerY * source.widthPx + centerX;
      const centerOffset = centerIndex * 4;
      const sourceRed = colors[offset] ?? 0;
      const farColor = farNative.subarray(gatherOffset, gatherOffset + 4);
      const nearColor = near.subarray(gatherOffset, gatherOffset + 4);
      const baselineLeak = sourceIsBlue(offset) && isRed(farNative, gatherOffset);
      const candidateLeak = Boolean(candidateFar && sourceIsBlue(offset) && isRed(candidateFar, offset));
      if (candidateLeak) {
        candidateLeakCount += 1;
        candidateLeakEnergy += Math.max(0, (candidateFar![offset] ?? 0) - sourceRed);
      }
      const baselineFarAtSource = nativeFarReconstruction.baselineFar;
      const sourceYellowSignal = Math.max(0,
        ((candidateFar?.[offset] ?? baselineFarAtSource[offset] ?? 0) - 0.025) * 0.925
        + ((candidateFar?.[offset + 1] ?? baselineFarAtSource[offset + 1] ?? 0) - 0.08) * 0.54
        - ((candidateFar?.[offset + 2] ?? baselineFarAtSource[offset + 2] ?? 0) - 0.85) * 0.825,
      );
      const baselineYellowSignal = Math.max(0,
        ((baselineFarAtSource[offset] ?? 0) - 0.025) * 0.925
        + ((baselineFarAtSource[offset + 1] ?? 0) - 0.08) * 0.54
        - ((baselineFarAtSource[offset + 2] ?? 0) - 0.85) * 0.825,
      );
      if (sourceIsBlue(offset) && baselineYellowSignal > 0.02) {
        farYellowPixelsBaseline += 1;
        farYellowEnergyBaseline += baselineYellowSignal;
      }
      if (sourceIsBlue(offset) && sourceYellowSignal > 0.02) {
        farYellowPixelsCandidate += 1;
        farYellowEnergyCandidate += sourceYellowSignal;
      }
      const nearAlpha = nearColor[3] ?? 0;
      if (nearAlpha > 0.02) nearAlphaPixels += 1;
      if (!sourceIsRed(offset) && nearAlpha > 0.02 && isRed(near, gatherOffset)) nearSpreadPixels += 1;
      if (sourceIsBlue(offset) && nearAlpha > 0.02 && (nearColor[2] ?? 0) > 0.5 && (nearColor[0] ?? 0) < 0.15) nearBlueLeakPixels += 1;
      if (isGreen(colors, offset)) {
        focusedGreenPixels += 1;
        if (candidateFar) focusedGreenCandidateError += Math.abs((candidateFar[offset] ?? 0) - (colors[offset] ?? 0));
      }
      if (candidateFar) {
        const error = Math.max(
          Math.abs((candidateFar[offset] ?? 0) - (baselineFarAtSource[offset] ?? 0)),
          Math.abs((candidateFar[offset + 1] ?? 0) - (baselineFarAtSource[offset + 1] ?? 0)),
          Math.abs((candidateFar[offset + 2] ?? 0) - (baselineFarAtSource[offset + 2] ?? 0)),
        );
        candidateDifferenceTotal += error;
        candidateDifferenceMax = Math.max(candidateDifferenceMax, error);
        if (error > 0.01) candidateDifferencePixels += 1;
      }
      if (!baselineLeak) continue;
      baselineLeakEnergy += Math.max(0, (farNative[gatherOffset] ?? 0) - sourceRed);
      const distance = distanceToForeground(x, y);
      if (distance !== null) {
        baselineLeakDistanceTotal += distance;
        baselineLeakMaxDistance = Math.max(baselineLeakMaxDistance, distance);
      }
      leakRows[String(y)] = (leakRows[String(y)] ?? 0) + 1;
      leakColumns[String(x)] = (leakColumns[String(x)] ?? 0) + 1;
      const selectedMismatch = selectedGatherX !== cpuGatherX || selectedGatherY !== cpuGatherY;
      const centerValidityCode = validity[centerIndex] ?? 0;
      const centerCoc = physical[centerOffset] ?? 0;
      let classification: "A" | "B" | "C" | "D" | "E";
      if (selectedMismatch) classification = "C";
      else if (centerValidityCode !== 1) classification = "D";
      else if (centerCoc < -0.00001) classification = "A";
      else if (centerCoc > 0.00001) classification = "B";
      else classification = "E";
      classCounts[classification] += 1;
      leakageRecords.push({
        sourceX: x,
        sourceY: y,
        sourceColor: [colors[offset], colors[offset + 1], colors[offset + 2]],
        sourceDepth: worldAndDepth[offset + 3],
        sourceWorldPositionMm: [worldAndDepth[offset], worldAndDepth[offset + 1], worldAndDepth[offset + 2]],
        sourceValidityCode: validity[index],
        sourceSignedCoCMm: physical[offset],
        gatherX,
        gatherY,
        gatherCenterUvTop: [(gatherX + 0.5) / gather.widthPx, (gatherY + 0.5) / gather.heightPx],
        actualGpuSelectedGather: [selectedGatherX, selectedGatherY],
        cpuSelectedGather: [cpuGatherX, cpuGatherY],
        gatherCenterSourceX: centerX,
        gatherCenterSourceY: centerY,
        gatherCenterSourceColor: [colors[centerOffset], colors[centerOffset + 1], colors[centerOffset + 2]],
        gatherCenterDepth: worldAndDepth[centerOffset + 3],
        gatherCenterValidityCode: centerValidityCode,
        gatherCenterSignedCoCMm: centerCoc,
        nativeFarColor: Array.from(farColor.slice(0, 3)),
        reconstructedFarColor: Array.from(farColor.slice(0, 3)),
        nearColor: Array.from(nearColor.slice(0, 3)),
        nearAlpha,
        compositeColor: Array.from(compositeNative.slice(offset, offset + 3)),
        classification,
        distanceToSharpForegroundPx: distance,
      });
    }
  }

  return {
    coordinateContract: {
      uvOrigin: "top-left source pixel coordinates; TSL texture calls use vec2(uv().x, 1-uv().y)",
      readbackOrigin,
      textureFilter: "nearest; clamp-to-edge; no mipmaps",
      sourceIdentityMismatchCount: identityMismatch.source,
      gatherCoordinateMismatchCount: identityMismatch.gatherCoordinates,
      gatherCenterNominalFormulaMismatchCount: identityMismatch.gatherCenterFormula,
      gatherCenterMaximumDeviationPx: gatherCenterMaximumDeviationPx,
      gatherCenterOutOfBoundsCount: identityMismatch.gatherCenterOutOfBounds,
      selectedGatherNominalFormulaMismatchCount: identityMismatch.selectedGatherFormula,
      selectedCenterProvenanceMismatchCount: identityMismatch.selectedCenterProvenance,
      selectedGatherOutOfBoundsCount: identityMismatch.selectedGatherOutOfBounds,
      sourcePixelsChecked: pixelCount,
      gatherTexelsChecked: gatherPixelCount,
      samplingExamples,
      gatherMismatchExamples,
      compositeMismatchExamples,
    },
    cpuReference: {
      inputOrigin: "native color, depth/world, physical CoC and validity readbacks normalized to top-origin arrays",
      validFarGatherCenters: cpuGather.validFarCenterCount,
      gatherGpuVsCpu: gatherComparison,
      reconstructionGpuVsCpu: reconstructionComparison,
      candidateFarGpuVsCpu: candidateCpuReconstructionComparison,
      candidateCompositeGpuVsCpu: candidateCompositeCpuComparison,
      candidateReconstructionMismatchExamples,
      expectedFarTexels: gatherPixelCount,
      reconstructedSourcePixels: pixelCount,
    },
    leakage: {
      sourcePixelCount: pixelCount,
      baselineLeakPixelCount: leakageRecords.length,
      baselineLeakEnergy,
      meanDistanceToForegroundPx: leakageRecords.length ? baselineLeakDistanceTotal / leakageRecords.length : 0,
      maximumDistanceToForegroundPx: baselineLeakMaxDistance,
      classCounts,
      spatialDistribution: { byTopOriginRow: leakRows, byColumn: leakColumns },
      records: leakageRecords,
      candidate: candidateFar ? {
        farLeakPixelCount: candidateLeakCount,
        farLeakEnergy: candidateLeakEnergy,
        farYellowSpreadPixels: farYellowPixelsCandidate,
        farYellowSpreadEnergy: farYellowEnergyCandidate,
        baselineFarYellowSpreadPixels: farYellowPixelsBaseline,
        baselineFarYellowSpreadEnergy: farYellowEnergyBaseline,
        nearRedSpreadPixels: nearSpreadPixels,
        nearAlphaCoveragePixels: nearAlphaPixels,
        nearBlueLeakPixels,
        focusedGreenSourcePixels: focusedGreenPixels,
        focusedGreenFarMeanAbsoluteDeviationFromRaw: focusedGreenPixels ? focusedGreenCandidateError / focusedGreenPixels : null,
        candidatePathMismatchCount,
        candidatePathMismatchExamples,
        farCandidateVsBaseline: {
          changedPixelCountAboveRgbMaxError001: candidateDifferencePixels,
          meanPixelMaxRgbError: candidateDifferenceTotal / Math.max(pixelCount, 1),
          maximumPixelRgbError: candidateDifferenceMax,
        },
        candidateCompositeVsBaselineMaxRgbError: candidateComposite
          ? compareRgba(candidateComposite, compositeNative).maxRgbError
          : null,
      } : null,
    },
    phaseI,
    execution: {
      edgeCase: input.edgeCase,
      sampleCount: input.sampleCount,
      gatherDimensions: gather,
      additionalTargetStorageEstimateBytes: pixelCount * 48 + gatherPixelCount * 16,
      additionalTargetStorageEstimateIncludes: [
        "two source-sized RGBA32F identity/provenance targets",
        "one gather-sized RGBA32F center-provenance target",
        "two source-sized RGBA16F candidate targets",
      ],
      candidatePassTimings: input.stageTimings.filter((timing) => timing.stage.startsWith("phase-h-") || timing.stage.startsWith("phase-i-")),
      gpuTimestampDurationMs: null,
    },
  };
};
const configureTargetTexture = (target: THREE.RenderTarget) => {
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.texture.wrapS = THREE.ClampToEdgeWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
};
const makeTarget = (width: number, height: number, options: {
  type?: THREE.TextureDataType;
  depthBuffer?: boolean;
}) => {
  const target = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: options.type ?? THREE.HalfFloatType,
    depthBuffer: options.depthBuffer ?? false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  configureTargetTexture(target);
  if (options.depthBuffer) {
    target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    target.depthTexture.format = THREE.DepthFormat;
    target.depthTexture.minFilter = THREE.NearestFilter;
    target.depthTexture.magFilter = THREE.NearestFilter;
    target.depthTexture.generateMipmaps = false;
  }
  return target;
};

const makeBasis = (
  normalInput: Node<"vec3">,
  primaryInput: Node<"vec3">,
  secondaryInput: Node<"vec3">,
) => {
  const normalLength = length(normalInput);
  const normal = normalInput.div(max(normalLength, 1e-7));
  const projectedPrimary = primaryInput.sub(normal.mul(dot(primaryInput, normal)));
  const projectedSecondary = secondaryInput.sub(normal.mul(dot(secondaryInput, normal)));
  const primaryLength = length(projectedPrimary);
  const projected = select(primaryLength.greaterThan(1e-7), projectedPrimary, projectedSecondary);
  const projectedLength = length(projected);
  const x = projected.div(max(projectedLength, 1e-7));
  const yCandidate = cross(normal, x).div(max(length(cross(normal, x)), 1e-7));
  const y = select(dot(yCandidate, secondaryInput).lessThan(0), yCandidate.mul(-1), yCandidate);
  const valid = normalLength.greaterThan(1e-7)
    .and(projectedLength.greaterThan(1e-7))
    .and(length(cross(normal, x)).greaterThan(1e-7));
  return { normal, x, y, valid };
};

const buildHandle = async (canvas: HTMLCanvasElement): Promise<MountedHandle> => {
  const generation = store.nextGeneration++;
  let sourceWidthPx: number = WIDTH;
  let sourceHeightPx: number = HEIGHT;
  let currentStudyScene: StudyScene = "phase-f-controlled";
  let architectureProxyScale = 0;
  let interiorProxyScale = 0;
  const evidence: FixtureHandleEvidence = {
    instanceId: `aperture-g${generation}-${crypto.randomUUID()}`,
    generation,
    state: "initializing",
    runtime: null,
    dimensions: null,
    formats: null,
    passes: [],
    metrics: null,
    pointProbes: [],
    gatherReferenceProbes: [],
    unresolvedSample: null,
    sampleDiagnostics: null,
    operations: [],
    targetResizeCount: 0,
    sceneProvenance: null,
    targetMemoryEstimate: null,
    phaseH: null,
    phaseI: null,
    resources: [],
    error: null,
    cleanupError: null,
    cleanupCompletedAt: null,
  };
  store.handles.push(evidence);
  signal();
  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
  const owned: Array<{ id: string; role: string; dispose: () => void | Promise<void> }> = [];
  const register = (id: string, role: string, dispose: () => void | Promise<void>) => {
    owned.push({ id, role, dispose });
    evidence.resources.push({ id, role, allocation: "allocated", state: "active", error: null });
  };
  register(`${evidence.instanceId}:renderer`, "webgpu-renderer", () => renderer.dispose());
  let retired = false;
  let disposePromise: Promise<void> | null = null;
  const pendingOperations = new Set<Promise<void>>();
  let operationChain: Promise<void> = Promise.resolve();

  const failAt = (expected: FailureStage | undefined, actual: FailureStage) => {
    if (expected === actual) {
      const phase = actual === "far-reconstruction" ? "Phase H" : "Phase F";
      throw new Error(`Injected ${phase} failure after ${actual} pass`);
    }
  };

  try {
    await renderer.init();
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.outputColorSpace = THREE.NoColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    scene.background = null;
    const sceneObjects: Array<{ id: string; mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: MeshBasicNodeMaterial }> = [];
    const addPlane = (definition: {
      id: string;
      worldPointM: [number, number, number];
      sizeM: [number, number];
      linearColor: [number, number, number];
    }) => {
      const geometry = new THREE.PlaneGeometry(...definition.sizeM);
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.side = THREE.DoubleSide;
      material.outputNode = vec4(...definition.linearColor, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = definition.id;
      mesh.position.set(...definition.worldPointM);
      scene.add(mesh);
      sceneObjects.push({ id: definition.id, mesh, geometry, material });
    };
    addPlane({ id: "far-blue-background", worldPointM: [0, 0, 0.75], sizeM: [0.72, 0.56], linearColor: [0.025, 0.08, 0.85] });
    addPlane({ id: "focused-green-target", worldPointM: [0.11, 0.015, 0.5], sizeM: [0.085, 0.085], linearColor: [0.03, 0.9, 0.04] });
    addPlane({ id: "far-yellow-feature", worldPointM: [0.07, 0.075, 0.7499], sizeM: [0.075, 0.065], linearColor: [0.95, 0.62, 0.025] });
    addPlane({ id: "near-red-foreground", worldPointM: [-0.075, -0.005, 0.32], sizeM: [0.12, 0.15], linearColor: [0.95, 0.015, 0.015] });
    // Keep the second far surface in front of the blue background plane at z=0.75 m.
    addPlane({ id: "second-far-depth-feature", worldPointM: [0.19, -0.03, 0.62], sizeM: [0.13, 0.25], linearColor: [0.7, 0.08, 0.75] });
    const nearForegroundMesh = sceneObjects.find((object) => object.id === "near-red-foreground")?.mesh;
    for (const object of sceneObjects) {
      register(`${evidence.instanceId}:${object.id}:geometry`, "owned-scene-geometry", () => object.geometry.dispose());
      register(`${evidence.instanceId}:${object.id}:material`, "owned-scene-material", () => object.material.dispose());
    }

    let architectureProxy: THREE.Group | null = null;
    let interiorProxy: THREE.Group | null = null;
    if (phaseResearchEnabled) {
      architectureProxy = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
      architectureProxy.visible = false;
      architectureProxy.updateMatrixWorld(true);
      const architectureBounds = new THREE.Box3().setFromObject(architectureProxy);
      const architectureSize = architectureBounds.getSize(new THREE.Vector3());
      const architectureCenter = architectureBounds.getCenter(new THREE.Vector3());
      architectureProxyScale = Math.min(0.58 / architectureSize.x, 0.42 / architectureSize.y, 0.58 / architectureSize.z);
      architectureProxy.scale.setScalar(architectureProxyScale);
      architectureProxy.position.set(-architectureCenter.x * architectureProxyScale, -architectureCenter.y * architectureProxyScale, 0.58 - architectureCenter.z * architectureProxyScale);
      scene.add(architectureProxy);
      register(`${evidence.instanceId}:architecture-rise-geometry-proxy`, "owned-canonical-architecture-rise-geometry-proxy", () => disposeArchitectureRiseGroup(architectureProxy!));

      interiorProxy = createInteriorCornerGroup({ presentation: INTERIOR_CORNER_PRESENTATION });
      interiorProxy.visible = false;
      interiorProxy.updateMatrixWorld(true);
      const interiorBounds = new THREE.Box3().setFromObject(interiorProxy);
      const interiorSize = interiorBounds.getSize(new THREE.Vector3());
      const interiorCenter = interiorBounds.getCenter(new THREE.Vector3());
      interiorProxyScale = Math.min(0.58 / interiorSize.x, 0.42 / interiorSize.y, 0.58 / interiorSize.z);
      interiorProxy.scale.setScalar(interiorProxyScale);
      interiorProxy.position.set(-interiorCenter.x * interiorProxyScale, -interiorCenter.y * interiorProxyScale, 0.58 - interiorCenter.z * interiorProxyScale);
      scene.add(interiorProxy);
      register(`${evidence.instanceId}:interior-corner-geometry-proxy`, "owned-canonical-interior-corner-geometry-proxy", () => disposeInteriorCornerGroup(interiorProxy!));

      const studyAmbient = new THREE.AmbientLight(0xffffff, 1.3);
      const studyKey = new THREE.DirectionalLight(0xffffff, 2.2);
      studyKey.position.set(-1, 2, -1);
      scene.add(studyAmbient, studyKey);
    }

    const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.01, 2);
    camera.position.set(0, 0, -0.12);
    camera.lookAt(0, 0, 0.5);
    camera.coordinateSystem = renderer.coordinateSystem;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const sourceTarget = makeTarget(WIDTH, HEIGHT, { depthBuffer: true });
    const cocTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType });
    const validityTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.UnsignedByteType });
    const worldTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.FloatType });
    const phaseHSourceIdentityTarget = phaseHStudyEnabled
      ? makeTarget(WIDTH, HEIGHT, { type: THREE.FloatType })
      : null;
    const phaseHGatherProvenanceTarget = phaseHStudyEnabled
      ? makeTarget(WIDTH, HEIGHT, { type: THREE.FloatType })
      : null;
    const phaseHSelectedProvenanceTarget = phaseHStudyEnabled
      ? makeTarget(WIDTH, HEIGHT, { type: THREE.FloatType })
      : null;
    const phaseHCandidateFarTarget = phaseHStudyEnabled ? makeTarget(WIDTH, HEIGHT, {}) : null;
    const phaseHCandidateCompositeTarget = phaseHStudyEnabled ? makeTarget(WIDTH, HEIGHT, {}) : null;
    register(`${evidence.instanceId}:source-target`, "rgba16float-scene-color-plus-depth-target", () => sourceTarget.dispose());
    register(`${evidence.instanceId}:physical-coc-target`, "rgba16float-physical-coc-footprint-target", () => cocTarget.dispose());
    register(`${evidence.instanceId}:validity-target`, "rgba8unorm-physical-validity-target", () => validityTarget.dispose());
    register(`${evidence.instanceId}:world-diagnostic-target`, "rgba32float-world-position-diagnostic-target", () => worldTarget.dispose());
    if (phaseHSourceIdentityTarget) register(`${evidence.instanceId}:phase-h-source-identity`, "rgba32float-phase-h-source-identity-target", () => phaseHSourceIdentityTarget.dispose());
    if (phaseHGatherProvenanceTarget) register(`${evidence.instanceId}:phase-h-gather-provenance`, "rgba32float-phase-h-gather-provenance-target", () => phaseHGatherProvenanceTarget.dispose());
    if (phaseHSelectedProvenanceTarget) register(`${evidence.instanceId}:phase-h-selected-provenance`, "rgba32float-phase-h-composite-selected-provenance-target", () => phaseHSelectedProvenanceTarget.dispose());
    if (phaseHCandidateFarTarget) register(`${evidence.instanceId}:phase-h-compatible-far`, "rgba16float-phase-h-compatible-far-target", () => phaseHCandidateFarTarget.dispose());
    if (phaseHCandidateCompositeTarget) register(`${evidence.instanceId}:phase-h-candidate-composite`, "rgba16float-phase-h-candidate-composite-target", () => phaseHCandidateCompositeTarget.dispose());

    const postGeometry = new THREE.PlaneGeometry(2, 2);
    register(`${evidence.instanceId}:fullscreen-geometry`, "owned-fullscreen-geometry", () => postGeometry.dispose());
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postCamera.position.z = 0;
    postCamera.updateMatrixWorld(true);
    const physicalProjectionInverse = uniform(camera.projectionMatrixInverse.clone());
    const physicalCameraWorld = uniform(camera.matrixWorld.clone());
    const lensCenterMm = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensCenterMm));
    const lensNormalInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensNormal));
    const lensBasisXInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensBasisX));
    const lensBasisYInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensBasisY));
    const filmPointMm = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmPointMm));
    const filmNormalInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmNormal));
    const filmBasisXInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmBasisX));
    const filmBasisYInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmBasisY));
    const focalLengthMm = uniform(APERTURE_GATHER_CASES.focalLengthMm);
    const apertureFNumber = uniform(APERTURE_GATHER_CASES.apertureFNumber);
    const explicitParallelLimitIdentity = uniform(0);
    const sampledFilmWidthMm = uniform(APERTURE_GATHER_CASES.fullFilmWidthMm);
    const sampledFilmHeightMm = uniform(APERTURE_GATHER_CASES.fullFilmHeightMm);
    const forceUnresolvedMask = uniform(0);
    const sourceWidthUniform = uniform(WIDTH);
    const sourceHeightUniform = uniform(HEIGHT);
    const phaseHGatherWidthUniform = uniform(WIDTH);
    const phaseHGatherHeightUniform = uniform(HEIGHT);

    const sourceUvTop = vec2(uv().x, uv().y.oneMinus());
    const sampledDepth = texture(sourceTarget.depthTexture!, sourceUvTop).r;
    const viewPosition = getViewPosition(sourceUvTop, sampledDepth, physicalProjectionInverse);
    const worldPositionMm = physicalCameraWorld.mul(vec4(viewPosition, 1)).xyz.mul(1000);
    const objectDelta = worldPositionMm.sub(lensCenterMm);
    const lens = makeBasis(lensNormalInput, lensBasisXInput, lensBasisYInput);
    const film = makeBasis(filmNormalInput, filmBasisXInput, filmBasisYInput);
    const objectDistanceMm = dot(objectDelta, lens.normal);
    const lateralOffsetMm = objectDelta.sub(lens.normal.mul(objectDistanceMm));
    const imageDenominator = objectDistanceMm.sub(focalLengthMm);
    const finiteImage = abs(imageDenominator).greaterThan(0);
    const parallelImageLimit = explicitParallelLimitIdentity.greaterThan(0.5).and(finiteImage.not());
    const focalBranchResolved = finiteImage.or(parallelImageLimit);
    const safeObjectDistance = select(abs(objectDistanceMm).greaterThan(1e-7), objectDistanceMm, 1);
    const safeImageDenominator = select(finiteImage, imageDenominator, 1);
    const idealImageDistanceMm = focalLengthMm.mul(objectDistanceMm).div(safeImageDenominator);
    const imagePoint = lensCenterMm
      .sub(lens.normal.mul(idealImageDistanceMm))
      .sub(lateralOffsetMm.mul(idealImageDistanceMm.div(safeObjectDistance)));
    const finiteDirection = select(
      idealImageDistanceMm.lessThan(0),
      lensCenterMm.sub(imagePoint),
      imagePoint.sub(lensCenterMm),
    );
    const parallelDirectionInput = lens.normal.mul(-1).sub(lateralOffsetMm.div(safeObjectDistance));
    const parallelDirection = parallelDirectionInput.div(max(length(parallelDirectionInput), 1e-7));
    const imageDirectionInput = select(finiteImage, finiteDirection, parallelDirection);
    const imageDirection = imageDirectionInput.div(max(length(imageDirectionInput), 1e-7));
    const imagePointUsed = select(finiteImage, imagePoint, lensCenterMm);
    const filmDenominator = dot(imageDirection, film.normal);
    const safeFilmDenominator = select(abs(filmDenominator).greaterThan(1e-7), filmDenominator, 1);
    const centerFilmDistance = dot(filmPointMm.sub(lensCenterMm), film.normal).div(safeFilmDenominator);
    const filmDelta = filmPointMm.sub(lensCenterMm);
    const apertureRadiusMm = focalLengthMm.div(apertureFNumber.mul(2));
    const apertureX = lens.x.mul(apertureRadiusMm);
    const apertureY = lens.y.mul(apertureRadiusMm);
    const imageVector = imagePointUsed.sub(lensCenterMm);
    const finiteDenominator = dot(imageVector, film.normal);
    const safeFiniteDenominator = select(abs(finiteDenominator).greaterThan(1e-7), finiteDenominator, 1);
    const rayParameter = dot(filmDelta, film.normal).div(safeFiniteDenominator);
    const mapFiniteOffset = (apertureOffset: Node<"vec3">) => apertureOffset
      .sub(imageVector.mul(dot(apertureOffset, film.normal).div(safeFiniteDenominator)))
      .mul(float(1).sub(rayParameter));
    const mapParallelOffset = (apertureOffset: Node<"vec3">) => apertureOffset
      .sub(imageDirection.mul(dot(apertureOffset, film.normal).div(safeFilmDenominator)));
    const mappedX = select(finiteImage, mapFiniteOffset(apertureX), mapParallelOffset(apertureX));
    const mappedY = select(finiteImage, mapFiniteOffset(apertureY), mapParallelOffset(apertureY));
    const matrix00 = dot(mappedX, film.x);
    const matrix10 = dot(mappedX, film.y);
    const matrix01 = dot(mappedY, film.x);
    const matrix11 = dot(mappedY, film.y);
    const covariance00 = matrix00.mul(matrix00).add(matrix01.mul(matrix01));
    const covariance01 = matrix00.mul(matrix10).add(matrix01.mul(matrix11));
    const covariance11 = matrix10.mul(matrix10).add(matrix11.mul(matrix11));
    const traceHalf = covariance00.add(covariance11).mul(0.5);
    const discriminant = length(vec2(covariance00.sub(covariance11).mul(0.5), covariance01));
    const majorRadiusMm = sqrt(max(0, traceHalf.add(discriminant)));
    const minorRadiusMm = sqrt(max(0, traceHalf.sub(discriminant)));
    const orientationVector = vec2(covariance01.mul(2), covariance00.sub(covariance11));
    const orientationVectorDefined = length(orientationVector).greaterThan(1e-12);
    const orientationPrincipalRad = atan(
      select(orientationVectorDefined, orientationVector.x, 0),
      select(orientationVectorDefined, orientationVector.y, 1),
    ).mul(0.5);
    const orientationDefined = majorRadiusMm.sub(minorRadiusMm).greaterThan(1e-7).and(orientationVectorDefined);
    const orientationRad = select(orientationDefined, orientationPrincipalRad, 0);
    const orientationNormalized = select(orientationDefined, fract(orientationRad.div(Math.PI)), 0);
    const imagePlaneDeltaMm = dot(imagePoint.sub(filmPointMm), film.normal);
    const finiteSide = select(
      abs(imagePlaneDeltaMm).greaterThan(1e-7),
      select(imagePlaneDeltaMm.lessThan(0), -1, 1),
      0,
    );
    const signedSide = select(parallelImageLimit, -1, finiteSide);
    const signedCoCDiameterMm = signedSide.mul(2).mul(sqrt(max(0, majorRadiusMm.mul(minorRadiusMm))));
    const geometryValid = lens.valid
      .and(film.valid)
      .and(objectDistanceMm.greaterThan(1e-7))
      .and(focalLengthMm.greaterThan(0))
      .and(apertureFNumber.greaterThan(0))
      .and(sampledFilmWidthMm.greaterThan(0))
      .and(sampledFilmHeightMm.greaterThan(0))
      .and(length(imageDirectionInput).greaterThan(1e-7))
      .and(centerFilmDistance.greaterThan(1e-14))
      .and(abs(filmDenominator).greaterThan(1e-7));
    const storageRepresentable = abs(signedCoCDiameterMm).lessThanEqual(65504)
      .and(majorRadiusMm.lessThanEqual(65504))
      .and(minorRadiusMm.lessThanEqual(65504))
      .and(orientationNormalized.greaterThanEqual(0))
      .and(orientationNormalized.lessThanEqual(1));
    const depthValid = sampledDepth.lessThan(1);
    const unresolved = depthValid.and(geometryValid).and(focalBranchResolved.not());
    const forcedUnresolved = forceUnresolvedMask.greaterThan(0.5)
      .and(uv().x.greaterThan(0.49)).and(uv().x.lessThan(0.51))
      .and(uv().y.greaterThan(0.49)).and(uv().y.lessThan(0.51));
    const code = select(
      depthValid,
      select(geometryValid, select(focalBranchResolved, select(storageRepresentable, 1, 2), 4), 3),
      0,
    );
    const validityCode = select(forcedUnresolved.or(unresolved), 4, code);
    const validStore = validityCode.equal(1);
    const storedFootprint = vec4(
      select(validStore, signedCoCDiameterMm, 0),
      select(validStore, majorRadiusMm, 0),
      select(validStore, minorRadiusMm, 0),
      select(validStore, orientationNormalized, 0),
    );
    const worldPositionDiagnostic = vec4(worldPositionMm, sampledDepth);
    const physicalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    physicalMaterial.outputNode = storedFootprint;
    const validityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    validityMaterial.outputNode = vec4(validityCode.div(255), 0, 0, 1);
    const worldMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    worldMaterial.outputNode = worldPositionDiagnostic;
    const physicalScene = new THREE.Scene();
    const validityScene = new THREE.Scene();
    const worldScene = new THREE.Scene();
    physicalScene.add(new THREE.Mesh(postGeometry, physicalMaterial));
    validityScene.add(new THREE.Mesh(postGeometry, validityMaterial));
    worldScene.add(new THREE.Mesh(postGeometry, worldMaterial));
    register(`${evidence.instanceId}:physical-material`, "physical-coc-tsl-material", () => physicalMaterial.dispose());
    register(`${evidence.instanceId}:validity-material`, "validity-tsl-material", () => validityMaterial.dispose());
    register(`${evidence.instanceId}:world-material`, "world-position-tsl-diagnostic-material", () => worldMaterial.dispose());

    const projectionInverse = uniform(camera.projectionMatrixInverse.clone());
    const maximumRadiusPx = uniform(0);
    const sampleCount = uniform(0);
    const textureUvTop = vec2(uv().x, uv().y.oneMinus());
    const validCodeAt = (sourceUv: Node<"vec2">) => {
      const codeValue = texture(validityTarget.texture, sourceUv).r;
      return codeValue.greaterThan(0.5 / 255).and(codeValue.lessThan(1.5 / 255));
    };
    const physicalAt = (sourceUv: Node<"vec2">) => texture(cocTarget.texture, sourceUv);
    const depthAt = (sourceUv: Node<"vec2">) => texture(sourceTarget.depthTexture!, sourceUv).r;
    const colorAt = (sourceUv: Node<"vec2">) => texture(sourceTarget.texture, sourceUv).rgb;
    const axesToPixels = (physical: Node<"vec4">) => {
      const angle = physical.a.mul(Math.PI);
      const safeFilmWidthMm = max(sampledFilmWidthMm, 1e-6);
      const safeFilmHeightMm = max(sampledFilmHeightMm, 1e-6);
      const major = vec2(
        cos(angle).mul(physical.g).mul(sourceWidthUniform).div(safeFilmWidthMm),
        sin(angle).mul(-1).mul(physical.g).mul(sourceHeightUniform).div(safeFilmHeightMm),
      );
      const minor = vec2(
        sin(angle).mul(-1).mul(physical.b).mul(sourceWidthUniform).div(safeFilmWidthMm),
        cos(angle).mul(-1).mul(physical.b).mul(sourceHeightUniform).div(safeFilmHeightMm),
      );
      const gramA = dot(major, major);
      const gramB = dot(minor, minor);
      const gramC = dot(major, minor);
      const traceHalf = gramA.add(gramB).mul(0.5);
      const discriminant = length(vec2(gramA.sub(gramB).mul(0.5), gramC));
      const maximumEllipseRadiusPx = sqrt(max(0, traceHalf.add(discriminant)));
      const scale = select(
        maximumEllipseRadiusPx.greaterThan(0),
        min(1, max(0, maximumRadiusPx).div(max(maximumEllipseRadiusPx, 1e-12))),
        1,
      );
      return {
        major,
        minor,
        maximumEllipseRadiusPx,
        scale,
        maximumClampedEllipseRadiusPx: maximumEllipseRadiusPx.mul(scale),
      };
    };
    const gatherRadiusDiagnosticsTarget = makeTarget(WIDTH, HEIGHT, {});
    register(`${evidence.instanceId}:gather-radius-diagnostics-target`, "rgba16float-gpu-gather-radius-diagnostics-target", () => gatherRadiusDiagnosticsTarget.dispose());
    const gatherRadiusDiagnosticsMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    gatherRadiusDiagnosticsMaterial.outputNode = Fn(() => {
      const axes = axesToPixels(physicalAt(textureUvTop));
      return vec4(
        axes.maximumEllipseRadiusPx,
        axes.scale,
        axes.maximumClampedEllipseRadiusPx,
        maximumRadiusPx,
      );
    })();
    const gatherRadiusDiagnosticsScene = new THREE.Scene();
    gatherRadiusDiagnosticsScene.add(new THREE.Mesh(postGeometry, gatherRadiusDiagnosticsMaterial));
    register(`${evidence.instanceId}:gather-radius-diagnostics-material`, "native-tsl-gather-radius-diagnostics-material", () => gatherRadiusDiagnosticsMaterial.dispose());
    const distanceMmAt = (sourceUv: Node<"vec2">, depth: Node<"float">) =>
      abs(getViewPosition(sourceUv, depth, projectionInverse).z).mul(1000);
    const depthToleranceAt = (distance: Node<"float">) => max(20, distance.mul(0.015));
    const determinant = (major: Node<"vec2">, minor: Node<"vec2">, scale: Node<"float">) =>
      major.mul(scale).x.mul(minor.mul(scale).y).sub(major.mul(scale).y.mul(minor.mul(scale).x));
    const footprintWeight = (
      offsetPx: Node<"vec2">,
      major: Node<"vec2">,
      minor: Node<"vec2">,
      scale: Node<"float">,
    ) => {
      const majorScaled = major.mul(scale);
      const minorScaled = minor.mul(scale);
      const det = determinant(majorScaled, minorScaled, float(1));
      const safeDet = select(abs(det).greaterThan(1e-6), det, 1);
      const localX = offsetPx.x.mul(minorScaled.y).sub(offsetPx.y.mul(minorScaled.x)).div(safeDet);
      const localY = offsetPx.y.mul(majorScaled.x).sub(offsetPx.x.mul(majorScaled.y)).div(safeDet);
      const radius = length(vec2(localX, localY));
      const edge = float(1).sub(smoothstep(1, 1.02, radius));
      return select(abs(det).greaterThan(1e-6), edge, 0);
    };

    const createGatherMaterial = (layer: "far" | "near") => {
      const node = Fn(() => {
        const sourceUv = textureUvTop;
        const centerColor = colorAt(sourceUv);
        const centerPhysical = physicalAt(sourceUv);
        const centerValid = validCodeAt(sourceUv);
        const centerSignedCoC = centerPhysical.r;
        const centerDepth = depthAt(sourceUv);
        const centerDistance = distanceMmAt(sourceUv, centerDepth);
        const centerNear = centerValid.and(centerSignedCoC.lessThan(-0.00001));
        const centerFar = centerValid.and(centerSignedCoC.greaterThan(0.00001));
        const activeSamples = max(sampleCount, 1);
        const colorAccum = vec3(0).toVar();
        const weightAccum = float(0).toVar();
        const coverageMass = float(0).toVar();
        if (layer === "far") {
          const centerAxes = axesToPixels(centerPhysical);
          const centerMajor = centerAxes.major.mul(centerAxes.scale);
          const centerMinor = centerAxes.minor.mul(centerAxes.scale);
          const centerContribution = select(centerFar, 1, 0);
          colorAccum.assign(centerColor.mul(centerContribution));
          weightAccum.assign(centerContribution);
          Loop({ start: int(0), end: int(APERTURE_GATHER_CASES.maxApertureSamples) }, ({ i }) => {
            const index = float(i);
            const radial = sqrt(index.add(0.5).div(activeSamples));
            const angle = index.add(0.5).mul(GOLDEN_ANGLE);
            const disk = radial.mul(vec2(cos(angle), sin(angle)));
            const offsetPx = centerMajor.mul(disk.x).add(centerMinor.mul(disk.y));
            const sampleUv = clamp(
              sourceUv.add(vec2(offsetPx.x.div(sourceWidthUniform), offsetPx.y.div(sourceHeightUniform))),
              vec2(0),
              vec2(1),
            );
            const samplePhysical = physicalAt(sampleUv);
            const sampleDepth = depthAt(sampleUv);
            const sampleDistance = distanceMmAt(sampleUv, sampleDepth);
            const sampleCoc = samplePhysical.r;
            const sampleValid = validCodeAt(sampleUv).and(sampleDepth.lessThan(1));
            const depthOk = sampleDistance.greaterThanEqual(centerDistance.sub(depthToleranceAt(centerDistance)));
            const accepted = centerFar
              .and(sampleValid)
              .and(sampleCoc.greaterThanEqual(-0.00001))
              .and(depthOk)
              .and(index.lessThan(sampleCount));
            const weight = select(accepted, 1, 0);
            colorAccum.addAssign(colorAt(sampleUv).mul(weight));
            weightAccum.addAssign(weight);
          });
          const gathered = select(weightAccum.greaterThan(1e-6), colorAccum.div(max(weightAccum, 1e-6)), centerColor);
          return vec4(gathered, 1);
        }

        const centerForeground = centerNear;
        const centerWeight = select(centerNear, 1, 0);
        colorAccum.assign(centerColor.mul(centerWeight));
        weightAccum.assign(centerWeight);
        Loop({ start: int(0), end: int(APERTURE_GATHER_CASES.maxApertureSamples) }, ({ i }) => {
          const index = float(i);
          const radial = sqrt(index.add(0.5).div(activeSamples));
          const angle = index.add(0.5).mul(GOLDEN_ANGLE);
          const disk = radial.mul(vec2(cos(angle), sin(angle)));
          const proposalOffsetPx = disk.mul(maximumRadiusPx);
          const sampleUv = clamp(
            sourceUv.add(vec2(proposalOffsetPx.x.div(sourceWidthUniform), proposalOffsetPx.y.div(sourceHeightUniform))),
            vec2(0),
            vec2(1),
          );
          const samplePhysical = physicalAt(sampleUv);
          const sampleDepth = depthAt(sampleUv);
          const sampleDistance = distanceMmAt(sampleUv, sampleDepth);
          const sampleCoc = samplePhysical.r;
          const sampleValid = validCodeAt(sampleUv).and(sampleDepth.lessThan(1));
          const sampleAxes = axesToPixels(samplePhysical);
          const member = footprintWeight(proposalOffsetPx, sampleAxes.major, sampleAxes.minor, sampleAxes.scale);
          const behindNearCenter = centerNear.not().or(
            sampleDistance.lessThanEqual(centerDistance.add(depthToleranceAt(centerDistance))),
          );
          const accepted = sampleValid
            .and(sampleCoc.lessThan(-0.00001))
            .and(member.greaterThan(0))
            .and(behindNearCenter)
            .and(index.lessThan(sampleCount));
          const weight = select(accepted, member, 0);
          colorAccum.addAssign(colorAt(sampleUv).mul(weight));
          weightAccum.addAssign(weight);
          const area = abs(determinant(sampleAxes.major, sampleAxes.minor, sampleAxes.scale));
          const areaRatio = clamp(area.div(max(maximumRadiusPx.mul(maximumRadiusPx), 1e-6)), 0, 1);
          const areaFloor = float(1).div(activeSamples);
          const compensation = min(activeSamples, float(1).div(max(areaRatio, areaFloor)));
          coverageMass.addAssign(weight.mul(compensation));
        });
        const nearColor = select(weightAccum.greaterThan(1e-6), colorAccum.div(max(weightAccum, 1e-6)), vec3(0));
        const estimatedCoverage = float(1).sub(exp(coverageMass.div(activeSamples).mul(-1)));
        const coverage = select(centerForeground, 1, clamp(estimatedCoverage, 0, 1));
        return vec4(nearColor, coverage);
      })();
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.outputNode = node;
      return material;
    };
    const farMaterial = createGatherMaterial("far");
    const nearMaterial = createGatherMaterial("near");
    register(`${evidence.instanceId}:far-gather-material`, "native-tsl-far-gather-material", () => farMaterial.dispose());
    register(`${evidence.instanceId}:near-gather-material`, "native-tsl-near-gather-material", () => nearMaterial.dispose());
    const farScene = new THREE.Scene();
    const nearScene = new THREE.Scene();
    farScene.add(new THREE.Mesh(postGeometry, farMaterial));
    nearScene.add(new THREE.Mesh(postGeometry, nearMaterial));

    const farTarget = makeTarget(WIDTH, HEIGHT, {});
    const nearTarget = makeTarget(WIDTH, HEIGHT, {});
    const compositeTarget = makeTarget(WIDTH, HEIGHT, {});
    register(`${evidence.instanceId}:far-gather-target`, "rgba16float-far-gather-target", () => farTarget.dispose());
    register(`${evidence.instanceId}:near-gather-target`, "rgba16float-near-gather-and-coverage-target", () => nearTarget.dispose());
    register(`${evidence.instanceId}:composite-target`, "rgba16float-research-composite-target", () => compositeTarget.dispose());

    const compositeNode = Fn(() => {
      const sourceUv = textureUvTop;
      const farColor = texture(farTarget.texture, sourceUv).rgb;
      const nearValue = texture(nearTarget.texture, sourceUv);
      const alpha = clamp(nearValue.a, 0, 1);
      return vec4(farColor.mul(float(1).sub(alpha)).add(nearValue.rgb.mul(alpha)), 1);
    })();
    const compositeMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    compositeMaterial.outputNode = compositeNode;
    register(`${evidence.instanceId}:composite-material`, "native-tsl-near-far-composite-material", () => compositeMaterial.dispose());
    const compositeScene = new THREE.Scene();
    compositeScene.add(new THREE.Mesh(postGeometry, compositeMaterial));
    const displayMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    displayMaterial.colorNode = texture(compositeTarget.texture, vec2(uv().x, uv().y.oneMinus()));
    register(`${evidence.instanceId}:display-material`, "native-tsl-diagnostic-display-material", () => displayMaterial.dispose());
    const displayScene = new THREE.Scene();
    displayScene.add(new THREE.Mesh(postGeometry, displayMaterial));

    const phaseHResources = phaseHStudyEnabled
      ? (() => {
        if (!phaseHSourceIdentityTarget
            || !phaseHGatherProvenanceTarget
            || !phaseHSelectedProvenanceTarget
            || !phaseHCandidateFarTarget
            || !phaseHCandidateCompositeTarget) {
          throw new Error("Phase H diagnostic targets were not allocated");
        }
        const sourceIdentityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        sourceIdentityMaterial.outputNode = Fn(() => vec4(
          floor(textureUvTop.x.mul(sourceWidthUniform)),
          floor(textureUvTop.y.mul(sourceHeightUniform)),
          0,
          1,
        ))();
        const sourceIdentityScene = new THREE.Scene();
        sourceIdentityScene.add(new THREE.Mesh(postGeometry, sourceIdentityMaterial));
        register(`${evidence.instanceId}:phase-h-source-identity-material`, "native-tsl-phase-h-source-identity-material", () => sourceIdentityMaterial.dispose());

        const gatherProvenanceMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        const sourceIdentity = texture(phaseHSourceIdentityTarget.texture, textureUvTop);
        gatherProvenanceMaterial.outputNode = Fn(() => vec4(
          floor(uv().x.mul(phaseHGatherWidthUniform)),
          floor(uv().y.oneMinus().mul(phaseHGatherHeightUniform)),
          sourceIdentity.r,
          sourceIdentity.g,
        ))();
        const gatherProvenanceScene = new THREE.Scene();
        gatherProvenanceScene.add(new THREE.Mesh(postGeometry, gatherProvenanceMaterial));
        register(`${evidence.instanceId}:phase-h-gather-provenance-material`, "native-tsl-phase-h-gather-provenance-material", () => gatherProvenanceMaterial.dispose());

        const selectedProvenanceMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        selectedProvenanceMaterial.outputNode = texture(phaseHGatherProvenanceTarget.texture, textureUvTop);
        const selectedProvenanceScene = new THREE.Scene();
        selectedProvenanceScene.add(new THREE.Mesh(postGeometry, selectedProvenanceMaterial));
        register(`${evidence.instanceId}:phase-h-selected-provenance-material`, "native-tsl-phase-h-selected-provenance-material", () => selectedProvenanceMaterial.dispose());

        const compatibleFarNode = Fn(() => {
          const provenance = texture(phaseHGatherProvenanceTarget.texture, textureUvTop);
          const centerUv = vec2(
            provenance.b.add(0.5).div(sourceWidthUniform),
            provenance.a.add(0.5).div(sourceHeightUniform),
          );
          const centerCode = texture(validityTarget.texture, centerUv).r;
          const centerCoc = texture(cocTarget.texture, centerUv).r;
          const centerValid = centerCode.greaterThan(0.5 / 255).and(centerCode.lessThan(1.5 / 255));
          const centerCompatible = centerValid.and(centerCoc.greaterThan(0.00001));
          const selectedPathCode = select(
            centerCompatible,
            1,
            0,
          );
          const compatible = select(
            centerCompatible,
            texture(farTarget.texture, textureUvTop).rgb,
            colorAt(textureUvTop),
          );
          return vec4(compatible, selectedPathCode);
        })();
        const candidateFarMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        candidateFarMaterial.outputNode = compatibleFarNode;
        const candidateFarScene = new THREE.Scene();
        candidateFarScene.add(new THREE.Mesh(postGeometry, candidateFarMaterial));
        register(`${evidence.instanceId}:phase-h-compatible-far-material`, "native-tsl-phase-h-compatible-far-material", () => candidateFarMaterial.dispose());

        let surfaceAwareFarScene: THREE.Scene | null = null;
        if (phaseIStudyEnabled) {
          const surfaceAwareFarNode = Fn(() => {
            const sourceSelection = texture(phaseHSelectedProvenanceTarget.texture, textureUvTop);
            const selectedGatherPixel = floor(sourceSelection.rg);
            const destinationPhysical = physicalAt(textureUvTop);
            const destinationDepth = depthAt(textureUvTop);
            const destinationFar = validCodeAt(textureUvTop)
              .and(destinationPhysical.r.greaterThan(0.00001))
              .and(destinationDepth.lessThan(1));
            const destinationDistance = distanceMmAt(textureUvTop, destinationDepth);
            const accumulated = vec3(0).toVar();
            const acceptedWeightSum = float(0).toVar();
            const acceptedNeighborCount = float(0).toVar();

            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
              for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                const neighborPixel = selectedGatherPixel.add(vec2(offsetX, offsetY));
                const inBounds = neighborPixel.x.greaterThanEqual(0)
                  .and(neighborPixel.y.greaterThanEqual(0))
                  .and(neighborPixel.x.lessThan(phaseHGatherWidthUniform))
                  .and(neighborPixel.y.lessThan(phaseHGatherHeightUniform));
                const gatherUv = vec2(
                  neighborPixel.x.add(0.5).div(phaseHGatherWidthUniform),
                  neighborPixel.y.add(0.5).div(phaseHGatherHeightUniform),
                );
                const provenance = texture(phaseHGatherProvenanceTarget.texture, gatherUv);
                const centerUv = vec2(
                  provenance.b.add(0.5).div(sourceWidthUniform),
                  provenance.a.add(0.5).div(sourceHeightUniform),
                );
                const centerPhysical = physicalAt(centerUv);
                const centerDepth = depthAt(centerUv);
                const centerValidFar = validCodeAt(centerUv)
                  .and(centerPhysical.r.greaterThan(0.00001))
                  .and(centerDepth.lessThan(1));
                const centerDistance = distanceMmAt(centerUv, centerDepth);
                const depthCompatible = abs(centerDistance.sub(destinationDistance))
                  .lessThanEqual(depthToleranceAt(destinationDistance));
                const eligible = destinationFar.and(inBounds).and(centerValidFar).and(depthCompatible);
                const weight = select(eligible, float(phaseISpatialWeight(offsetX, offsetY)), 0);
                const color = texture(farTarget.texture, gatherUv).rgb;
                accumulated.addAssign(color.mul(weight));
                acceptedWeightSum.addAssign(weight);
                acceptedNeighborCount.addAssign(select(eligible, 1, 0));
              }
            }
            const reconstructed = select(
              acceptedWeightSum.greaterThan(0),
              accumulated.div(max(acceptedWeightSum, 1e-6)),
              colorAt(textureUvTop),
            );
            const baseline = texture(farTarget.texture, textureUvTop).rgb;
            const halfResolution = phaseHGatherWidthUniform.lessThan(sourceWidthUniform);
            const outputFar = select(halfResolution, select(destinationFar, reconstructed, baseline), baseline);
            const packedDiagnostics = acceptedNeighborCount.add(acceptedWeightSum.div(10));
            const diagnosticCode = select(
              halfResolution,
              select(destinationFar, packedDiagnostics, -1),
              -2,
            );
            return vec4(outputFar, diagnosticCode);
          })();
          const surfaceAwareFarMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
          surfaceAwareFarMaterial.outputNode = surfaceAwareFarNode;
          surfaceAwareFarScene = new THREE.Scene();
          surfaceAwareFarScene.add(new THREE.Mesh(postGeometry, surfaceAwareFarMaterial));
          register(`${evidence.instanceId}:phase-i-surface-aware-far-material`, "native-tsl-phase-i-surface-aware-far-material", () => surfaceAwareFarMaterial.dispose());
        }

        const candidateCompositeMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        const candidateNear = texture(nearTarget.texture, textureUvTop);
        const candidateFar = texture(phaseHCandidateFarTarget.texture, textureUvTop).rgb;
        const candidateAlpha = clamp(candidateNear.a, 0, 1);
        candidateCompositeMaterial.outputNode = vec4(
          candidateFar.mul(float(1).sub(candidateAlpha)).add(candidateNear.rgb.mul(candidateAlpha)),
          1,
        );
        const candidateCompositeScene = new THREE.Scene();
        candidateCompositeScene.add(new THREE.Mesh(postGeometry, candidateCompositeMaterial));
        register(`${evidence.instanceId}:phase-h-candidate-composite-material`, "native-tsl-phase-h-candidate-composite-material", () => candidateCompositeMaterial.dispose());

        const candidateDisplayMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
        candidateDisplayMaterial.colorNode = texture(phaseHCandidateCompositeTarget.texture, textureUvTop);
        const candidateDisplayScene = new THREE.Scene();
        candidateDisplayScene.add(new THREE.Mesh(postGeometry, candidateDisplayMaterial));
        register(`${evidence.instanceId}:phase-h-candidate-display-material`, "native-tsl-phase-h-candidate-display-material", () => candidateDisplayMaterial.dispose());

        return {
          sourceIdentityScene,
          gatherProvenanceScene,
          selectedProvenanceScene,
          candidateFarScene,
          surfaceAwareFarScene,
          candidateCompositeScene,
          candidateDisplayScene,
          sourceIdentityTarget: phaseHSourceIdentityTarget,
          gatherProvenanceTarget: phaseHGatherProvenanceTarget,
          selectedProvenanceTarget: phaseHSelectedProvenanceTarget,
          candidateFarTarget: phaseHCandidateFarTarget,
          candidateCompositeTarget: phaseHCandidateCompositeTarget,
        };
      })()
      : null;

    const backend = renderer.backend as unknown as {
      device?: GPUDevice;
      get?: (resource: unknown) => unknown;
    };
    const resourceFormat = (value: THREE.Texture) => {
      const backendResource = backend.get?.(value) as {
        texture?: { format?: string };
        textureDescriptorGPU?: { format?: string };
      } | undefined;
      return backendResource?.texture?.format ?? backendResource?.textureDescriptorGPU?.format ?? null;
    };
    const recordPass = (id: string, error: unknown = null) => {
      evidence.passes.push({ id, state: error ? "failed" : "completed", error: error ? errorMessage(error) : null });
      signal();
    };
    const waitForPassCompletion = async (
      id: string,
      startedAt: number,
      submittedAt: number,
      stageTimings: StageTiming[],
    ) => {
      const queue = backend.device?.queue;
      if (queue) await queue.onSubmittedWorkDone();
      const completedAt = performance.now();
      stageTimings.push({
        stage: id,
        cpuSubmissionTimeMs: submittedAt - startedAt,
        observedQueueCompletionMs: queue ? completedAt - startedAt : null,
        queueWaitAfterSubmissionMs: queue ? completedAt - submittedAt : null,
      });
      recordPass(id);
      return completedAt;
    };
    const renderScene = () => {
      renderer.setRenderTarget(sourceTarget);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    };
    const renderPhysical = () => {
      renderer.setRenderTarget(cocTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(physicalScene, postCamera);
      renderer.setRenderTarget(validityTarget);
      renderer.clear(true, false, false);
      renderer.render(validityScene, postCamera);
      renderer.setRenderTarget(worldTarget);
      renderer.clear(true, false, false);
      renderer.render(worldScene, postCamera);
    };
    const qualitySettings = (mode: QualityMode, input: {
      gatherScale?: number;
      sampleCount?: number;
      maximumCoCRadiusPx?: number;
    }) => {
      const profile = getRenderQualitySettings(mode === "low" ? "low" : "standard");
      return {
        gatherScale: input.gatherScale ?? (mode === "stress-64" ? 1 : profile.gatherScale),
        sampleCount: input.sampleCount ?? (mode === "stress-64" ? APERTURE_GATHER_CASES.maxApertureSamples : profile.sampleCount),
        maximumCoCRadiusPx: input.maximumCoCRadiusPx ?? Math.min(profile.maximumCoCRadiusPx, 12),
      };
    };
    let currentApertureFNumber: number = APERTURE_GATHER_CASES.apertureFNumber;
    let currentFilmTiltDeg = 0;
    let currentCrop = false;
    let currentFocusOffsetMm = 0;
    let currentEdgeCase: PhaseHEdgeCase = "axis-aligned";
    const phaseIReferenceFarRasters = new Map<string, Float32Array>();
    const render = (input: {
      operationKind: OperationEvidence["kind"];
      quality?: QualityMode;
      apertureFNumber?: number;
      filmTiltDeg?: number;
      focusOffsetMm?: number;
      crop?: boolean;
      forceUnresolved?: boolean;
      gatherScale?: number;
      sampleCount?: number;
      maximumCoCRadiusPx?: number;
      sourceWidthPx?: number;
      sourceHeightPx?: number;
      scene?: StudyScene;
      candidate?: boolean;
      displayCandidate?: boolean;
      phaseI?: boolean;
      displayPhaseI?: boolean;
      edgeCase?: PhaseHEdgeCase;
      holdReadback?: boolean;
      failureStage?: FailureStage;
    } = { operationKind: "render" }) => {
      if (retired) throw new Error(`Cannot queue work on retired renderer ${evidence.instanceId}`);
      const operation: OperationEvidence = {
        operationId: `${evidence.instanceId}:op-${evidence.operations.length + 1}`,
        kind: input.operationKind,
        state: "accepted",
        stage: "operation-accepted",
        acceptedAt: performance.now(),
        completedAt: null,
        resultPublished: false,
        readbackStarted: false,
        readbackOutcome: "not-started",
        error: null,
        appliedState: null,
        timing: null,
      };
      evidence.operations.push(operation);
      signal();
      const execute = async () => {
        if (retired) {
          operation.state = "retired";
          operation.stage = "retired-before-execution";
          operation.completedAt = performance.now();
          signal();
          return;
        }
        operation.state = "running";
        operation.stage = "scene-color-depth";
        const operationStartedAt = performance.now();
        const stageTimings: StageTiming[] = [];
        let readbackWallTimeMs: number | null = null;
        let renderTargetResizeWallTimeMs = 0;
        signal();
        try {
          evidence.passes = [];
          const settings = qualitySettings(input.quality ?? "standard", input);
          if (![0.5, 1].includes(settings.gatherScale)
              || !Number.isInteger(settings.sampleCount)
              || settings.sampleCount < 1
              || settings.sampleCount > APERTURE_GATHER_CASES.maxApertureSamples
              || !Number.isFinite(settings.maximumCoCRadiusPx)
              || settings.maximumCoCRadiusPx <= 0
              || settings.maximumCoCRadiusPx > 64) {
            throw new RangeError("Phase G gather settings are outside the bounded study matrix");
          }
          const previousSourceSize = `${sourceWidthPx}x${sourceHeightPx}`;
          sourceWidthPx = input.sourceWidthPx ?? sourceWidthPx;
          sourceHeightPx = input.sourceHeightPx ?? sourceHeightPx;
          if (!Number.isInteger(sourceWidthPx) || !Number.isInteger(sourceHeightPx)
              || sourceWidthPx < WIDTH || sourceHeightPx < HEIGHT
              || sourceWidthPx > 512 || sourceHeightPx > 384
              || sourceWidthPx / sourceHeightPx !== WIDTH / HEIGHT) {
            throw new RangeError("Phase G source dimensions must be 4:3 integer sizes from 128×96 through 512×384");
          }
          currentStudyScene = input.scene ?? currentStudyScene;
          currentEdgeCase = input.edgeCase ?? currentEdgeCase;
          if (nearForegroundMesh) {
            nearForegroundMesh.rotation.z = currentEdgeCase === "diagonal"
              ? Math.PI / 4
              : currentEdgeCase === "vertical" ? Math.PI / 2 : 0;
            nearForegroundMesh.scale.x = currentEdgeCase === "thin" ? 0.22 : 1;
          }
          const controlledSceneVisible = currentStudyScene === "phase-f-controlled";
          for (const object of sceneObjects) object.mesh.visible = controlledSceneVisible;
          const multipleFarDepthMesh = sceneObjects.find((object) => object.id === "second-far-depth-feature")?.mesh;
          if (multipleFarDepthMesh) multipleFarDepthMesh.visible = controlledSceneVisible && currentEdgeCase === "multiple-far-depths";
          if (architectureProxy) architectureProxy.visible = currentStudyScene === "architecture-rise-geometry-proxy";
          if (interiorProxy) interiorProxy.visible = currentStudyScene === "interior-corner-geometry-proxy";
          evidence.sceneProvenance = currentStudyScene === "phase-f-controlled"
            ? { scenarioId: currentStudyScene, geometrySource: "Phase F four-plane controlled scene", placementAdaptation: "none", proxyScale: 1, canonicalOpticsReused: false }
            : currentStudyScene === "architecture-rise-geometry-proxy"
              ? { scenarioId: currentStudyScene, geometrySource: "createArchitectureRiseGroup + ARCHITECTURE_RISE_PRESENTATION", placementAdaptation: "uniform-scale-and-recenter", proxyScale: architectureProxyScale, canonicalOpticsReused: false }
              : { scenarioId: currentStudyScene, geometrySource: "createInteriorCornerGroup + INTERIOR_CORNER_PRESENTATION", placementAdaptation: "uniform-scale-and-recenter", proxyScale: interiorProxyScale, canonicalOpticsReused: false };
          const resizeStartedAt = performance.now();
          const setTargetSize = (target: THREE.RenderTarget, width: number, height: number) => {
            if (target.width === width && target.height === height) return;
            target.setSize(width, height);
            evidence.targetResizeCount += 1;
          };
          if (previousSourceSize !== `${sourceWidthPx}x${sourceHeightPx}`) {
            renderer.setSize(sourceWidthPx, sourceHeightPx, false);
            setTargetSize(sourceTarget, sourceWidthPx, sourceHeightPx);
            setTargetSize(cocTarget, sourceWidthPx, sourceHeightPx);
            setTargetSize(validityTarget, sourceWidthPx, sourceHeightPx);
            setTargetSize(worldTarget, sourceWidthPx, sourceHeightPx);
            setTargetSize(gatherRadiusDiagnosticsTarget, sourceWidthPx, sourceHeightPx);
            setTargetSize(compositeTarget, sourceWidthPx, sourceHeightPx);
            if (phaseHResources) {
              setTargetSize(phaseHResources.sourceIdentityTarget, sourceWidthPx, sourceHeightPx);
              setTargetSize(phaseHResources.selectedProvenanceTarget, sourceWidthPx, sourceHeightPx);
              setTargetSize(phaseHResources.candidateFarTarget, sourceWidthPx, sourceHeightPx);
              setTargetSize(phaseHResources.candidateCompositeTarget, sourceWidthPx, sourceHeightPx);
            }
            sourceWidthUniform.value = sourceWidthPx;
            sourceHeightUniform.value = sourceHeightPx;
          }
          const gatherWidth = Math.max(1, Math.floor(sourceWidthPx * settings.gatherScale));
          const gatherHeight = Math.max(1, Math.floor(sourceHeightPx * settings.gatherScale));
          setTargetSize(farTarget, gatherWidth, gatherHeight);
          setTargetSize(nearTarget, gatherWidth, gatherHeight);
          if (phaseHResources) setTargetSize(phaseHResources.gatherProvenanceTarget, gatherWidth, gatherHeight);
          phaseHGatherWidthUniform.value = gatherWidth;
          phaseHGatherHeightUniform.value = gatherHeight;
          renderTargetResizeWallTimeMs = performance.now() - resizeStartedAt;
          const memoryEstimate = estimateGatherTargetMemory(
            { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
            { widthPx: gatherWidth, heightPx: gatherHeight },
          );
          evidence.targetMemoryEstimate = {
            ...memoryEstimate,
            includes: [
              "source RGBA16F color",
              "depth estimate at 4 bytes per pixel",
              "physical RGBA16F CoC/ellipse",
              "RGBA8 validity",
              "RGBA32F world-position diagnostic",
              "RGBA16F gather-radius diagnostic",
              "RGBA16F composite",
              "RGBA16F far and near gather targets",
              ...(phaseHResources ? [
                "Phase H RGBA32F source identity, gather provenance and selected-provenance targets",
                "Phase H RGBA16F compatible-far and candidate-composite targets",
              ] : []),
            ],
          };
          if (input.apertureFNumber !== undefined) currentApertureFNumber = input.apertureFNumber;
          if (input.filmTiltDeg !== undefined) currentFilmTiltDeg = input.filmTiltDeg;
          if (input.focusOffsetMm !== undefined) currentFocusOffsetMm = input.focusOffsetMm;
          if (input.crop !== undefined) currentCrop = input.crop;
          const crop = currentCrop;
          camera.clearViewOffset();
          if (crop) camera.setViewOffset(
            sourceWidthPx,
            sourceHeightPx,
            sourceWidthPx * 40 / WIDTH,
            sourceHeightPx * 22 / HEIGHT,
            sourceWidthPx / 4,
            sourceHeightPx / 4,
          );
          camera.coordinateSystem = renderer.coordinateSystem;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
          physicalProjectionInverse.value.copy(camera.projectionMatrixInverse);
          physicalCameraWorld.value.copy(camera.matrixWorld);
          projectionInverse.value.copy(camera.projectionMatrixInverse);
          sampledFilmWidthMm.value = crop ? APERTURE_GATHER_CASES.fullFilmWidthMm / 4 : APERTURE_GATHER_CASES.fullFilmWidthMm;
          sampledFilmHeightMm.value = crop ? APERTURE_GATHER_CASES.fullFilmHeightMm / 4 : APERTURE_GATHER_CASES.fullFilmHeightMm;
          apertureFNumber.value = currentApertureFNumber;
          filmPointMm.value.set(
            APERTURE_GATHER_CASES.filmPointMm[0],
            APERTURE_GATHER_CASES.filmPointMm[1],
            APERTURE_GATHER_CASES.filmPointMm[2] + currentFocusOffsetMm,
          );
          forceUnresolvedMask.value = input.forceUnresolved ? 1 : 0;
          const tilt = currentFilmTiltDeg * Math.PI / 180;
          filmNormalInput.value.set(0, -Math.sin(tilt), Math.cos(tilt));
          filmBasisXInput.value.set(1, 0, 0);
          filmBasisYInput.value.set(0, Math.cos(tilt), Math.sin(tilt));
          maximumRadiusPx.value = settings.maximumCoCRadiusPx;
          sampleCount.value = settings.sampleCount;
          const appliedFilmNormal = filmNormalInput.value.toArray() as [number, number, number];
          const appliedFilmBasisX = filmBasisXInput.value.toArray() as [number, number, number];
          const appliedFilmBasisY = filmBasisYInput.value.toArray() as [number, number, number];
          const cameraView = camera.view;
          operation.appliedState = {
            reconstructionVariant: input.phaseI ? "C1" : input.candidate ? "B1" : "B0",
            scene: currentStudyScene,
            edgeCase: currentEdgeCase,
            filmTiltDeg: Math.atan2(-appliedFilmNormal[1], appliedFilmNormal[2]) * 180 / Math.PI,
            filmNormal: appliedFilmNormal,
            filmBasisX: appliedFilmBasisX,
            filmBasisY: appliedFilmBasisY,
            crop: cameraView?.enabled === true,
            cameraView: cameraView ? {
              enabled: cameraView.enabled,
              fullWidth: cameraView.fullWidth,
              fullHeight: cameraView.fullHeight,
              offsetX: cameraView.offsetX,
              offsetY: cameraView.offsetY,
              width: cameraView.width,
              height: cameraView.height,
            } : null,
            sampledFilmWidthMm: sampledFilmWidthMm.value,
            sampledFilmHeightMm: sampledFilmHeightMm.value,
            focusOffsetMm: filmPointMm.value.z - APERTURE_GATHER_CASES.filmPointMm[2],
            apertureFNumber: apertureFNumber.value,
            sourceWidthPx: sourceTarget.width,
            sourceHeightPx: sourceTarget.height,
            farGatherWidthPx: farTarget.width,
            farGatherHeightPx: farTarget.height,
            gatherScale: farTarget.width / sourceTarget.width,
            quality: input.quality ?? "standard",
            sampleCount: sampleCount.value,
            maximumCoCRadiusPx: maximumRadiusPx.value,
            forceUnresolved: forceUnresolvedMask.value > 0,
          };
          let stageStartedAt = performance.now();
          renderScene();
          let stageSubmittedAt = performance.now();
          await waitForPassCompletion("scene-color-depth", stageStartedAt, stageSubmittedAt, stageTimings);
          operation.stage = "physical-coc";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(cocTarget);
          renderPhysical();
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("physical-coc-and-validity", stageStartedAt, stageSubmittedAt, stageTimings);
          failAt(input.failureStage, "physical-coc");
          operation.stage = "gather-radius-diagnostics";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(gatherRadiusDiagnosticsTarget);
          renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
          renderer.setScissorTest(false);
          renderer.clear(true, false, false);
          renderer.render(gatherRadiusDiagnosticsScene, postCamera);
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("gather-radius-diagnostics", stageStartedAt, stageSubmittedAt, stageTimings);
          operation.stage = "far-gather";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(farTarget);
          renderer.setViewport(0, 0, farTarget.width, farTarget.height);
          renderer.setScissorTest(false);
          renderer.clear(true, false, false);
          renderer.render(farScene, postCamera);
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("far-gather", stageStartedAt, stageSubmittedAt, stageTimings);
          failAt(input.failureStage, "far-gather");
          if (phaseHResources) {
            operation.stage = "native-sampling-coordinate-diagnostics";
            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.sourceIdentityTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.setScissorTest(false);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.sourceIdentityScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-h-source-texel-identity", stageStartedAt, stageSubmittedAt, stageTimings);

            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.gatherProvenanceTarget);
            renderer.setViewport(0, 0, farTarget.width, farTarget.height);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.gatherProvenanceScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-h-gather-center-provenance", stageStartedAt, stageSubmittedAt, stageTimings);

            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.selectedProvenanceTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.selectedProvenanceScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-h-composite-selected-provenance", stageStartedAt, stageSubmittedAt, stageTimings);
          }
          operation.stage = "near-gather";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(nearTarget);
          renderer.setViewport(0, 0, nearTarget.width, nearTarget.height);
          renderer.clear(true, false, false);
          renderer.render(nearScene, postCamera);
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("near-gather", stageStartedAt, stageSubmittedAt, stageTimings);
          failAt(input.failureStage, "near-gather");
          operation.stage = "research-composite";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(compositeTarget);
          renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
          renderer.clear(true, false, false);
          renderer.render(compositeScene, postCamera);
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("research-composite", stageStartedAt, stageSubmittedAt, stageTimings);
          failAt(input.failureStage, "composite");
          if (phaseHResources && input.candidate) {
            operation.stage = "far-reconstruction-candidate";
            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.candidateFarTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.candidateFarScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-h-compatible-far-reconstruction", stageStartedAt, stageSubmittedAt, stageTimings);

            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.candidateCompositeTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.candidateCompositeScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-h-candidate-composite", stageStartedAt, stageSubmittedAt, stageTimings);
            failAt(input.failureStage, "far-reconstruction");
          }
          if (phaseHResources && input.phaseI) {
            if (!phaseHResources.surfaceAwareFarScene) {
              throw new Error("Phase I surface-aware reconstruction resources were not allocated");
            }
            operation.stage = "phase-i-surface-aware-far-reconstruction";
            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.candidateFarTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.surfaceAwareFarScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-i-surface-aware-far-reconstruction", stageStartedAt, stageSubmittedAt, stageTimings);

            stageStartedAt = performance.now();
            renderer.setRenderTarget(phaseHResources.candidateCompositeTarget);
            renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
            renderer.clear(true, false, false);
            renderer.render(phaseHResources.candidateCompositeScene, postCamera);
            stageSubmittedAt = performance.now();
            await waitForPassCompletion("phase-i-surface-aware-composite", stageStartedAt, stageSubmittedAt, stageTimings);
          }
          operation.stage = "display-pass";
          stageStartedAt = performance.now();
          renderer.setRenderTarget(null);
          renderer.setViewport(0, 0, sourceWidthPx, sourceHeightPx);
          renderer.clear(true, false, false);
          const displayCandidate = Boolean(
            phaseHResources
            && ((input.displayCandidate && input.candidate) || (input.displayPhaseI && input.phaseI)),
          );
          renderer.render(displayCandidate ? phaseHResources!.candidateDisplayScene : displayScene, postCamera);
          stageSubmittedAt = performance.now();
          await waitForPassCompletion("display-pass", stageStartedAt, stageSubmittedAt, stageTimings);
          failAt(input.failureStage, "readback");
          operation.stage = "native-readback";
          operation.readbackStarted = true;
          operation.readbackOutcome = "pending";
          signal();
          const readbackStartedAt = performance.now();
          const colorPromise = renderer.readRenderTargetPixelsAsync(sourceTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const physicalPromise = renderer.readRenderTargetPixelsAsync(cocTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const validityPromise = renderer.readRenderTargetPixelsAsync(validityTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const farPromise = renderer.readRenderTargetPixelsAsync(farTarget, 0, 0, farTarget.width, farTarget.height);
          const nearPromise = renderer.readRenderTargetPixelsAsync(nearTarget, 0, 0, nearTarget.width, nearTarget.height);
          const compositePromise = renderer.readRenderTargetPixelsAsync(compositeTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const worldPromise = renderer.readRenderTargetPixelsAsync(worldTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const gatherRadiusDiagnosticsPromise = renderer.readRenderTargetPixelsAsync(gatherRadiusDiagnosticsTarget, 0, 0, sourceWidthPx, sourceHeightPx);
          const phaseHReadbacksPromise = phaseHResources
            ? Promise.all([
              renderer.readRenderTargetPixelsAsync(phaseHResources.sourceIdentityTarget, 0, 0, sourceWidthPx, sourceHeightPx),
              renderer.readRenderTargetPixelsAsync(phaseHResources.gatherProvenanceTarget, 0, 0, farTarget.width, farTarget.height),
              renderer.readRenderTargetPixelsAsync(phaseHResources.selectedProvenanceTarget, 0, 0, sourceWidthPx, sourceHeightPx),
              input.candidate || input.phaseI
                ? renderer.readRenderTargetPixelsAsync(phaseHResources.candidateFarTarget, 0, 0, sourceWidthPx, sourceHeightPx)
                : Promise.resolve(null),
              input.candidate || input.phaseI
                ? renderer.readRenderTargetPixelsAsync(phaseHResources.candidateCompositeTarget, 0, 0, sourceWidthPx, sourceHeightPx)
                : Promise.resolve(null),
            ])
            : Promise.resolve(null);
          let releaseHeld: (() => void) | null = null;
          const gate = input.holdReadback
            ? new Promise<void>((resolve) => { releaseHeld = resolve; store.releaseReadback = resolve; })
            : Promise.resolve();
          const [colorReadback, physicalReadback, validityReadback, farReadback, nearReadback, compositeReadback, worldReadback, gatherRadiusDiagnosticsReadback, phaseHReadbacks] = await Promise.all([
            Promise.all([colorPromise, gate]).then(([pixels]) => pixels),
            physicalPromise,
            validityPromise,
            farPromise,
            nearPromise,
            compositePromise,
            worldPromise,
            gatherRadiusDiagnosticsPromise,
            phaseHReadbacksPromise,
          ]);
          readbackWallTimeMs = performance.now() - readbackStartedAt;
          if (releaseHeld && retired) {
            operation.readbackOutcome = "succeeded";
            operation.state = "retired";
            operation.stage = "stale-readback-discarded";
            operation.resultPublished = false;
            store.releaseReadback = null;
            operation.completedAt = performance.now();
            signal();
            return;
          }
          if (!(colorReadback instanceof Uint16Array)
              || !(physicalReadback instanceof Uint16Array)
              || !(validityReadback instanceof Uint8Array)
              || !(farReadback instanceof Uint16Array)
              || !(nearReadback instanceof Uint16Array)
              || !(compositeReadback instanceof Uint16Array)
              || !(worldReadback instanceof Float32Array)
              || !(gatherRadiusDiagnosticsReadback instanceof Uint16Array)) {
            throw new Error("Native Phase F readback returned an unexpected typed-array representation");
          }
          if (phaseHResources && !phaseHReadbacks) {
            throw new Error("Phase H native sampling diagnostics were not read back");
          }
          operation.readbackOutcome = "succeeded";
          const red = (r: number, g: number, b: number) => r > 0.5 && g < 0.12 && b < 0.12;
          const yellow = (r: number, g: number, b: number) => r > 0.6 && g > 0.25 && b < 0.12;
          const rawRedPixelCount = countColor(colorReadback, red);
          const compositeRedPixelCount = countColor(compositeReadback, red);
          const rawYellowPixelCount = countColor(colorReadback, yellow);
          const compositeYellowPixelCount = countColor(compositeReadback, yellow);
          let validPhysicalPixelCount = 0;
          let noDepthPixelCount = 0;
          let invalidPhysicalPixelCount = 0;
          let unresolvedPixelCount = 0;
          let nearSidePixelCount = 0;
          let farSidePixelCount = 0;
          let maximumAbsSignedCoCMm = 0;
          let maximumPhysicalAxisMm = 0;
          let nonzeroNearAlphaPixels = 0;
          let farYellowSignalOutsideBluePixelCount = 0;
          let farYellowSignalOutsideBlueEnergy = 0;
          let nearRedSpreadOutsideSharpPixelCount = 0;
          let nearBlueBackgroundLeakPixelCount = 0;
          let farRedForegroundLeakPixelCount = 0;
          let compositeRedForegroundLeakPixelCount = 0;
          let compositeRedForegroundLeakEnergy = 0;
          let blueBackgroundPixelCount = 0;
          const foregroundMask = new Uint8Array(sourceWidthPx * sourceHeightPx);
          const farLeakMask = new Uint8Array(sourceWidthPx * sourceHeightPx);
          let farLeakEnergy = 0;
          let farReferenceProbeIndex: number | null = null;
          let nearReferenceProbeIndex: number | null = null;
          const gatherLookup = createSourceToGatherPixelCenterLookup(
            { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
            { widthPx: farTarget.width, heightPx: farTarget.height },
          );
          let unresolvedSampleIndex: number | null = null;
          for (let index = 0; index < sourceWidthPx * sourceHeightPx; index += 1) {
            const offset = index * 4;
            const code = validityReadback[offset] ?? 0;
            const cocMm = half(physicalReadback, offset);
            const majorMm = half(physicalReadback, offset + 1);
            const minorMm = half(physicalReadback, offset + 2);
            if (code === 1) {
              validPhysicalPixelCount += 1;
              if (cocMm < -0.00001) nearSidePixelCount += 1;
              if (cocMm > 0.00001) farSidePixelCount += 1;
              maximumAbsSignedCoCMm = Math.max(maximumAbsSignedCoCMm, Math.abs(cocMm));
              maximumPhysicalAxisMm = Math.max(maximumPhysicalAxisMm, majorMm, minorMm);
            } else if (code === 0) noDepthPixelCount += 1;
            else if (code === 4) {
              unresolvedPixelCount += 1;
              unresolvedSampleIndex ??= index;
            }
            else invalidPhysicalPixelCount += 1;
            const sourceX = index % sourceWidthPx;
            const sourceY = Math.floor(index / sourceWidthPx);
            const farOffset = (gatherLookup.y[sourceY]! * farTarget.width + gatherLookup.x[sourceX]!) * 4;
            const sourceR = half(colorReadback, offset);
            const sourceG = half(colorReadback, offset + 1);
            const sourceB = half(colorReadback, offset + 2);
            const farR = half(farReadback, farOffset);
            const farG = half(farReadback, farOffset + 1);
            const farB = half(farReadback, farOffset + 2);
            const sourceIsBlue = sourceB > 0.5 && sourceR < 0.15 && sourceG < 0.2;
            const sourceIsForegroundRed = red(sourceR, sourceG, sourceB);
            foregroundMask[index] = sourceIsForegroundRed ? 1 : 0;
            if (sourceIsBlue) blueBackgroundPixelCount += 1;
            const yellowSignal = Math.max(
              0,
              (farR - 0.025) * 0.925 + (farG - 0.08) * 0.54 + (farB - 0.85) * -0.825,
            );
            if (sourceIsBlue && yellowSignal > 0.02) {
              farYellowSignalOutsideBluePixelCount += 1;
              farYellowSignalOutsideBlueEnergy += yellowSignal;
              farReferenceProbeIndex ??= index;
            }
            const nearOffset = (gatherLookup.y[sourceY]! * nearTarget.width + gatherLookup.x[sourceX]!) * 4;
            const nearR = half(nearReadback, nearOffset);
            const nearG = half(nearReadback, nearOffset + 1);
            const nearB = half(nearReadback, nearOffset + 2);
            const nearA = half(nearReadback, nearOffset + 3);
            if (sourceIsBlue && red(farR, farG, farB)) {
              farRedForegroundLeakPixelCount += 1;
              farLeakMask[index] = 1;
              farLeakEnergy += Math.max(0, farR - sourceR);
            }
            const compositeR = half(compositeReadback, offset);
            const compositeG = half(compositeReadback, offset + 1);
            const compositeB = half(compositeReadback, offset + 2);
            if (sourceIsBlue && red(compositeR, compositeG, compositeB)) {
              compositeRedForegroundLeakPixelCount += 1;
              compositeRedForegroundLeakEnergy += Math.max(0, compositeR - sourceR);
            }
            if (sourceIsBlue && nearA > 0.02 && nearB > 0.5 && nearR < 0.15 && nearG < 0.2) {
              nearBlueBackgroundLeakPixelCount += 1;
            }
            if (!red(sourceR, sourceG, sourceB)
                && nearA > 0.02
                && red(nearR, nearG, nearB)) {
              nearRedSpreadOutsideSharpPixelCount += 1;
              nearReferenceProbeIndex ??= index;
            }
          }
          const distanceToForeground = new Uint32Array(sourceWidthPx * sourceHeightPx);
          distanceToForeground.fill(0xffffffff);
          for (let index = 0; index < foregroundMask.length; index += 1) {
            if (foregroundMask[index] === 1) distanceToForeground[index] = 0;
          }
          for (let y = 0; y < sourceHeightPx; y += 1) {
            for (let x = 0; x < sourceWidthPx; x += 1) {
              const index = y * sourceWidthPx + x;
              if (x > 0) distanceToForeground[index] = Math.min(distanceToForeground[index]!, distanceToForeground[index - 1]! + 1);
              if (y > 0) distanceToForeground[index] = Math.min(distanceToForeground[index]!, distanceToForeground[index - sourceWidthPx]! + 1);
            }
          }
          let farLeakDistanceSum = 0;
          let maximumFarLeakDistanceToForegroundPx = 0;
          for (let y = sourceHeightPx - 1; y >= 0; y -= 1) {
            for (let x = sourceWidthPx - 1; x >= 0; x -= 1) {
              const index = y * sourceWidthPx + x;
              if (x + 1 < sourceWidthPx) distanceToForeground[index] = Math.min(distanceToForeground[index]!, distanceToForeground[index + 1]! + 1);
              if (y + 1 < sourceHeightPx) distanceToForeground[index] = Math.min(distanceToForeground[index]!, distanceToForeground[index + sourceWidthPx]! + 1);
              if (farLeakMask[index] === 1) {
                farLeakDistanceSum += distanceToForeground[index]!;
                maximumFarLeakDistanceToForegroundPx = Math.max(maximumFarLeakDistanceToForegroundPx, distanceToForeground[index]!);
              }
            }
          }
          let farNativeTargetRedForegroundLeakPixelCount = 0;
          let farNativeTargetRedForegroundLeakEnergy = 0;
          for (let y = 0; y < farTarget.height; y += 1) {
            for (let x = 0; x < farTarget.width; x += 1) {
              const sourceX = Math.min(sourceWidthPx - 1, Math.floor((x + 0.5) * sourceWidthPx / farTarget.width));
              const sourceY = Math.min(sourceHeightPx - 1, Math.floor((y + 0.5) * sourceHeightPx / farTarget.height));
              const sourceOffset = (sourceY * sourceWidthPx + sourceX) * 4;
              const farOffset = (y * farTarget.width + x) * 4;
              const sourceColor = [
                half(colorReadback, sourceOffset),
                half(colorReadback, sourceOffset + 1),
                half(colorReadback, sourceOffset + 2),
              ];
              const farColor = [half(farReadback, farOffset), half(farReadback, farOffset + 1), half(farReadback, farOffset + 2)];
              if (sourceColor[2]! > 0.5 && sourceColor[0]! < 0.15 && sourceColor[1]! < 0.2
                  && red(farColor[0]!, farColor[1]!, farColor[2]!)) {
                farNativeTargetRedForegroundLeakPixelCount += 1;
                farNativeTargetRedForegroundLeakEnergy += Math.max(0, farColor[0]! - sourceColor[0]!);
              }
            }
          }
          for (let offset = 3; offset < nearReadback.length; offset += 4) {
            if (half(nearReadback, offset) > 0.02) nonzeroNearAlphaPixels += 1;
          }
          const quality = settings;
          evidence.dimensions = {
            sourceWidthPx,
            sourceHeightPx,
            physicalCocWidthPx: sourceWidthPx,
            physicalCocHeightPx: sourceHeightPx,
            farGatherWidthPx: farTarget.width,
            farGatherHeightPx: farTarget.height,
            nearGatherWidthPx: nearTarget.width,
            nearGatherHeightPx: nearTarget.height,
            compositeWidthPx: sourceWidthPx,
            compositeHeightPx: sourceHeightPx,
            sampledFilmWidthMm: sampledFilmWidthMm.value,
            sampledFilmHeightMm: sampledFilmHeightMm.value,
            focusOffsetMm: currentFocusOffsetMm,
            quality: input.quality ?? "standard",
            sampleCount: quality.sampleCount,
            maximumCoCRadiusPx: quality.maximumCoCRadiusPx,
            gatherScale: quality.gatherScale,
            scene: currentStudyScene,
          };
          evidence.metrics = {
            rawRedPixelCount,
            compositeRedPixelCount,
            nearSpreadPixelGain: compositeRedPixelCount - rawRedPixelCount,
            rawYellowPixelCount,
            compositeYellowPixelCount,
            farSpreadPixelGain: compositeYellowPixelCount - rawYellowPixelCount,
            farYellowSignalOutsideBluePixelCount,
            farYellowSignalOutsideBlueEnergy,
            nearRedSpreadOutsideSharpPixelCount,
            nearBlueBackgroundLeakPixelCount,
            farRedForegroundLeakPixelCount,
            farRedForegroundLeakEnergy: farLeakEnergy,
            farNativeTargetRedForegroundLeakPixelCount,
            farNativeTargetRedForegroundLeakEnergy,
            compositeRedForegroundLeakPixelCount,
            compositeRedForegroundLeakEnergy,
            blueBackgroundPixelCount,
            farRedForegroundLeakFraction: blueBackgroundPixelCount > 0 ? farRedForegroundLeakPixelCount / blueBackgroundPixelCount : 0,
            meanFarLeakDistanceToForegroundPx: farRedForegroundLeakPixelCount > 0 ? farLeakDistanceSum / farRedForegroundLeakPixelCount : 0,
            maximumFarLeakDistanceToForegroundPx,
            nonzeroNearAlphaPixels,
            validPhysicalPixelCount,
            noDepthPixelCount,
            invalidPhysicalPixelCount,
            unresolvedPixelCount,
            nearSidePixelCount,
            farSidePixelCount,
            maximumAbsSignedCoCMm,
            maximumPhysicalAxisMm,
          };
          const objectDefinitions = [
            { id: "near-red-foreground", worldPointM: [-0.075, -0.005, 0.32] as [number, number, number] },
            { id: "focused-green-target", worldPointM: [0.11, 0.015, 0.5] as [number, number, number] },
            { id: "far-yellow-feature", worldPointM: [0.07, 0.075, 0.7499] as [number, number, number] },
          ];
          evidence.pointProbes = objectDefinitions.map((definition) => {
            const ndc = new THREE.Vector3(...definition.worldPointM).project(camera);
            const x = Math.max(0, Math.min(sourceWidthPx - 1, Math.floor((ndc.x + 1) * 0.5 * sourceWidthPx)));
            const y = Math.max(0, Math.min(sourceHeightPx - 1, Math.floor((1 - ndc.y) * 0.5 * sourceHeightPx)));
            const read = (readbackY: number) => {
              const index = readbackY * sourceWidthPx + x;
              const offset = index * 4;
              const gatherOffset = (gatherLookup.y[readbackY]! * farTarget.width + gatherLookup.x[x]!) * 4;
              return {
                gpuDepth: worldReadback[offset + 3]!,
                worldPositionMm: [worldReadback[offset]!, worldReadback[offset + 1]!, worldReadback[offset + 2]!] as [number, number, number],
                physicalRgba16Float: [0, 1, 2, 3].map((channel) => half(physicalReadback, offset + channel)) as [number, number, number, number],
                sourceColor: [0, 1, 2].map((channel) => half(colorReadback, offset + channel)) as [number, number, number],
                farGatherRgba: [0, 1, 2, 3].map((channel) => half(farReadback, gatherOffset + channel)) as [number, number, number, number],
                nearGatherRgba: [0, 1, 2, 3].map((channel) => half(nearReadback, gatherOffset + channel)) as [number, number, number, number],
                compositeColor: [0, 1, 2].map((channel) => half(compositeReadback, offset + channel)) as [number, number, number],
                validityCode: validityReadback[offset]!,
              };
            };
            const top = read(y);
            const bottom = read(sourceHeightPx - 1 - y);
            const expectedPointMm = new THREE.Vector3(...definition.worldPointM).multiplyScalar(1000);
            const topErrorMm = new THREE.Vector3(...top.worldPositionMm).distanceTo(expectedPointMm);
            const bottomErrorMm = new THREE.Vector3(...bottom.worldPositionMm).distanceTo(expectedPointMm);
            const selected = topErrorMm <= bottomErrorMm
              ? { value: top, row: y, origin: "top" as const, errorMm: topErrorMm }
              : { value: bottom, row: sourceHeightPx - 1 - y, origin: "bottom" as const, errorMm: bottomErrorMm };
            return {
              id: definition.id,
              worldPointM: definition.worldPointM,
              pixelTopOrigin: { x, y },
              pixelReadbackOrigin: selected.origin,
              worldPositionErrorMm: selected.errorMm,
              ...selected.value,
            };
          });
          if (phaseHResources && phaseHReadbacks) {
            const [
              sourceIdentityRaw,
              gatherProvenanceRaw,
              selectedProvenanceRaw,
              candidateFarRaw,
              candidateCompositeRaw,
            ] = phaseHReadbacks as [
              Uint8Array | Uint16Array | Float32Array,
              Uint8Array | Uint16Array | Float32Array,
              Uint8Array | Uint16Array | Float32Array,
              Uint8Array | Uint16Array | Float32Array | null,
              Uint8Array | Uint16Array | Float32Array | null,
            ];
            if (!(sourceIdentityRaw instanceof Float32Array)
                || !(gatherProvenanceRaw instanceof Float32Array)
                || !(selectedProvenanceRaw instanceof Float32Array)
                || ((input.candidate || input.phaseI) && (!(candidateFarRaw instanceof Uint16Array)
                    || !(candidateCompositeRaw instanceof Uint16Array)))) {
              throw new Error("Phase H/I GPU readbacks returned an unexpected diagnostic or candidate representation");
            }
            const phaseDiagnostics = buildPhaseHDiagnostics({
              source: { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
              gather: { widthPx: farTarget.width, heightPx: farTarget.height },
              film: { widthMm: sampledFilmWidthMm.value, heightMm: sampledFilmHeightMm.value },
              sampleCount: settings.sampleCount,
              maximumCoCRadiusPx: settings.maximumCoCRadiusPx,
              cameraZMm: camera.position.z * 1000,
              edgeCase: currentEdgeCase,
              readbackOrigin: evidence.pointProbes[0]?.pixelReadbackOrigin ?? "bottom",
              colorsRaw: colorReadback,
              physicalRaw: physicalReadback,
              validityRaw: validityReadback,
              worldRaw: worldReadback,
              farRaw: farReadback,
              nearRaw: nearReadback,
              compositeRaw: compositeReadback,
              sourceIdentityRaw,
              gatherProvenanceRaw,
              selectedProvenanceRaw,
              candidateFarRaw: input.candidate && candidateFarRaw instanceof Uint16Array ? candidateFarRaw : null,
              candidateCompositeRaw: input.candidate && candidateCompositeRaw instanceof Uint16Array ? candidateCompositeRaw : null,
              phaseICandidateFarRaw: input.phaseI && candidateFarRaw instanceof Uint16Array ? candidateFarRaw : null,
              phaseICandidateCompositeRaw: input.phaseI && candidateCompositeRaw instanceof Uint16Array ? candidateCompositeRaw : null,
              phaseIEnabled: phaseIStudyEnabled,
              phaseIReferenceFarRasters,
              apertureFNumber: currentApertureFNumber,
              filmTiltDeg: currentFilmTiltDeg,
              focusOffsetMm: currentFocusOffsetMm,
              crop,
              scene: currentStudyScene,
              stageTimings,
            });
            evidence.phaseH = phaseDiagnostics;
            evidence.phaseI = (phaseDiagnostics.phaseI as Record<string, unknown> | null) ?? null;
          } else {
            evidence.phaseH = null;
            evidence.phaseI = null;
          }
          const patchRadius = Math.ceil(settings.maximumCoCRadiusPx) + 2;
          const readbackOrigin = evidence.pointProbes[0]?.pixelReadbackOrigin ?? "bottom";
          const buildGatherReferenceProbe = (
            layer: "far" | "near",
            readbackIndex: number | null,
          ): GatherReferenceProbe | null => {
            if (readbackIndex === null || farTarget.width !== sourceWidthPx || nearTarget.width !== sourceWidthPx) return null;
            const readbackY = Math.floor(readbackIndex / sourceWidthPx);
            const x = readbackIndex % sourceWidthPx;
            const y = readbackOrigin === "top" ? readbackY : sourceHeightPx - 1 - readbackY;
            const left = Math.max(0, x - patchRadius);
            const top = Math.max(0, y - patchRadius);
            const right = Math.min(sourceWidthPx - 1, x + patchRadius);
            const bottom = Math.min(sourceHeightPx - 1, y + patchRadius);
            const patchWidth = right - left + 1;
            const patchHeight = bottom - top + 1;
            const colors: Array<[number, number, number]> = [];
            const physical: Array<[number, number, number, number]> = [];
            const validity: number[] = [];
            const worldAndDepth: Array<[number, number, number, number]> = [];
            for (let patchY = top; patchY <= bottom; patchY += 1) {
              const sourceReadbackY = readbackOrigin === "top" ? patchY : sourceHeightPx - 1 - patchY;
              for (let patchX = left; patchX <= right; patchX += 1) {
                const index = sourceReadbackY * sourceWidthPx + patchX;
                const offset = index * 4;
                colors.push([
                  half(colorReadback, offset),
                  half(colorReadback, offset + 1),
                  half(colorReadback, offset + 2),
                ]);
                physical.push([
                  half(physicalReadback, offset),
                  half(physicalReadback, offset + 1),
                  half(physicalReadback, offset + 2),
                  half(physicalReadback, offset + 3),
                ]);
                validity.push(validityReadback[offset] ?? 0);
                worldAndDepth.push([
                  worldReadback[offset] ?? 0,
                  worldReadback[offset + 1] ?? 0,
                  worldReadback[offset + 2] ?? 0,
                  worldReadback[offset + 3] ?? 1,
                ]);
              }
            }
            const output = layer === "far" ? farReadback : nearReadback;
            const outputY = readbackOrigin === "top" ? y : sourceHeightPx - 1 - y;
            const outputOffset = (outputY * sourceWidthPx + x) * 4;
            return {
              layer,
              x,
              y,
              source: { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
              film: { widthMm: sampledFilmWidthMm.value, heightMm: sampledFilmHeightMm.value },
              sampleCount: settings.sampleCount,
              maximumCoCRadiusPx: settings.maximumCoCRadiusPx,
              cameraZMm: camera.position.z * 1000,
              patch: {
                left,
                top,
                width: patchWidth,
                height: patchHeight,
                colors,
                physical,
                validity,
                worldAndDepth,
              },
              actualRgba: [0, 1, 2, 3].map((channel) => half(output, outputOffset + channel)) as [number, number, number, number],
            };
          };
          evidence.gatherReferenceProbes = [
            buildGatherReferenceProbe("far", farReferenceProbeIndex),
            buildGatherReferenceProbe("near", nearReferenceProbeIndex),
          ].filter((probe): probe is GatherReferenceProbe => probe !== null);
          const diagnosticPixelReadbackIndex = farReferenceProbeIndex
            ?? (Math.floor(sourceHeightPx / 2) * sourceWidthPx + Math.floor(sourceWidthPx / 2));
          const diagnosticOffset = diagnosticPixelReadbackIndex * 4;
          const physicalMajorRadiusMm = half(physicalReadback, diagnosticOffset + 1);
          const physicalMinorRadiusMm = half(physicalReadback, diagnosticOffset + 2);
          const physicalOrientationRad = half(physicalReadback, diagnosticOffset + 3) * Math.PI;
          const physicalEllipse = mapPhysicalEllipseToSourcePixels(
            physicalMajorRadiusMm,
            physicalMinorRadiusMm,
            physicalOrientationRad,
            { widthMm: sampledFilmWidthMm.value, heightMm: sampledFilmHeightMm.value },
            { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
          );
          const cpuMaximumRadiusPx = maximumPixelEllipseRadius(physicalEllipse);
          const cpuClampedEllipse = clampPixelEllipse(physicalEllipse, quality.maximumCoCRadiusPx);
          const firstApertureProposal = goldenAngleDiskSample(0, quality.sampleCount);
          evidence.sampleDiagnostics = {
            referencePixelRole: farReferenceProbeIndex === null ? "center-pixel-fallback" : "far-gather-probe",
            pixelReadbackIndex: diagnosticPixelReadbackIndex,
            physicalMajorRadiusMm,
            physicalMinorRadiusMm,
            physicalOrientationRad,
            pixelMajorVectorPx: [...physicalEllipse.major],
            pixelMinorVectorPx: [...physicalEllipse.minor],
            cpuReference: {
              maximumTransformedEllipseRadiusPx: cpuMaximumRadiusPx,
              rendererMaximumRadiusPx: quality.maximumCoCRadiusPx,
              clampScale: cpuClampedEllipse.clampScale,
              maximumClampedEllipseRadiusPx: cpuMaximumRadiusPx * cpuClampedEllipse.clampScale,
              firstApertureProposal: [...firstApertureProposal],
              firstTransformedFarSampleOffsetPx: [...orientedSampleOffsetPx(firstApertureProposal, cpuClampedEllipse)],
              sampleCount: quality.sampleCount,
            },
            gpu: {
              maximumTransformedEllipseRadiusPx: half(gatherRadiusDiagnosticsReadback, diagnosticOffset),
              clampScale: half(gatherRadiusDiagnosticsReadback, diagnosticOffset + 1),
              maximumClampedEllipseRadiusPx: half(gatherRadiusDiagnosticsReadback, diagnosticOffset + 2),
              rendererMaximumRadiusPx: half(gatherRadiusDiagnosticsReadback, diagnosticOffset + 3),
            },
          };
          if (unresolvedSampleIndex !== null) {
            const offset = unresolvedSampleIndex * 4;
            const readbackY = Math.floor(unresolvedSampleIndex / sourceWidthPx);
            const x = unresolvedSampleIndex % sourceWidthPx;
            const [farX, farY] = gatherTexelAtSourcePixelCenter(
              [x, readbackY],
              { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
              { widthPx: farTarget.width, heightPx: farTarget.height },
            );
            const [nearX, nearY] = gatherTexelAtSourcePixelCenter(
              [x, readbackY],
              { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
              { widthPx: nearTarget.width, heightPx: nearTarget.height },
            );
            const farOffset = (farY * farTarget.width + farX) * 4;
            const nearOffset = (nearY * nearTarget.width + nearX) * 4;
            evidence.unresolvedSample = {
              validityCode: validityReadback[offset] ?? 0,
              storedFootprint: [0, 1, 2, 3].map((channel) => half(physicalReadback, offset + channel)) as [number, number, number, number],
              sourceColor: [0, 1, 2].map((channel) => half(colorReadback, offset + channel)) as [number, number, number],
              farGather: [0, 1, 2, 3].map((channel) => half(farReadback, farOffset + channel)) as [number, number, number, number],
              nearGather: [0, 1, 2, 3].map((channel) => half(nearReadback, nearOffset + channel)) as [number, number, number, number],
            };
          } else evidence.unresolvedSample = null;
          evidence.formats = {
            sceneColor: { requested: "rgba16float", actual: resourceFormat(sourceTarget.texture) },
            sceneDepth: { requested: "DepthFormat/UnsignedIntType", actual: sourceTarget.depthTexture ? resourceFormat(sourceTarget.depthTexture) : null },
            physicalCoC: { requested: "rgba16float; R signed CoC mm, G/B ellipse radii mm, A orientation over pi", actual: resourceFormat(cocTarget.texture) },
            validity: { requested: "rgba8unorm; 0 no depth, 1 valid, 2 unrepresentable, 3 invalid, 4 unresolved", actual: resourceFormat(validityTarget.texture) },
            farGather: { requested: "rgba16float; linear color", actual: resourceFormat(farTarget.texture) },
            nearGather: { requested: "rgba16float; linear RGB and coverage alpha", actual: resourceFormat(nearTarget.texture) },
            gatherRadiusDiagnostics: { requested: "rgba16float; TSL max singular radius, clamp scale, clamped radius, radius cap", actual: resourceFormat(gatherRadiusDiagnosticsTarget.texture) },
            composite: { requested: "rgba16float; linear research composite", actual: resourceFormat(compositeTarget.texture) },
          };
          operation.stage = "readback-published";
          operation.resultPublished = true;
          operation.state = "completed";
          operation.completedAt = performance.now();
          operation.timing = {
            operationWallTimeMs: operation.completedAt - operationStartedAt,
            readbackWallTimeMs,
            renderTargetResizeWallTimeMs,
            stages: [...stageTimings],
            gpuTimestampDurationMs: null,
          };
          signal();
        } catch (error) {
          operation.state = "failed";
          operation.stage = operation.stage.includes("readback") ? "readback-failed" : `${operation.stage}-failed`;
          operation.error = errorMessage(error);
          evidence.error = operation.error;
          if (operation.readbackStarted) operation.readbackOutcome = "failed";
          operation.completedAt = performance.now();
          operation.timing = {
            operationWallTimeMs: operation.completedAt - operationStartedAt,
            readbackWallTimeMs,
            renderTargetResizeWallTimeMs,
            stages: [...stageTimings],
            gpuTimestampDurationMs: null,
          };
          signal();
        }
      };
      const task = operationChain.then(execute, execute);
      operationChain = task.then(() => undefined, () => undefined);
      pendingOperations.add(task);
      void task.finally(() => pendingOperations.delete(task));
      return operation.operationId;
    };

    const dispose = async () => {
      if (disposePromise) return disposePromise;
      retired = true;
      evidence.state = "retiring";
      evidence.resources.forEach((resource) => { if (resource.state === "active") resource.state = "disposal-requested"; });
      signal();
      disposePromise = (async () => {
        await Promise.allSettled([...pendingOperations]);
        for (let index = owned.length - 1; index >= 0; index -= 1) {
          const resource = evidence.resources.find((entry) => entry.id === owned[index]!.id);
          try {
            await owned[index]!.dispose();
            if (resource) resource.state = "disposed";
          } catch (error) {
            if (resource) {
              resource.state = "failed";
              resource.error = errorMessage(error);
            }
            evidence.cleanupError ??= errorMessage(error);
          }
        }
        evidence.state = evidence.resources.every((resource) => resource.state === "disposed") ? "disposed" : "failed";
        evidence.cleanupCompletedAt = performance.now();
        store.activeHandleId = null;
        signal();
      })();
      return disposePromise;
    };

    const startHeldReadback = () => render({ operationKind: "held-readback", holdReadback: true });
    const injectFailure = async (stage: FailureStage) => {
      const operationId = render({
        operationKind: "injected-failure",
        failureStage: stage,
        candidate: stage === "far-reconstruction",
      });
      await operationChain;
      await dispose();
      return operationId;
    };
    const handle: MountedHandle = {
      evidence,
      render: (input) => {
        const operationId = render({ operationKind: evidence.operations.length === 0 ? "initial-render" : "render", ...input });
        return operationChain.then(() => operationId);
      },
      startHeldReadback,
      injectFailure,
      dispose,
    };
    evidence.runtime = {
      ...resolveObserverRendererRuntime(renderer),
      applicationFallback: false,
      initialized: true,
      threeRevision: THREE.REVISION,
    };
    evidence.state = "active";
    store.activeHandleId = evidence.instanceId;
    store.status = "initialized";
    signal();
    await handle.render({ quality: "standard" });
    return handle;
  } catch (error) {
    evidence.state = "failed";
    evidence.error = errorMessage(error);
    for (let index = owned.length - 1; index >= 0; index -= 1) {
      const resource = evidence.resources.find((entry) => entry.id === owned[index]!.id);
      try {
        await owned[index]!.dispose();
        if (resource) resource.state = "disposed";
      } catch (cleanupError) {
        if (resource) {
          resource.state = "failed";
          resource.error = errorMessage(cleanupError);
        }
        evidence.cleanupError ??= errorMessage(cleanupError);
      }
    }
    store.status = "failed";
    signal();
    throw error;
  }
};

const Experiment = () => {
  const diagnosticsVersion = useDiagnosticsVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MountedHandle | null>(null);
  const [handle, setHandle] = useState<MountedHandle | null>(null);
  const [status, setStatus] = useState("initializing native renderer");
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void buildHandle(canvas).then((mounted) => {
      if (cancelled) {
        void mounted.dispose();
        return;
      }
      handleRef.current = mounted;
      setHandle(mounted);
      setStatus("ready");
    }).catch((error: unknown) => {
      setStatus(`failed: ${errorMessage(error)}`);
    });
    return () => {
      cancelled = true;
      const mounted = handleRef.current;
      handleRef.current = null;
      if (mounted) void mounted.dispose();
    };
  }, []);
  const queueRender = async (input: Parameters<MountedHandle["render"]>[0]) => {
    if (!handle) return;
    setStatus("render queued");
    await handle.render(input);
    setStatus(handle.evidence.operations.at(-1)?.state ?? "render complete");
  };
  const phaseIBenchmarkBase = {
    quality: "study",
    scene: "phase-f-controlled",
    apertureFNumber: 2,
    gatherScale: 0.5,
    sampleCount: 32,
    maximumCoCRadiusPx: 12,
    sourceWidthPx: WIDTH,
    sourceHeightPx: HEIGHT,
    edgeCase: "axis-aligned",
    filmTiltDeg: 0,
    crop: false,
    focusOffsetMm: 0,
    forceUnresolved: false,
    displayCandidate: false,
    displayPhaseI: false,
  } satisfies NonNullable<Parameters<MountedHandle["render"]>[0]>;
  const queuePhaseIBenchmark = (variant: PhaseIBenchmarkVariant) => queueRender({
    ...phaseIBenchmarkBase,
    candidate: variant === "B1",
    phaseI: variant === "C1",
  });
  return (
    <main>
      <h1>Native WebGPU physical aperture gather</h1>
      <p data-testid="fixture-status">{status}</p>
      <p>
        <Link to="/away">Navigate away (SPA)</Link>
      </p>
      <div className="fixture-layout">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Native WebGPU aperture gather composite" />
        <section aria-label="Phase F controls">
          <button type="button" onClick={() => void queueRender({ quality: "standard" })}>Standard gather</button>
          <button type="button" onClick={() => void queueRender({ quality: "low" })}>Low resolution gather</button>
          <button type="button" onClick={() => void queueRender({ quality: "stress-64" })}>64 sample gather</button>
          <button type="button" onClick={() => void queueRender({ apertureFNumber: 2 })}>Aperture f/2</button>
          <button type="button" onClick={() => void queueRender({ apertureFNumber: 1 })}>Aperture f/1</button>
          <button type="button" onClick={() => void queueRender({ filmTiltDeg: 12 })}>Tilt film 12 degrees</button>
          <button type="button" onClick={() => void queueRender({ filmTiltDeg: 0 })}>Until film</button>
          <button type="button" onClick={() => void queueRender({ focusOffsetMm: 1 })}>Shift focus plane +1mm</button>
          <button type="button" onClick={() => void queueRender({ focusOffsetMm: 0 })}>Reset focus plane</button>
          <button type="button" onClick={() => void queueRender({ crop: true })}>Off-center 4x crop</button>
          <button type="button" onClick={() => void queueRender({ crop: false })}>Full film</button>
          <button type="button" onClick={() => void queueRender({ forceUnresolved: true })}>Force unresolved diagnostic</button>
          <button type="button" onClick={() => void queueRender({ forceUnresolved: false })}>Clear unresolved diagnostic</button>
          <button type="button" onClick={() => { if (handle) { store.releaseReadback = null; handle.startHeldReadback(); } }}>Start held native readback</button>
          <button type="button" onClick={() => void handle?.injectFailure("physical-coc")}>Fail after physical CoC</button>
          <button type="button" onClick={() => void handle?.injectFailure("far-gather")}>Fail after far gather</button>
          <button type="button" onClick={() => void handle?.injectFailure("near-gather")}>Fail after near gather</button>
          <button type="button" onClick={() => void handle?.injectFailure("composite")}>Fail after composite</button>
          <button type="button" onClick={() => void handle?.injectFailure("readback")}>Fail before readback</button>
          {phaseGStudyEnabled && <fieldset data-testid="phase-g-controls">
            <legend>Phase G independent study controls</legend>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 16 })}>Full gather × 16</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 32 })}>Full gather × 32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 64 })}>Full gather × 64</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 0.5, sampleCount: 16 })}>Half gather × 16</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 0.5, sampleCount: 32 })}>Half gather × 32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 0.5, sampleCount: 64 })}>Half gather × 64</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 60, sourceWidthPx: 128, sourceHeightPx: 96, crop: false })}>Source 128 × 96</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 60, sourceWidthPx: 256, sourceHeightPx: 192, crop: false })}>Source 256 × 192</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 60, sourceWidthPx: 512, sourceHeightPx: 384, crop: false })}>Source 512 × 384</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 64, sourceWidthPx: 512, sourceHeightPx: 384, crop: true, apertureFNumber: 2, maximumCoCRadiusPx: 24 })}>512 crop / cap 24</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", gatherScale: 1, sampleCount: 64, sourceWidthPx: 512, sourceHeightPx: 384, crop: true, apertureFNumber: 2, maximumCoCRadiusPx: 60 })}>512 crop / cap 60</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", sourceWidthPx: 256, sourceHeightPx: 192, crop: false, scene: "architecture-rise-geometry-proxy" })}>Architecture Rise geometry proxy</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", sourceWidthPx: 256, sourceHeightPx: 192, crop: false, scene: "interior-corner-geometry-proxy" })}>Interior Corner geometry proxy</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", sourceWidthPx: 128, sourceHeightPx: 96, crop: false, scene: "phase-f-controlled" })}>Controlled planes</button>
          </fieldset>}
          {phaseHStudyEnabled && <fieldset data-testid="phase-h-controls">
            <legend>Phase H native reconstruction diagnostics</legend>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true })}>Phase H full ×32 A/B</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 16, maximumCoCRadiusPx: 12, candidate: true })}>Phase H half ×16 A/B</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true })}>Phase H half ×32 A/B</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 64, maximumCoCRadiusPx: 12, candidate: true })}>Phase H half ×64 A/B</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true, displayCandidate: true })}>Phase H show candidate half ×32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: false })}>Phase H benchmark baseline half ×32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true })}>Phase H benchmark candidate half ×32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true, edgeCase: "diagonal" })}>Phase H diagonal edge</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true, edgeCase: "thin" })}>Phase H thin foreground</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, candidate: true, edgeCase: "axis-aligned", filmTiltDeg: 12, crop: true })}>Phase H tilted off-center crop</button>
            <button type="button" onClick={() => void handle?.injectFailure("far-reconstruction")}>Phase H fail after reconstruction</button>
          </fieldset>}
          {phaseIStudyEnabled && <fieldset data-testid="phase-i-controls">
            <legend>Phase I reference and surface-aware reconstruction study</legend>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 16, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true })}>Phase I full ×16 CPU reference sensitivity</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned" })}>Phase I full ×32 B0 reference</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", candidate: true })}>Phase I full ×32 B1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true })}>Phase I full ×32 C1 passthrough</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned" })}>Phase I full ×64 B0 reference</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", candidate: true })}>Phase I full ×64 B1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 1, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true })}>Phase I full ×64 C1 passthrough</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 16, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned" })}>Phase I half ×16 B0</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 16, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", candidate: true })}>Phase I half ×16 B1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 16, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true })}>Phase I half ×16 C1</button>
            <button type="button" onClick={() => void queuePhaseIBenchmark("B0")}>Phase I half ×32 B0</button>
            <button type="button" onClick={() => void queuePhaseIBenchmark("B1")}>Phase I half ×32 B1</button>
            <button type="button" onClick={() => void queuePhaseIBenchmark("C1")}>Phase I half ×32 C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true, displayPhaseI: true })}>Phase I show C1 half ×32</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned" })}>Phase I half ×64 B0</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", candidate: true })}>Phase I half ×64 B1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 64, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", phaseI: true })}>Phase I half ×64 C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "vertical", phaseI: true })}>Phase I vertical edge C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "diagonal", phaseI: true })}>Phase I diagonal edge C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "thin", phaseI: true })}>Phase I thin foreground C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "multiple-far-depths", phaseI: true })}>Phase I multiple far depths C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", filmTiltDeg: 12, crop: true, phaseI: true })}>Phase I tilted 4× crop C1</button>
            <button type="button" onClick={() => void queueRender({ quality: "study", apertureFNumber: 2, gatherScale: 0.5, sampleCount: 32, maximumCoCRadiusPx: 12, edgeCase: "axis-aligned", forceUnresolved: true, phaseI: true })}>Phase I unresolved exclusion C1</button>
          </fieldset>}
        </section>
      </div>
      <pre data-testid="fixture-diagnostics" data-version={diagnosticsVersion}>{JSON.stringify({
        status: store.status,
        activeHandleId: store.activeHandleId,
        handles: store.handles,
      })}</pre>
    </main>
  );
};

const Away = () => {
  const diagnosticsVersion = useDiagnosticsVersion();
  return (
    <main>
      <h1>Phase F lifecycle diagnostics</h1>
      <p data-testid="away-route">GPU renderer host is unmounted on this route.</p>
      <Link to="/experiment">Return to experiment (SPA)</Link>
      <button type="button" onClick={() => store.releaseReadback?.()}>Release held readback</button>
      <pre data-testid="fixture-diagnostics" data-version={diagnosticsVersion}>{JSON.stringify({
        status: store.status,
        activeHandleId: store.activeHandleId,
        handles: store.handles,
      })}</pre>
    </main>
  );
};

const App = () => (
  <HashRouter>
    <Routes>
      <Route path="/experiment" element={<Experiment />} />
      <Route path="/away" element={<Away />} />
      <Route path="*" element={<Navigate to="/experiment" replace />} />
    </Routes>
  </HashRouter>
);

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 20px; color: #172033; background: #f4f6fa; }
  main { max-width: 1100px; margin: 0 auto; }
  .fixture-layout { display: grid; grid-template-columns: minmax(480px, 640px) 1fr; gap: 20px; align-items: start; }
  canvas { width: 640px; height: 480px; border: 1px solid #35425e; background: #000; image-rendering: pixelated; }
  section { display: grid; gap: 8px; }
  button, a { min-height: 36px; padding: 8px 12px; }
  pre { overflow: auto; max-height: 320px; background: #fff; padding: 12px; font-size: 11px; }
  @media (max-width: 800px) { .fixture-layout { grid-template-columns: 1fr; } canvas { width: min(100%, 640px); height: auto; } }
`;
document.head.append(style);
createRoot(document.getElementById("ground-glass-webgpu-aperture-gather")!).render(<App />);
