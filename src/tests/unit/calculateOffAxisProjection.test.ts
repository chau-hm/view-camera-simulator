import { describe, it, expect } from "vitest";
import { calculateOffAxisProjectionMatrix, createOffAxisProjectionInput, calculateFilmPlaneCorners } from "../../core/optics/calculateOffAxisProjection";
import { calculateRearStandardFrame } from "../../core/optics/calculateRearStandardFrame";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { vec } from "../../core/math/vec";
import { planeFromPointNormal } from "../../core/math/plane";


describe("calculateOffAxisProjectionMatrix", () => {
  it("produces identity-like fallback for degenerate input", () => {
    const input = createOffAxisProjectionInput(
      vec(0, 0, 0),
      {
        topLeft: vec(0, 0, 0),
        topRight: vec(0, 0, 0),
        bottomLeft: vec(0, 0, 0),
        bottomRight: vec(0, 0, 0),
      },
    );
    const matrix = calculateOffAxisProjectionMatrix(input);
    expect(matrix.length).toBe(16);
    expect(matrix.every(Number.isFinite)).toBe(true);
  });

  it("preserves zero-movement matrix values for world-aligned film", () => {
    const lensCenter = vec(0, 0, 0);
    const filmPlane = planeFromPointNormal(vec(0, 0, -150), vec(0, 0, 1));
    const corners = calculateFilmPlaneCorners(filmPlane);
    const input = createOffAxisProjectionInput(lensCenter, corners);
    const matrix = calculateOffAxisProjectionMatrix(input);

    // Expected: scale = near/depth = 10/150
    const scale = 10 / 150;
    const halfW = CAMERA_CONSTANTS.filmWidthMm / 2;
    const halfH = CAMERA_CONSTANTS.filmHeightMm / 2;
    const left = -halfW * scale;
    const right = halfW * scale;
    const top = halfH * scale;
    const bottom = -halfH * scale;
    const width = right - left;
    const height = top - bottom;

    expect(matrix[0]).toBeCloseTo((2 * 10) / width, 8);
    expect(matrix[5]).toBeCloseTo((2 * 10) / height, 8);
    expect(matrix[9]).toBeCloseTo(0, 8);
    expect(matrix[10]).toBeCloseTo(-1.0004000800160031, 8);
    expect(matrix[11]).toBe(-1);
  });

  it("produces finite matrix for tilted film plane", () => {
    const { corners } = calculateRearStandardFrame(vec(0, 0, -150), 0, 8);
    const input = createOffAxisProjectionInput(vec(0, 0, 0), corners);
    const matrix = calculateOffAxisProjectionMatrix(input);
    expect(matrix.length).toBe(16);
    expect(matrix.every(Number.isFinite)).toBe(true);
  });

  it("produces finite matrix for translated film plane", () => {
    const { corners } = calculateRearStandardFrame(vec(0, 0, -150), 20, 0);
    const input = createOffAxisProjectionInput(vec(0, 0, 0), corners);
    const matrix = calculateOffAxisProjectionMatrix(input);
    expect(matrix.length).toBe(16);
    expect(matrix.every(Number.isFinite)).toBe(true);
    // Y offset should be non-zero (lens at y=0, film centre at y=20)
    expect(Math.abs(matrix[9])).toBeGreaterThan(0.001);
  });

  it("produces finite matrix for combined rise and tilt", () => {
    const { corners } = calculateRearStandardFrame(vec(0, 0, -150), 15, 6);
    const input = createOffAxisProjectionInput(vec(0, 0, 0), corners);
    const matrix = calculateOffAxisProjectionMatrix(input);
    expect(matrix.length).toBe(16);
    expect(matrix.every(Number.isFinite)).toBe(true);
  });

  it("changes matrix when film is translated", () => {
    const base = calculateRearStandardFrame(vec(0, 0, -150), 0, 0);
    const risen = calculateRearStandardFrame(vec(0, 0, -150), 20, 0);
    const baseInput = createOffAxisProjectionInput(vec(0, 0, 0), base.corners);
    const risenInput = createOffAxisProjectionInput(vec(0, 0, 0), risen.corners);
    const baseMatrix = calculateOffAxisProjectionMatrix(baseInput);
    const risenMatrix = calculateOffAxisProjectionMatrix(risenInput);
    expect(risenMatrix).not.toEqual(baseMatrix);
  });

  it("changes matrix when film is tilted", () => {
    const base = calculateRearStandardFrame(vec(0, 0, -150), 0, 0);
    const tilted = calculateRearStandardFrame(vec(0, 0, -150), 0, 5);
    const baseInput = createOffAxisProjectionInput(vec(0, 0, 0), base.corners);
    const tiltedInput = createOffAxisProjectionInput(vec(0, 0, 0), tilted.corners);
    const baseMatrix = calculateOffAxisProjectionMatrix(baseInput);
    const tiltedMatrix = calculateOffAxisProjectionMatrix(tiltedInput);
    expect(tiltedMatrix).not.toEqual(baseMatrix);
  });

  it("preserves matrix layout (16 elements, column-major)", () => {
    const { corners } = calculateRearStandardFrame(vec(0, 0, -150), 0, 0);
    const input = createOffAxisProjectionInput(vec(0, 0, 0), corners);
    const matrix = calculateOffAxisProjectionMatrix(input);
    expect(matrix.length).toBe(16);
    // Column-major: element [11] should be -1 (the perspective divide row)
    expect(matrix[11]).toBe(-1);
    // Element [15] should be 0 (homogeneous coordinate)
    expect(matrix[15]).toBe(0);
  });
});
