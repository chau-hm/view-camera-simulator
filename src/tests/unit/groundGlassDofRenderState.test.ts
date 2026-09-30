import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createGroundGlassDofRenderState,
  type GroundGlassCameraProjectionSource,
} from "../../render/groundGlassDofRenderState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const opticsState = deriveOpticsState({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  activeSceneId: understandingCameraMovementsScene.id,
}, understandingCameraMovementsScene);

const validInverseProjection = Array.from({ length: 16 }, (_, index) => index + 0.25);
const validWorldMatrix = Array.from({ length: 16 }, (_, index) => index + 100.5);

const createCamera = (
  inverseProjectionMatrixElements: number[],
  worldMatrixElements: number[],
): GroundGlassCameraProjectionSource => ({
  projectionMatrixInverse: { elements: inverseProjectionMatrixElements },
  matrixWorld: { elements: worldMatrixElements },
});

const deriveState = (
  inverseProjectionMatrixElements = validInverseProjection,
  worldMatrixElements = validWorldMatrix,
) => createGroundGlassDofRenderState(
  opticsState,
  createCamera(inverseProjectionMatrixElements, worldMatrixElements),
  90,
  127,
  101.6,
  0.1,
  11,
  640,
  512,
  24,
);

describe("Ground Glass DOF camera matrix snapshots", () => {
  it("accepts and copies two finite 16-element matrices", () => {
    const inverseProjection = [...validInverseProjection];
    const worldMatrix = [...validWorldMatrix];
    const state = deriveState(inverseProjection, worldMatrix);

    inverseProjection[0] = -1;
    worldMatrix[0] = -1;

    expect(state.camera.inverseProjectionMatrixElements).toEqual(validInverseProjection);
    expect(state.camera.worldMatrixElements).toEqual(validWorldMatrix);
  });

  describe.each([
    ["inverse projection", "inverseProjectionMatrixElements", "Ground Glass inverse projection matrix"],
    ["world", "worldMatrixElements", "Ground Glass world matrix"],
  ] as const)("%s matrix", (_label, matrixName, errorPrefix) => {
    const deriveWithMatrix = (elements: number[]) => matrixName === "inverseProjectionMatrixElements"
      ? deriveState(elements, validWorldMatrix)
      : deriveState(validInverseProjection, elements);

    it.each([
      ["15 elements", validInverseProjection.slice(0, 15)],
      ["17 elements", [...validInverseProjection, 16.25]],
      ["NaN", validInverseProjection.map((value, index) => index === 7 ? Number.NaN : value)],
      ["positive Infinity", validInverseProjection.map((value, index) => index === 7 ? Number.POSITIVE_INFINITY : value)],
      ["negative Infinity", validInverseProjection.map((value, index) => index === 7 ? Number.NEGATIVE_INFINITY : value)],
    ])("rejects %s", (_case, elements) => {
      expect(() => deriveWithMatrix(elements)).toThrow(
        `${errorPrefix} must contain exactly 16 finite elements`,
      );
    });
  });
});
