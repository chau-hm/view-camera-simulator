import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { GroundGlassCoverageState } from "../../types/optics";
import { calculateGroundGlassNaturalIlluminationGain } from "../../core/optics/groundGlassNaturalIllumination";
import { createGroundGlassPilotRetryState } from "../../render/backend/groundGlassBackendContracts";
import { selectGroundGlassBackend } from "../../render/backend/groundGlassBackendPolicy";
import {
  GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
  GROUND_GLASS_M6_PRESENTATION_FEATURES,
  groundGlassM6PilotSessionId,
  isGroundGlassM6BuildAuthorizedForFlags,
  isGroundGlassM6bFixtureBuildAuthorizedForFlags,
  isGroundGlassM6CapablePilotSessionForBuild,
  isGroundGlassM6PresentationRequestForBuild,
  isGroundGlassRawPilotBuildAuthorizedForFlags,
} from "../../render/webgpu/groundGlassM6PresentationPolicy";
import {
  encodeGroundGlassLinearChannelToSrgb,
  evaluateGroundGlassPresentationReference,
} from "../../render/webgpu/groundGlassPresentationReference";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import {
  calculateGroundGlassCoverageRenderGain,
  resolveGroundGlassCoverageRenderState,
} from "../../render/groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationRenderState } from "../../render/groundGlassNaturalIllumination";
import { createGroundGlassPresentationNode } from "../../render/webgpu/groundGlassPresentationNodes";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { createGroundGlassFrameRequest } from "../../render/groundGlassFrameRequest";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";
import { resolveGroundGlassRawWebGpuPilotSessionId } from "../../render/webgpu/groundGlassRawWebGpuPolicyInput";

const fullWindow = { active: false, centerU: 0.5, centerV: 0.5, widthFraction: 1, heightFraction: 1 };
const filmWindow = { centerXMm: 0, centerYMm: 0, widthMm: 127, heightMm: 101.6 };

const makeCoverage = (
  state: GroundGlassCoverageState,
  crop = fullWindow,
  rawDebug = false,
) => resolveGroundGlassCoverageRenderState({
    state,
    rawDebug,
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    inspectionWindow: crop,
    renderWidthPx: 1270,
    renderHeightPx: 1016,
  });

const makeNatural = (crop = fullWindow) => resolveGroundGlassNaturalIlluminationRenderState({
  state: {
    kind: "parallel-cos4",
    imageDistanceMm: 150,
    opticalAxisOffsetXMm: 8,
    opticalAxisOffsetYMm: -4,
  },
  rawDebug: false,
  filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
  filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
  inspectionWindow: crop,
});

const noCoverage = makeCoverage({ kind: "neutral", reason: "invalid-geometry" });
const noNatural = resolveGroundGlassNaturalIlluminationRenderState({
  state: { kind: "neutral", reason: "invalid-geometry" },
  rawDebug: false,
  filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
  filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
  inspectionWindow: fullWindow,
});

describe("M6 Ground Glass presentation reference", () => {
  it("keeps the actual M6 material opaque with Three.js r186's default NormalBlending contract", () => {
    const source = new THREE.DataTexture(
      new Float32Array([0.2, 0.4, 0.6, 0.35]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    source.colorSpace = THREE.NoColorSpace;
    const { material } = createGroundGlassPresentationNode(source, {
      previewMode: "upright",
      coverage: noCoverage,
      naturalIllumination: noNatural,
      throughputGain: 1,
    });
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.blending).toBe(THREE.NormalBlending);
    expect(material.alphaTest).toBe(0);
    expect(material.premultipliedAlpha).toBe(false);
    material.dispose();
    source.dispose();
  });

  it("maps asymmetric physical landmarks through the established Raw and Upright transforms", () => {
    const displayUv = { u: 0.17, v: 0.28 };
    const rawSource = applyGroundGlassRttDisplayTransform(
      displayUv,
      resolveGroundGlassRttDisplayTransform("raw"),
    );
    const uprightSource = applyGroundGlassRttDisplayTransform(
      displayUv,
      resolveGroundGlassRttDisplayTransform("upright"),
    );

    expect(rawSource).toEqual({ u: 0.83, v: 0.72 });
    expect(uprightSource).toEqual(displayUv);
    expect(rawSource).not.toEqual({ u: 1 - displayUv.u, v: displayUv.v });
    expect(rawSource).not.toEqual({ u: displayUv.u, v: 1 - displayUv.v });
    expect(rawSource.v).not.toBe(displayUv.v); // Detect a second/missing render-target V conversion.
  });

  it("keeps physical coverage attached to the source film point across orientation", () => {
    const shiftedCircle = {
      kind: "parallel-circle" as const,
      imageCircleRadiusMm: 28,
      opticalAxisOffsetXMm: 18,
      opticalAxisOffsetYMm: -7,
    };
    const coverage = makeCoverage(shiftedCircle);
    const raw = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.17, v: 0.28 },
      previewMode: "raw",
      filmWindow,
      coverage,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: ({ u, v }) => [u, v, u + v, 1],
    });
    const upright = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.83, v: 0.72 },
      previewMode: "upright",
      filmWindow,
      coverage,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: ({ u, v }) => [u, v, u + v, 1],
    });

    expect(raw.sourceUvTopOrigin).toEqual(upright.sourceUvTopOrigin);
    expect(raw.physicalFilmPointMm).toEqual(upright.physicalFilmPointMm);
    expect(raw.coverageGain).toBe(upright.coverageGain);
    expect(raw.inputLinearRgba).toEqual(upright.inputLinearRgba);
    expect(raw.coverageGain).toBe(
      calculateGroundGlassCoverageRenderGain(
        coverage,
        raw.physicalFilmPointMm.x,
        raw.physicalFilmPointMm.y,
      ),
    );
  });

  it.each([
    { label: "positive X", x: 12, y: 0 },
    { label: "negative X", x: -12, y: 0 },
    { label: "positive Y", x: 0, y: 12 },
    { label: "negative Y", x: 0, y: -12 },
    { label: "combined positive X and negative Y", x: 12, y: -9 },
    { label: "combined negative X and positive Y", x: -12, y: 9 },
  ])("matches canonical image-circle boundary and offset sign for $label", ({ x, y }) => {
    const coverage = makeCoverage({
      kind: "parallel-circle",
      imageCircleRadiusMm: 20,
      opticalAxisOffsetXMm: x,
      opticalAxisOffsetYMm: y,
    });
    const atOffsetCenter = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: {
        u: 0.5 + x / filmWindow.widthMm,
        v: 0.5 - y / filmWindow.heightMm,
      },
      previewMode: "upright",
      filmWindow,
      coverage,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: () => [0.3, 0.4, 0.5, 1],
    });
    const atBoundary = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: {
        u: 0.5 + (x + 20) / filmWindow.widthMm,
        v: 0.5 - y / filmWindow.heightMm,
      },
      previewMode: "upright",
      filmWindow,
      coverage,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: () => [0.3, 0.4, 0.5, 1],
    });
    const signReversed = makeCoverage({
      kind: "parallel-circle",
      imageCircleRadiusMm: 20,
      opticalAxisOffsetXMm: -x,
      opticalAxisOffsetYMm: -y,
    });
    const reversedControl = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: {
        u: 0.5 + x / filmWindow.widthMm,
        v: 0.5 - y / filmWindow.heightMm,
      },
      previewMode: "upright",
      filmWindow,
      coverage: signReversed,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: () => [0.3, 0.4, 0.5, 1],
    });

    expect(atOffsetCenter.coverageGain).toBe(1);
    expect(atBoundary.coverageGain).toBeCloseTo(0.5, 8);
    expect(reversedControl.coverageGain).toBe(0);
  });

  it("keeps a cropped physical film window fixed while display orientation changes", () => {
    const crop = { active: true, centerU: 0.72, centerV: 0.31, widthFraction: 0.25, heightFraction: 0.5 };
    const coverage = makeCoverage({ kind: "neutral", reason: "invalid-geometry" }, crop);
    const natural = makeNatural(crop);
    const result = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.5, v: 0.5 },
      previewMode: "raw",
      filmWindow: coverage.filmWindow,
      coverage,
      naturalIllumination: natural,
      throughputGain: 0.5,
      sampleSource: () => [0.4, 0.3, 0.2, 0.6],
    });
    expect(coverage.filmWindow.widthMm).toBeCloseTo(CAMERA_CONSTANTS.filmWidthMm * 0.25, 10);
    expect(coverage.filmWindow.heightMm).toBeCloseTo(CAMERA_CONSTANTS.filmHeightMm * 0.5, 10);
    expect(result.physicalFilmPointMm.x).toBeCloseTo(coverage.filmWindow.centerXMm, 10);
    expect(result.physicalFilmPointMm.y).toBeCloseTo(coverage.filmWindow.centerYMm, 10);
    expect(result.naturalIlluminationGain).toBe(
      calculateGroundGlassNaturalIlluminationGain(natural.geometry!, result.physicalFilmPointMm.x, result.physicalFilmPointMm.y),
    );
  });

  it("retains conic, shifted-circle, disabled-coverage and Raw Debug semantics", () => {
    const conic = makeCoverage({
      kind: "nonparallel-conic",
      quadratic: { a: 1, b: 0.2, c: 0.7, d: -4, e: 8, f: -30 },
      axial: { x: 0.2, y: -0.1, constant: 1 },
    });
    const point = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.63, v: 0.42 },
      previewMode: "upright",
      filmWindow,
      coverage: conic,
      naturalIllumination: noNatural,
      throughputGain: 1,
      sampleSource: () => [0.2, 0.4, 0.6, 0.8],
    });
    expect(point.coverageGain).toBe(
      calculateGroundGlassCoverageRenderGain(conic, point.physicalFilmPointMm.x, point.physicalFilmPointMm.y),
    );
    expect(noCoverage.active).toBe(false);
    expect(noCoverage.geometry).toBeNull();

    const debugCoverage = makeCoverage(
      { kind: "parallel-circle", imageCircleRadiusMm: 1, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
      fullWindow,
      true,
    );
    const rawDebugSemantics = resolveGroundGlassNaturalIlluminationRenderState({
      state: { kind: "parallel-cos4", imageDistanceMm: 10, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
      rawDebug: true,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
      inspectionWindow: fullWindow,
    });
    expect(debugCoverage.active).toBe(false);
    expect(debugCoverage.geometry).not.toBeNull();
    expect(rawDebugSemantics.enabled).toBe(false);
  });

  it("applies throughput, natural illumination and coverage once in linear light and encodes sRGB once", () => {
    const result = evaluateGroundGlassPresentationReference({
      displayUvTopOrigin: { u: 0.5, v: 0.5 },
      previewMode: "upright",
      filmWindow,
      coverage: noCoverage,
      naturalIllumination: noNatural,
      throughputGain: 0.5,
      sampleSource: () => [0.5, 0.25, 0.1, 0.7],
    });
    expect(result.outputLinearRgba).toEqual([0.25, 0.125, 0.05, 0.7]);
    expect(encodeGroundGlassLinearChannelToSrgb(0.5)).toBeCloseTo(0.735356983, 8);
    expect(encodeGroundGlassLinearChannelToSrgb(encodeGroundGlassLinearChannelToSrgb(0.5)))
      .toBeGreaterThan(encodeGroundGlassLinearChannelToSrgb(0.5));
    expect(result.outputLinearRgba[0]).not.toBe(0.5 * 0.5 * 0.5); // Detect duplicated throughput.
  });

  it("maps controlled linear color patches to the display transfer without clipping highlights", () => {
    expect(encodeGroundGlassLinearChannelToSrgb(0)).toBe(0);
    expect(encodeGroundGlassLinearChannelToSrgb(1)).toBeCloseTo(1, 12);
    expect(encodeGroundGlassLinearChannelToSrgb(0.5)).toBeCloseTo(0.735356983, 8);
    expect(encodeGroundGlassLinearChannelToSrgb(0.003)).toBeCloseTo(0.03876, 5);
    const saturatedRed = [
      encodeGroundGlassLinearChannelToSrgb(1),
      encodeGroundGlassLinearChannelToSrgb(0),
      encodeGroundGlassLinearChannelToSrgb(0),
    ];
    expect(saturatedRed[0]).toBeCloseTo(1, 12);
    expect(saturatedRed.slice(1)).toEqual([0, 0]);
    expect(encodeGroundGlassLinearChannelToSrgb(4)).toBeGreaterThan(1);
  });
});

const makeRequest = (options: import("./groundGlassFrameRequestFixtures").GroundGlassRequestFixtureOptions = {}) =>
  createGroundGlassFrameRequest(
    createGroundGlassRequestInput({ ...options, scene: options.scene ?? architectureRiseScene }),
    { requestId: "m6-request", channelId: "default", sceneId: options.scene?.id ?? architectureRiseScene.id },
  );

describe("M6 development-only compatibility policy", () => {
  it.each([
    { label: "both flags disabled", developmentBuild: true, rawPilotFlag: "false", m6PresentationFlag: "false", expected: false },
    { label: "Raw pilot only", developmentBuild: true, rawPilotFlag: "true", m6PresentationFlag: "false", expected: false },
    { label: "M6 flag only", developmentBuild: true, rawPilotFlag: "false", m6PresentationFlag: "true", expected: false },
    { label: "both flags enabled in development", developmentBuild: true, rawPilotFlag: "true", m6PresentationFlag: "true", expected: true },
    { label: "both flags enabled in production", developmentBuild: false, rawPilotFlag: "true", m6PresentationFlag: "true", expected: false },
  ])("requires the documented authorization combination: $label", (input) => {
    expect(isGroundGlassM6BuildAuthorizedForFlags(input)).toBe(input.expected);
  });

  it("preserves the M3-only Raw pilot gate when the M6 flag is absent", () => {
    const flags = { developmentBuild: true, rawPilotFlag: "true", m6PresentationFlag: "false" } as const;
    expect(isGroundGlassRawPilotBuildAuthorizedForFlags(flags)).toBe(true);
    expect(isGroundGlassM6BuildAuthorizedForFlags(flags)).toBe(false);
    expect(isGroundGlassRawPilotBuildAuthorizedForFlags({ ...flags, developmentBuild: false })).toBe(false);
  });

  it("keeps Raw Debug within the authorized M6 channel session without changing the M3 session", () => {
    expect(resolveGroundGlassRawWebGpuPilotSessionId("default", true))
      .toBe(groundGlassM6PilotSessionId("default"));
    expect(resolveGroundGlassRawWebGpuPilotSessionId("default", false))
      .toBe("ground-glass-raw-m3:default");
    expect(resolveGroundGlassRawWebGpuPilotSessionId("loupe", true))
      .not.toBe(groundGlassM6PilotSessionId("default"));
  });

  it("requires the trusted M6 build gate and exact Architecture Rise request identity", () => {
    const request = makeRequest();
    expect(isGroundGlassM6PresentationRequestForBuild(request, false)).toBe(false);
    expect(isGroundGlassM6PresentationRequestForBuild(request, true)).toBe(true);
    expect(isGroundGlassM6PresentationRequestForBuild(makeRequest({ rawDebug: true }), true)).toBe(false);
    expect(isGroundGlassM6PresentationRequestForBuild(
      makeRequest({ scene: understandingCameraMovementsScene }),
      true,
    )).toBe(false);
  });

  it("keeps the M6B fixture behind the dev seam, both M6 flags, exact scene identity, and explicit test control", () => {
    const flags = {
      developmentBuild: true,
      rawPilotFlag: "true",
      m6PresentationFlag: "true",
      testSeamFlag: "true",
    } as const;
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags(flags, true, architectureRiseScene)).toBe(true);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags({ ...flags, developmentBuild: false }, true, architectureRiseScene)).toBe(false);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags({ ...flags, testSeamFlag: "false" }, true, architectureRiseScene)).toBe(false);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags({ ...flags, m6PresentationFlag: "false" }, true, architectureRiseScene)).toBe(false);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags(flags, false, architectureRiseScene)).toBe(false);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags(flags, true, understandingCameraMovementsScene)).toBe(false);
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags(flags, true, {
      ...architectureRiseScene,
      bounds: {
        ...architectureRiseScene.bounds,
        max: { ...architectureRiseScene.bounds.max, x: architectureRiseScene.bounds.max.x + 1 },
      },
    })).toBe(false);
  });

  it("provisions an M6-capable session for an initial Raw request while keeping M6 execution request-scoped", () => {
    const rawRequest = makeRequest({ rawDebug: true });
    expect(isGroundGlassM6CapablePilotSessionForBuild(
      rawRequest,
      true,
      "webgpu",
      "webgpu",
    )).toBe(true);
    expect(isGroundGlassM6PresentationRequestForBuild(rawRequest, true)).toBe(false);
    expect(isGroundGlassM6CapablePilotSessionForBuild(
      rawRequest,
      true,
      "webgl",
      "webgpu",
    )).toBe(false);
    expect(isGroundGlassM6CapablePilotSessionForBuild(
      rawRequest,
      true,
      "webgpu",
      "webgl2",
    )).toBe(false);
    expect(isGroundGlassM6CapablePilotSessionForBuild(
      makeRequest({ rawDebug: true, scene: understandingCameraMovementsScene }),
      true,
      "webgpu",
      "webgpu",
    )).toBe(false);
  });

  it("authorizes only implementation-verified features while leaving optical quality unqualified", () => {
    const sessionId = groundGlassM6PilotSessionId("default");
    const selection = selectGroundGlassBackend({
      requestedBackend: "webgpu",
      environment: "development",
      authorization: { status: "authorized", source: "application-configuration", pilotSessionId: sessionId },
      channelId: "default",
      sceneId: architectureRiseScene.id,
      requestedFeatures: GROUND_GLASS_M6_PRESENTATION_FEATURES,
      sceneCompatibility: GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      expectedCandidateRendererRevision: "r186",
      capabilityPreflight: {
        webgpuAvailability: "reported-available",
        adapterFeatures: [],
        textureStorageFormats: [],
      },
      retryState: createGroundGlassPilotRetryState("default", sessionId),
      webglAvailable: true,
    });

    expect(selection).toMatchObject({
      status: "selected",
      selectedBackend: "webgpu",
      selectionReason: "authorized-development-webgpu-request",
    });
    expect(GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY.features.every((feature) =>
      feature.status === "implementation-verified" && feature.qualityQualification === "unqualified",
    )).toBe(true);
    expect(selection).not.toHaveProperty("rendererFamily");
    expect(selection).not.toHaveProperty("actualExecutionApi");
  });

  it("keeps unsupported scenes on WebGL even when the M6 build gate requests WebGPU", () => {
    const sessionId = groundGlassM6PilotSessionId("default");
    const selection = selectGroundGlassBackend({
      requestedBackend: "webgpu",
      environment: "development",
      authorization: { status: "authorized", source: "application-configuration", pilotSessionId: sessionId },
      channelId: "default",
      sceneId: understandingCameraMovementsScene.id,
      requestedFeatures: GROUND_GLASS_M6_PRESENTATION_FEATURES,
      sceneCompatibility: GROUND_GLASS_M6_PRESENTATION_COMPATIBILITY,
      expectedCandidateRendererRevision: "r186",
      capabilityPreflight: {
        webgpuAvailability: "reported-available",
        adapterFeatures: [],
        textureStorageFormats: [],
      },
      retryState: createGroundGlassPilotRetryState("default", sessionId),
      webglAvailable: true,
    });

    expect(selection).toMatchObject({
      status: "selected",
      selectedBackend: "webgl",
      selectionReason: "webgl-after-request-denial",
      policyDecision: { status: "denied" },
    });
  });
});
