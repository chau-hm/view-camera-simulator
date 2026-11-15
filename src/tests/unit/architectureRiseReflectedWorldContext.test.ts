import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  computePhysicalBlurFootprint,
  deriveOrthonormalPlaneBasis,
} from "../../core/optics/computePhysicalBlurFootprint";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { toWorld } from "../../render/rttUtils";
import architectureRiseGeometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
  DEFAULT_CAMERA_STATE,
} from "../../utils/constants";
import { roundToStep } from "../../utils/roundToStep";

const publicFocusRangeMm = architectureRiseScene.focusDistanceRangeMm;
if (!publicFocusRangeMm) throw new Error("Architecture Rise must declare its public focus range");

const cameraStateAtFocus = (focusDistanceMm: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  activeTaskId: null,
  mode: "free",
  focusDistanceMm,
});

const configuredGroundGlassCamera = (focusDistanceMm: number) => {
  const optics = deriveOpticsState(cameraStateAtFocus(focusDistanceMm), architectureRiseScene);
  const camera = new THREE.PerspectiveCamera(45, 514 / 411, 0.01, 200);
  const clip = getGroundGlassClipRangeWorld(
    architectureRiseScene,
    optics.lensCenterWorld,
    optics.opticalAxis.direction,
  );
  const config = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
  if (!config.ok) throw new Error(`Ground Glass camera failed to configure: ${config.reason}`);
  return { camera, optics, config };
};

const mountedMeshesForTest = (root: THREE.Group): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
};

const castFirstHit = (
  raycaster: THREE.Raycaster,
  meshes: THREE.Mesh[],
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maximumDistance = 100,
) => {
  raycaster.set(origin, direction);
  raycaster.near = 0;
  raycaster.far = maximumDistance;
  return raycaster.intersectObjects(meshes, false)[0] ?? null;
};

const screenBounds = (camera: THREE.PerspectiveCamera, bounds: THREE.Box3) => {
  const projected: THREE.Vector3[] = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        projected.push(new THREE.Vector3(x, y, z).project(camera));
      }
    }
  }
  return {
    minX: Math.min(...projected.map((point) => point.x)),
    maxX: Math.max(...projected.map((point) => point.x)),
    minY: Math.min(...projected.map((point) => point.y)),
    maxY: Math.max(...projected.map((point) => point.y)),
  };
};

const screenOverlapFraction = (
  first: ReturnType<typeof screenBounds>,
  second: ReturnType<typeof screenBounds>,
) => {
  const width = Math.max(0, Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX));
  const height = Math.max(0, Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY));
  const targetArea = Math.max(1e-12, (second.maxX - second.minX) * (second.maxY - second.minY));
  return (width * height) / targetArea;
};

const physicalFootprintAt = (optics: DerivedOpticsState, objectPointWorldM: THREE.Vector3) => {
  const lensBasis = deriveOrthonormalPlaneBasis(
    optics.lensPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  const filmBasis = deriveOrthonormalPlaneBasis(
    optics.filmPlane.normal,
    optics.rearStandardFrame.rightWorld,
    optics.rearStandardFrame.upWorld,
  );
  if (!lensBasis || !filmBasis) throw new Error("Architecture Rise physical focus bases should resolve");
  return computePhysicalBlurFootprint({
    objectPoint: {
      x: objectPointWorldM.x * 1000,
      y: objectPointWorldM.y * 1000,
      z: objectPointWorldM.z * 1000,
    },
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: lensBasis.normal,
    lensPlaneBasisX: lensBasis.x,
    lensPlaneBasisY: lensBasis.y,
    filmPlane: optics.filmPlane,
    filmPlaneBasisX: filmBasis.x,
    filmPlaneBasisY: filmBasis.y,
    focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
    apertureFNumber: architectureRiseScene.cameraPreset.aperture ?? 11,
  });
};

const targetWindowMesh = (root: THREE.Group, name: string) => {
  const mesh = root.getObjectByName(name);
  if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing window mesh ${name}`);
  return mesh;
};

describe("Architecture Rise reflected-world context", () => {
  it("adds the double-sided street sign through the shared street-context subject with shared resources", () => {
    const group = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      group.updateMatrixWorld(true);
      const street = group.getObjectByName("architecture-rise-street-context");
      const sign = group.getObjectByName("architecture-rise-street-sign");
      expect(street).toBeInstanceOf(THREE.Group);
      expect(sign).toBeInstanceOf(THREE.Group);
      expect(sign?.parent).toBe(street);

      const signMeshes: THREE.Mesh[] = [];
      sign?.traverse((object) => {
        if (object instanceof THREE.Mesh) signMeshes.push(object);
      });
      expect(signMeshes).toHaveLength(8);
      const resources = group.userData.resources as {
        box: THREE.BoxGeometry;
        reference: THREE.Material;
        referenceLight: THREE.Material;
        recess: THREE.Material;
      };
      expect(signMeshes.every((mesh) => mesh.geometry === resources.box)).toBe(true);
      expect(signMeshes.some((mesh) => mesh.material === resources.reference)).toBe(true);
      expect(signMeshes.some((mesh) => mesh.material === resources.referenceLight)).toBe(true);
      expect(signMeshes.some((mesh) => mesh.material === resources.recess)).toBe(true);

      const signPost = sign?.getObjectByName("architecture-rise-street-sign-post");
      expect(signPost).toBeInstanceOf(THREE.Mesh);
      if (!(signPost instanceof THREE.Mesh)) throw new Error("Expected the street sign post mesh");
      const postBounds = new THREE.Box3().setFromObject(signPost);
      expect(postBounds.min.y).toBeCloseTo(toWorld(architectureRiseGeometry.ground.y), 10);
      console.log(JSON.stringify({
        supportSurfaceYmm: architectureRiseGeometry.ground.y,
        postBottomYmm: postBounds.min.y * 1000,
        postTopYmm: postBounds.max.y * 1000,
      }));

      const bounds = new THREE.Box3().setFromObject(sign!);
      expect(bounds.min.x).toBeGreaterThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.min.x));
      expect(bounds.max.x).toBeLessThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.max.x));
      expect(bounds.min.y).toBeGreaterThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.min.y));
      expect(bounds.max.y).toBeLessThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.max.y));
      expect(bounds.min.z).toBeGreaterThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.min.z));
      expect(bounds.max.z).toBeLessThanOrEqual(toWorld(architectureRiseGeometry.sceneBounds.max.z));
      expect(publicFocusRangeMm).toEqual({ min: 3090, max: 13000 });
      expect(architectureRiseGeometry.focusTarget.worldPosition).toEqual({
        x: 0,
        y: architectureRiseGeometry.building.center.y,
        z: architectureRiseGeometry.facade.frontFacadeZ - 10,
      });
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });

  it("provides an unobstructed inset glazing sample with an in-range focus point", () => {
    const presetFocusMm = architectureRiseScene.cameraPreset.focusDistanceMm ?? 8890;
    const { camera, optics: presetOptics, config } = configuredGroundGlassCamera(presetFocusMm);
    expect(config.ok).toBe(true);
    expect(config.pose.positionWorld.every((value) => Math.abs(value) < 1e-12)).toBe(true);
    expect(config.pose.forwardWorld[0]).toBeCloseTo(0, 12);
    expect(config.pose.forwardWorld[1]).toBeCloseTo(0, 12);
    expect(config.pose.forwardWorld[2]).toBeCloseTo(1, 12);

    const group = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      group.updateMatrixWorld(true);
      const sign = group.getObjectByName("architecture-rise-street-sign");
      const chart = group.getObjectByName("architecture-rise-focus-chart");
      const facade = group.getObjectByName("architecture-rise-primary-facade");
      const pane = targetWindowMesh(group, "architecture-rise-window-top-left-glazing");
      expect(sign).toBeInstanceOf(THREE.Group);
      expect(chart).toBeInstanceOf(THREE.Group);
      if (!sign || !chart || !facade) throw new Error("Expected Architecture Rise context and teaching geometry");

      const panes = { front: [] as THREE.Mesh[], side: [] as THREE.Mesh[] };
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.name.endsWith("-glazing")) return;
        if (object.name.includes("service-east-")) panes.side.push(object);
        else panes.front.push(object);
      });
      expect(panes.front).toHaveLength(7);
      expect(panes.side).toHaveLength(2);
      expect(new Set([...panes.front, ...panes.side].map((mesh) => mesh.material)).size).toBe(1);

      const paneBounds = new THREE.Box3().setFromObject(pane);
      const panePoint = new THREE.Vector3(
        paneBounds.min.x + 0.3 * (paneBounds.max.x - paneBounds.min.x),
        paneBounds.min.y + 0.3 * (paneBounds.max.y - paneBounds.min.y),
        paneBounds.min.z,
      );
      const sceneMeshes = mountedMeshesForTest(group);
      const paneRay = panePoint.clone().sub(camera.position);
      const paneDistanceM = paneRay.length();
      const raycaster = new THREE.Raycaster(camera.position, paneRay.normalize(), 0, paneDistanceM + 1e-4);
      const paneHit = raycaster.intersectObjects(sceneMeshes, false)[0];
      expect(paneHit?.object.name).toBe(pane.name);

      const lensCenterWorld = new THREE.Vector3(
        toWorld(presetOptics.lensCenterWorld.x),
        toWorld(presetOptics.lensCenterWorld.y),
        toWorld(presetOptics.lensCenterWorld.z),
      );
      expect(lensCenterWorld.distanceTo(camera.position)).toBeCloseTo(0, 12);
      const opticalAxisDirection = new THREE.Vector3(
        presetOptics.opticalAxis.direction.x,
        presetOptics.opticalAxis.direction.y,
        presetOptics.opticalAxis.direction.z,
      ).normalize();
      const paneAxisDistanceMm = panePoint.clone().sub(lensCenterWorld).dot(opticalAxisDirection) * 1000;
      const paneFocusControlMm = roundToStep(paneAxisDistanceMm, CAMERA_CONTROL_STEPS.focusDistanceMm);
      expect(paneAxisDistanceMm).toBeGreaterThanOrEqual(publicFocusRangeMm.min);
      expect(paneAxisDistanceMm).toBeLessThanOrEqual(publicFocusRangeMm.max);
      expect(paneFocusControlMm).toBeGreaterThanOrEqual(publicFocusRangeMm.min);
      expect(paneFocusControlMm).toBeLessThanOrEqual(publicFocusRangeMm.max);

      const presetFootprint = physicalFootprintAt(presetOptics, panePoint);
      const paneFocusedOptics = deriveOpticsState(cameraStateAtFocus(paneFocusControlMm), architectureRiseScene);
      const paneFocusedFootprint = physicalFootprintAt(paneFocusedOptics, panePoint);
      expect(presetFootprint.valid).toBe(true);
      expect(paneFocusedFootprint.valid).toBe(true);
      expect(Math.abs(presetFootprint.signedCoCDiameterMm)).toBeGreaterThan(0.001);
      expect(Math.abs(paneFocusedFootprint.signedCoCDiameterMm))
        .toBeLessThan(Math.abs(presetFootprint.signedCoCDiameterMm));

      const signMeshes: THREE.Mesh[] = [];
      sign.traverse((object) => {
        if (object instanceof THREE.Mesh) signMeshes.push(object);
      });
      expect(castFirstHit(
        raycaster,
        signMeshes,
        camera.position.clone(),
        panePoint.clone().sub(camera.position).normalize(),
        paneDistanceM,
      )).toBeNull();

      const observer = new THREE.PerspectiveCamera(45, 514 / 411, 0.01, 200);
      const observerPlacement = architectureRiseScene.cameraPlacement;
      observer.position.set(
        toWorld(observerPlacement.position.x),
        toWorld(observerPlacement.position.y),
        toWorld(observerPlacement.position.z),
      );
      observer.lookAt(
        toWorld(observerPlacement.target.x),
        toWorld(observerPlacement.target.y),
        toWorld(observerPlacement.target.z),
      );
      observer.updateMatrixWorld(true);
      const chartBounds = screenBounds(observer, new THREE.Box3().setFromObject(chart));
      const facadeBounds = screenBounds(observer, new THREE.Box3().setFromObject(facade));
      const signBounds = screenBounds(observer, new THREE.Box3().setFromObject(sign));
      expect(screenOverlapFraction(signBounds, chartBounds)).toBe(0);
      expect(screenOverlapFraction(signBounds, facadeBounds)).toBe(0);

      console.log(JSON.stringify({
        frontPaneCount: panes.front.length,
        servicePaneCount: panes.side.length,
        directFirstHit: paneHit?.object.name,
        paneWorldPosition: panePoint.toArray(),
        paneFocusAxisDistanceMm: paneAxisDistanceMm,
        paneFocusControlMm,
        presetCoCMm: presetFootprint.signedCoCDiameterMm,
        paneFocusedCoCMm: paneFocusedFootprint.signedCoCDiameterMm,
        observerFocusChartOverlap: screenOverlapFraction(signBounds, chartBounds),
        observerFacadeOverlap: screenOverlapFraction(signBounds, facadeBounds),
      }, null, 2));
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });

  it("keeps the documented front-plane and lens coordinates tied to current production geometry", () => {
    const group = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      group.updateMatrixWorld(true);
      const pane = targetWindowMesh(group, "architecture-rise-window-top-left-glazing");
      const paneBounds = new THREE.Box3().setFromObject(pane);
      expect(paneBounds.min.z).toBeGreaterThanOrEqual(
        toWorld(architectureRiseGeometry.facade.frontFacadeZ + 80),
      );
      expect(publicFocusRangeMm).toEqual({ min: 3090, max: 13000 });
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });
});
