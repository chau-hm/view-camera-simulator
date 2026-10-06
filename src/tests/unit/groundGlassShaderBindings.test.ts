import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { GroundGlassDofRenderState } from "../../render/groundGlassDofRenderState";
import type { GroundGlassPhysicalRenderState } from "../../render/groundGlassPhysicalRenderState";
import {
  bindGroundGlassDofStateToApparentWorldPositionCocMaterial,
  bindGroundGlassDofStateToCocMaterial,
  bindGroundGlassDofStateToGatherMaterial,
  bindGroundGlassPhysicalStateToComposite,
} from "../../render/groundGlassShaderBindings";

const createDofStateUniforms = () => ({
  dofMode: { value: 0 },
  lensCenterWorld: { value: new THREE.Vector3() },
  lensPlaneNormal: { value: new THREE.Vector3() },
  lensPlaneBasisX: { value: new THREE.Vector3() },
  lensPlaneBasisY: { value: new THREE.Vector3() },
  filmPlanePoint: { value: new THREE.Vector3() },
  filmPlaneNormal: { value: new THREE.Vector3() },
  filmPlaneBasisX: { value: new THREE.Vector3() },
  filmPlaneBasisY: { value: new THREE.Vector3() },
  focusPlanePoint: { value: new THREE.Vector3() },
  focusPlaneNormal: { value: new THREE.Vector3() },
  nearPlanePoint: { value: new THREE.Vector3() },
  nearPlaneNormal: { value: new THREE.Vector3() },
  farPlanePoint: { value: new THREE.Vector3() },
  farPlaneNormal: { value: new THREE.Vector3() },
  hasFiniteFar: { value: 0 },
  inverseProjectionMatrix: { value: new THREE.Matrix4() },
  cameraMatrixWorld: { value: new THREE.Matrix4() },
  maximumCoCRadiusPx: { value: 0 },
  focalLengthMm: { value: 0 },
  sampledFilmWidthMm: { value: 0 },
  sampledFilmHeightMm: { value: 0 },
  fNumber: { value: 0 },
  imageDistanceMm: { value: 0 },
  renderWidth: { value: 0 },
  renderHeight: { value: 0 },
  circleOfConfusionMm: { value: 0 },
});

const createCocMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    tDepth: { value: null },
    ...createDofStateUniforms(),
  },
});

const createGatherMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    tCoC: { value: null },
    gatherLayer: { value: 0 },
    ...createDofStateUniforms(),
  },
});

const dofState: GroundGlassDofRenderState = {
  model: "derived-planes",
  camera: {
    inverseProjectionMatrixElements: new THREE.Matrix4().makeTranslation(1, 2, 3).elements,
    worldMatrixElements: new THREE.Matrix4().makeRotationZ(0.25).elements,
  },
  lens: {
    centerWorldM: { x: 0.01, y: -0.02, z: 0.03 },
    planeNormal: { x: 0, y: 0, z: 1 },
    planeBasisX: { x: 1, y: 0, z: 0 },
    planeBasisY: { x: 0, y: 1, z: 0 },
  },
  film: {
    planePointWorldM: { x: 0.01, y: -0.02, z: -0.12 },
    planeNormal: { x: 0, y: 0, z: 1 },
    planeBasisX: { x: 1, y: 0, z: 0 },
    planeBasisY: { x: 0, y: 1, z: 0 },
    widthMm: 127,
    heightMm: 101.6,
    sampledWidthMm: 63.5,
    sampledHeightMm: 50.8,
  },
  focus: {
    plane: { pointWorldM: { x: 0, y: 0, z: 2 }, normal: { x: 0, y: 0, z: 1 } },
    nearPlane: { pointWorldM: { x: 0, y: 0, z: 1 }, normal: { x: 0, y: 0, z: 1 } },
    farPlane: null,
  },
  optics: {
    imageDistanceMm: 94.2408377,
    focalLengthMm: 90,
    apertureFNumber: 11,
    acceptableCoCDiameterMm: 0.1,
  },
  render: { widthPx: 640, heightPx: 512, maximumBlurRadiusPx: 24, displayWidthPx: 500 },
  physicalCoC: { boundaryDiameterPx: 1.0079, boundaryRadiusPx: 0.5039, visibleBoundaryRadiusPx: 0.3937 },
};

const createCompositeMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    groundGlassIlluminanceGain: { value: 1 },
    groundGlassNaturalIlluminationEnabled: { value: 0 },
    groundGlassNaturalIlluminationImageDistanceMm: { value: 0 },
    groundGlassNaturalIlluminationOffsetXMm: { value: 0 },
    groundGlassNaturalIlluminationOffsetYMm: { value: 0 },
    groundGlassCoverageEnabled: { value: 0 },
    groundGlassCoverageMode: { value: 0 },
    groundGlassCoverageRadiusMm: { value: 0 },
    groundGlassCoverageOffsetXMm: { value: 0 },
    groundGlassCoverageOffsetYMm: { value: 0 },
    groundGlassCoverageConicQuadratic: { value: new THREE.Vector3() },
    groundGlassCoverageConicLinear: { value: new THREE.Vector3() },
    groundGlassCoverageConicAxial: { value: new THREE.Vector3() },
    groundGlassCoverageEdgeFeatherMm: { value: 0 },
    groundGlassFilmWindowCenterXMm: { value: 0 },
    groundGlassFilmWindowCenterYMm: { value: 0 },
    groundGlassFilmWindowWidthMm: { value: 0 },
    groundGlassFilmWindowHeightMm: { value: 0 },
  },
});

describe("Ground Glass semantic state and current GLSL binding", () => {
  it("binds the semantic snapshot to the CoC material without requiring gather-only uniforms", () => {
    const material = createCocMaterial();
    expect(material.uniforms).not.toHaveProperty("tColor");
    expect(material.uniforms).not.toHaveProperty("tCoC");
    expect(material.uniforms).not.toHaveProperty("gatherLayer");

    bindGroundGlassDofStateToCocMaterial(material, dofState);

    expect("uniforms" in dofState).toBe(false);
    expect(dofState.optics).toEqual({
      imageDistanceMm: 94.2408377,
      focalLengthMm: 90,
      apertureFNumber: 11,
      acceptableCoCDiameterMm: 0.1,
    });
    expect(material.uniforms.dofMode.value).toBe(1);
    expect(material.uniforms.lensCenterWorld.value.toArray()).toEqual([0.01, -0.02, 0.03]);
    expect(material.uniforms.fNumber.value).toBe(11);
    expect(material.uniforms.focalLengthMm.value).toBe(90);
    expect(material.uniforms.imageDistanceMm.value).toBe(94.2408377);
    expect(material.uniforms.sampledFilmWidthMm.value).toBe(63.5);
    expect(material.uniforms.maximumCoCRadiusPx.value).toBe(24);
    expect(material.uniforms.renderWidth.value).toBe(640);
    expect(material.uniforms.renderHeight.value).toBe(512);
    expect(material.uniforms.hasFiniteFar.value).toBe(0);
    expect(material.uniforms.inverseProjectionMatrix.value.elements).toEqual(
      dofState.camera.inverseProjectionMatrixElements,
    );
    expect(material.uniforms.cameraMatrixWorld.value.elements).toEqual(
      dofState.camera.worldMatrixElements,
    );
    material.dispose();
  });

  it("binds apparent world positions to an independent contribution CoC stage", () => {
    const material = createCocMaterial();
    delete material.uniforms.tDepth;
    const apparentWorldPosition = new THREE.DataTexture(
      new Float32Array([0, 0, 1, 1]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.FloatType,
    );

    material.uniforms.tApparentWorldPosition = { value: null };
    bindGroundGlassDofStateToApparentWorldPositionCocMaterial(
      material,
      dofState,
      apparentWorldPosition,
    );

    expect(material.uniforms.tApparentWorldPosition.value).toBe(apparentWorldPosition);
    expect(material.uniforms.lensCenterWorld.value.toArray()).toEqual([0.01, -0.02, 0.03]);
    expect(material.uniforms.focalLengthMm.value).toBe(90);
    expect(material.uniforms).not.toHaveProperty("tDepth");

    material.dispose();
    apparentWorldPosition.dispose();
  });

  it("binds the semantic snapshot to the gather material with its distinct pass inputs", () => {
    const material = createGatherMaterial();
    expect(material.uniforms).toHaveProperty("tColor");
    expect(material.uniforms).toHaveProperty("tDepth");
    expect(material.uniforms).toHaveProperty("tCoC");
    expect(material.uniforms).toHaveProperty("gatherLayer");
    expect(material.uniforms).not.toHaveProperty("maximumBlurRadiusPx");

    bindGroundGlassDofStateToGatherMaterial(material, dofState);

    expect(material.uniforms.fNumber.value).toBe(11);
    expect(material.uniforms.maximumCoCRadiusPx.value).toBe(24);
    expect(material.uniforms.sampledFilmWidthMm.value).toBe(63.5);
    material.dispose();
  });

  it("fails with the missing CoC-stage DOF uniform named", () => {
    const material = createCocMaterial();
    delete material.uniforms.lensPlaneNormal;

    expect(() => bindGroundGlassDofStateToCocMaterial(material, dofState)).toThrow(
      'Ground Glass CoC shader is missing required uniform "lensPlaneNormal"',
    );
    expect(material.uniforms.lensCenterWorld.value.toArray()).toEqual([0, 0, 0]);
    material.dispose();
  });

  it("fails when the required CoC depth input is absent", () => {
    const material = createCocMaterial();
    delete material.uniforms.tDepth;

    expect(() => bindGroundGlassDofStateToCocMaterial(material, dofState)).toThrow(
      'Ground Glass CoC shader is missing required uniform "tDepth"',
    );
    material.dispose();
  });

  it("fails when the apparent-world-position input is absent", () => {
    const material = createCocMaterial();

    expect(() => bindGroundGlassDofStateToApparentWorldPositionCocMaterial(
      material,
      dofState,
      new THREE.Texture(),
    )).toThrow(
      'Ground Glass apparent-position CoC shader is missing required uniform "tApparentWorldPosition"',
    );
    material.dispose();
  });

  it("fails with the missing gather-stage DOF uniform named", () => {
    const material = createGatherMaterial();
    delete material.uniforms.sampledFilmWidthMm;

    expect(() => bindGroundGlassDofStateToGatherMaterial(material, dofState)).toThrow(
      'Ground Glass gather shader is missing required uniform "sampledFilmWidthMm"',
    );
    material.dispose();
  });

  it("fails when a required gather pass input is absent", () => {
    const material = createGatherMaterial();
    delete material.uniforms.gatherLayer;

    expect(() => bindGroundGlassDofStateToGatherMaterial(material, dofState)).toThrow(
      'Ground Glass gather shader is missing required uniform "gatherLayer"',
    );
    material.dispose();
  });

  it("preserves conic and cos4 semantics while binding the existing composite encoding", () => {
    const material = createCompositeMaterial();
    const filmWindow = { centerXMm: 47.625, centerYMm: -38.1, widthMm: 31.75, heightMm: 25.4 };
    const physicalState: GroundGlassPhysicalRenderState = {
      dof: dofState,
      coverage: {
        kind: "nonparallel-conic",
        active: true,
        geometry: {
          kind: "nonparallel-conic",
          quadratic: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
          axial: { x: 7, y: 8, constant: 9 },
        },
        edgeFeatherMm: 0.05,
        filmWindow,
      },
      naturalIllumination: {
        enabled: true,
        geometry: {
          kind: "parallel-cos4",
          imageDistanceMm: 150,
          opticalAxisOffsetXMm: 18,
          opticalAxisOffsetYMm: 20,
        },
        filmWindow,
      },
      relativeIlluminanceGain: 0.25,
    };

    bindGroundGlassPhysicalStateToComposite(material, physicalState);

    expect(material.uniforms.groundGlassIlluminanceGain.value).toBe(0.25);
    expect(material.uniforms.groundGlassNaturalIlluminationEnabled.value).toBe(1);
    expect(material.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value).toBe(150);
    expect(material.uniforms.groundGlassNaturalIlluminationOffsetXMm.value).toBe(18);
    expect(material.uniforms.groundGlassCoverageEnabled.value).toBe(1);
    expect(material.uniforms.groundGlassCoverageMode.value).toBe(2);
    expect(material.uniforms.groundGlassCoverageConicQuadratic.value.toArray()).toEqual([1, 2, 3]);
    expect(material.uniforms.groundGlassCoverageConicLinear.value.toArray()).toEqual([4, 5, 6]);
    expect(material.uniforms.groundGlassCoverageConicAxial.value.toArray()).toEqual([7, 8, 9]);
    expect(material.uniforms.groundGlassCoverageEdgeFeatherMm.value).toBe(0.05);
    expect(material.uniforms.groundGlassFilmWindowCenterXMm.value).toBe(47.625);
    expect(material.uniforms.groundGlassFilmWindowHeightMm.value).toBe(25.4);
    material.dispose();
  });
});
