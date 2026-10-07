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
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

type PaneSample = {
  pane: string;
  row: number;
  column: number;
  u: number;
  v: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  incident: THREE.Vector3;
  reflected: THREE.Vector3;
};

const sampleFractions = [0.1, 0.3, 0.7, 0.9] as const;
const baselineFractions = [0.1, 0.5, 0.9] as const;
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

const paneSamples = (
  root: THREE.Group,
  camera: THREE.Camera,
  side: boolean,
  fractions: readonly number[],
): PaneSample[] => {
  const panes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      object.name.endsWith("-glazing") &&
      (side
        ? object.name.startsWith("architecture-rise-side-return-window-bay-")
        : object.name.startsWith("architecture-rise-facade-window-bay-"))
    ) {
      panes.push(object);
    }
  });
  const lens = camera.position.clone();
  return panes.flatMap((pane) => {
    const bounds = new THREE.Box3().setFromObject(pane);
    const normal = side ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1);
    return fractions.flatMap((v, row) => fractions.map((u, column) => {
      const point = side
        ? new THREE.Vector3(
            bounds.min.x,
            bounds.min.y + v * (bounds.max.y - bounds.min.y),
            bounds.min.z + u * (bounds.max.z - bounds.min.z),
          )
        : new THREE.Vector3(
            bounds.min.x + u * (bounds.max.x - bounds.min.x),
            bounds.min.y + v * (bounds.max.y - bounds.min.y),
            bounds.min.z,
          );
      const incident = point.clone().sub(lens).normalize();
      return {
        pane: pane.name,
        row,
        column,
        u,
        v,
        point,
        normal,
        incident,
        reflected: incident.clone().reflect(normal).normalize(),
      };
    }));
  });
};

const sceneMeshesExcludingWindowAssemblies = (root: THREE.Group): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      !object.name.startsWith("architecture-rise-facade-window-bay-") &&
      !object.name.startsWith("architecture-rise-side-return-window-bay-")
    ) {
      meshes.push(object);
    }
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

const maximumAdjacent2x2 = (hitKeys: Set<string>, paneNames: string[]) => {
  let maximum = 0;
  for (const pane of paneNames) {
    for (let row = 0; row < sampleFractions.length - 1; row += 1) {
      for (let column = 0; column < sampleFractions.length - 1; column += 1) {
        const cluster = [
          `${pane}|${row}|${column}`,
          `${pane}|${row + 1}|${column}`,
          `${pane}|${row}|${column + 1}`,
          `${pane}|${row + 1}|${column + 1}`,
        ].filter((key) => hitKeys.has(key)).length;
        maximum = Math.max(maximum, cluster);
      }
    }
  }
  return maximum;
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

const isFrontWindowAssembly = (mesh: THREE.Mesh) =>
  mesh.name.startsWith("architecture-rise-facade-window-bay-");

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

  it("provides a clear physical front-pane reflection sample with an in-range virtual focus point", () => {
    const paneFocusMm = architectureRiseScene.cameraPreset.focusDistanceMm ?? 8890;
    const { camera, optics: paneFocusedOptics, config } = configuredGroundGlassCamera(paneFocusMm);
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
      expect(sign).toBeInstanceOf(THREE.Group);
      if (!sign || !chart || !facade) throw new Error("Expected Architecture Rise context and teaching geometry");

      const signMeshes: THREE.Mesh[] = [];
      sign.traverse((object) => {
        if (object instanceof THREE.Mesh) signMeshes.push(object);
      });
      const sceneMeshes = sceneMeshesExcludingWindowAssemblies(group);
      const raycaster = new THREE.Raycaster();
      const coarseFrontSamples = paneSamples(group, camera, false, baselineFractions);
      const coarseSideSamples = paneSamples(group, camera, true, baselineFractions);
      const coarseFrontSceneHits = coarseFrontSamples.filter((sample) =>
        castFirstHit(
          raycaster,
          sceneMeshes,
          sample.point.clone().addScaledVector(sample.reflected, 0.12),
          sample.reflected,
        ) !== null,
      );
      const coarseSideSceneHits = coarseSideSamples.filter((sample) =>
        castFirstHit(
          raycaster,
          sceneMeshes,
          sample.point.clone().addScaledVector(sample.reflected, 0.12),
          sample.reflected,
        ) !== null,
      );
      expect(coarseFrontSamples).toHaveLength(144);
      expect(coarseSideSamples).toHaveLength(36);
      expect(coarseFrontSceneHits.length).toBeGreaterThan(0);

      const fineSamples = paneSamples(group, camera, false, sampleFractions);
      const fineHits = fineSamples.flatMap((sample) => {
        const origin = sample.point.clone().addScaledVector(sample.reflected, 0.12);
        const hit = castFirstHit(raycaster, sceneMeshes, origin, sample.reflected);
        return hit && hit.object.name.startsWith("architecture-rise-street-sign-")
          ? [{ sample, hit }]
          : [];
      });
      const clusterKeys = new Set(fineHits.map(({ sample }) => `${sample.pane}|${sample.row}|${sample.column}`));
      const frontPaneNames = [...new Set(fineSamples.map((sample) => sample.pane))];
      expect(fineHits.length).toBeGreaterThanOrEqual(12);
      expect(maximumAdjacent2x2(clusterKeys, frontPaneNames)).toBe(4);

      const knownSample = fineSamples.find((sample) =>
        sample.pane === "architecture-rise-facade-window-bay-bay-2-1-glazing" &&
        sample.u === 0.3 && sample.v === 0.3,
      );
      expect(knownSample).toBeDefined();
      if (!knownSample) throw new Error("The named reflected sample should exist");
      const reflectedOrigin = knownSample.point.clone().addScaledVector(knownSample.reflected, 0.12);
      const knownHit = castFirstHit(raycaster, sceneMeshes, reflectedOrigin, knownSample.reflected);
      expect(knownHit).not.toBeNull();
      expect(knownHit?.object.name).toBe("architecture-rise-street-sign-face-back");
      if (!knownHit) throw new Error("The known reflected ray should hit the sign face");

      const realQ = knownHit.point.clone();
      const signedPaneDistance = realQ.clone().sub(knownSample.point).dot(knownSample.normal);
      const virtualQ = realQ.clone().addScaledVector(knownSample.normal, -2 * signedPaneDistance);
      const virtualDistanceMm = virtualQ.distanceTo(camera.position) * 1000;
      expect([realQ.x, realQ.y, realQ.z, virtualQ.x, virtualQ.y, virtualQ.z].every(Number.isFinite)).toBe(true);
      expect(virtualDistanceMm).toBeGreaterThanOrEqual(publicFocusRangeMm.min);
      expect(virtualDistanceMm).toBeLessThanOrEqual(publicFocusRangeMm.max - 750);
      expect(virtualQ.z * 1000).toBeLessThanOrEqual(publicFocusRangeMm.max - 900);

      const windowAssemblies: THREE.Mesh[] = [];
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && isFrontWindowAssembly(object)) windowAssemblies.push(object);
      });
      const pathToPane = realQ.distanceTo(knownSample.point);
      const unoccludedPanePath = castFirstHit(
        raycaster,
        windowAssemblies,
        realQ.clone().addScaledVector(knownSample.reflected, -0.002),
        knownSample.reflected.clone().negate(),
        Math.max(0, pathToPane - 0.01),
      );
      expect(unoccludedPanePath).toBeNull();

      const directPanePath = castFirstHit(
        raycaster,
        signMeshes,
        camera.position.clone(),
        knownSample.incident,
        knownSample.point.distanceTo(camera.position),
      );
      expect(directPanePath).toBeNull();

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

      const qvFocusMm = Math.round((virtualQ.z * 1000) / 10) * 10;
      expect(qvFocusMm).toBeGreaterThanOrEqual(publicFocusRangeMm.min);
      expect(qvFocusMm).toBeLessThanOrEqual(publicFocusRangeMm.max);
      const reflectedFocusedOptics = deriveOpticsState(cameraStateAtFocus(qvFocusMm), architectureRiseScene);
      const qvAtPaneFocus = physicalFootprintAt(paneFocusedOptics, virtualQ);
      const qvAtReflectedFocus = physicalFootprintAt(reflectedFocusedOptics, virtualQ);
      expect(qvAtPaneFocus.valid).toBe(true);
      expect(qvAtReflectedFocus.valid).toBe(true);
      expect(Math.abs(qvAtPaneFocus.signedCoCDiameterMm)).toBeGreaterThan(0.05);
      expect(Math.abs(qvAtPaneFocus.signedCoCDiameterMm)).toBeGreaterThan(
        Math.abs(qvAtReflectedFocus.signedCoCDiameterMm) * 10,
      );

      console.log(JSON.stringify({
        coarseFrontHits: coarseFrontSceneHits.length,
        coarseFrontSamples: coarseFrontSamples.length,
        coarseSideHits: coarseSideSceneHits.length,
        coarseSideSamples: coarseSideSamples.length,
        frontHitSamples: fineHits.length,
        frontSampleCount: fineSamples.length,
        cluster2x2: maximumAdjacent2x2(clusterKeys, frontPaneNames),
        knownPaneSample: knownSample.point.toArray(),
        panePlane: { point: knownSample.point.toArray(), normal: knownSample.normal.toArray() },
        hitObject: knownHit.object.name,
        Q: realQ.toArray(),
        QVirtual: virtualQ.toArray(),
        virtualDistanceMm,
        focusRangeMm: publicFocusRangeMm,
        focusMarginMm: publicFocusRangeMm.max - virtualDistanceMm,
        paneFocusedCoCMm: qvAtPaneFocus.signedCoCDiameterMm,
        reflectedFocusedDistanceMm: qvFocusMm,
        reflectedFocusedCoCMm: qvAtReflectedFocus.signedCoCDiameterMm,
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
      const pane = targetWindowMesh(group, "architecture-rise-facade-window-bay-bay-2-1-glazing");
      const paneBounds = new THREE.Box3().setFromObject(pane);
      expect(paneBounds.min.z * 1000).toBeCloseTo(8836, 6);
      expect(publicFocusRangeMm).toEqual({ min: 3090, max: 13000 });
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });
});
