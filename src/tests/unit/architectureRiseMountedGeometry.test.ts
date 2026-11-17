import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import { toWorld } from "../../render/rttUtils";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import {
  ARCHITECTURE_RISE_PRESENTATION_LAYOUT,
  type ArchitectureRiseFrontWindow,
} from "../../scenes/presentation/architectureRiseLayout";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

type TargetSample = Readonly<{
  id: string;
  canonicalObjectName: string;
  targetWorldMm: THREE.Vector3;
}>;

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  ...overrides,
  activeSceneId: architectureRiseScene.id,
  activeTaskId: null,
  mode: "free",
});

const canonicalFocusSamples = (): TargetSample[] => {
  const samples: TargetSample[] = [];
  geometry.getArchitectureFocusChartCells().forEach((cell) => {
    samples.push({
      id: `checker-${cell.id}`,
      canonicalObjectName: cell.id,
      targetWorldMm: new THREE.Vector3(cell.x, cell.y, cell.z - cell.depth / 2),
    });
  });
  geometry.getArchitectureFocusChartBars().forEach((bar) => {
    const name = `architecture-focus-crosshair-${bar.id}`;
    samples.push({
      id: `marker-${bar.id}`,
      canonicalObjectName: name,
      targetWorldMm: new THREE.Vector3(bar.x, bar.y, bar.z - bar.depth / 2),
    });
  });

  const pieces = geometry.getArchitectureFacadeFineDetailPieces();
  const panel = pieces.find((piece) => piece.role === "panel");
  if (!panel) throw new Error("Canonical fine-detail panel is missing");
  [
    { x: panel.x, y: panel.y },
    { x: panel.x - 110, y: panel.y - 55 },
    { x: panel.x + 110, y: panel.y + 55 },
  ].forEach(({ x, y }, index) => samples.push({
    id: `fine-panel-interior-${index + 1}`,
    canonicalObjectName: panel.id,
    targetWorldMm: new THREE.Vector3(x, y, panel.z - panel.depth / 2),
  }));

  pieces.filter((piece) => piece.role === "frame").forEach((piece) => {
    const isVertical = piece.height > piece.width;
    const samplesOnPiece = isVertical
      ? [
          { x: piece.x, y: piece.y },
          { x: piece.x, y: piece.y - piece.height / 2 + 8 },
          { x: piece.x, y: piece.y + piece.height / 2 - 8 },
        ]
      : [
          { x: piece.x, y: piece.y },
          { x: piece.x - piece.width / 2 + 8, y: piece.y },
          { x: piece.x + piece.width / 2 - 8, y: piece.y },
        ];
    samplesOnPiece.forEach(({ x, y }, index) => samples.push({
      id: `${piece.id}-sample-${index + 1}`,
      canonicalObjectName: piece.id,
      targetWorldMm: new THREE.Vector3(x, y, piece.z - piece.depth / 2),
    }));
  });

  pieces.filter((piece) => piece.role === "fine").forEach((piece) => {
    [piece.x - piece.width / 2 + 10, piece.x, piece.x + piece.width / 2 - 10].forEach((x, index) =>
      samples.push({
        id: `${piece.id}-sample-${index + 1}`,
        canonicalObjectName: piece.id,
        targetWorldMm: new THREE.Vector3(x, piece.y, piece.z - piece.depth / 2),
      }),
    );
  });
  return samples;
};

const canonicalFocusObjectNames = (): Set<string> => new Set([
  ...geometry.getArchitectureFocusChartCells().map((cell) => cell.id),
  ...geometry.getArchitectureFocusChartBars().map((bar) => `architecture-focus-crosshair-${bar.id}`),
  ...geometry.getArchitectureFacadeFineDetailPieces().map((piece) => piece.id),
]);

const mountedMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
};

const findDecorativeOccluder = (
  root: THREE.Group,
  sample: TargetSample,
  cameraState: CameraState,
) => {
  const optics = deriveOpticsState(cameraState, architectureRiseScene);
  const origin = new THREE.Vector3(
    toWorld(optics.lensCenterWorld.x),
    toWorld(optics.lensCenterWorld.y),
    toWorld(optics.lensCenterWorld.z),
  );
  const target = sample.targetWorldMm.clone().multiplyScalar(0.001);
  const ray = target.clone().sub(origin);
  const targetDistance = ray.length();
  ray.normalize();
  const raycaster = new THREE.Raycaster(origin, ray, 0, targetDistance + 1e-4);
  const hits = raycaster.intersectObjects(mountedMeshes(root), false);
  const targetHit = hits.find((hit) => hit.object.name === sample.canonicalObjectName);
  const canonicalNames = canonicalFocusObjectNames();
  const occluder = hits.find((hit) =>
    hit.distance < targetDistance - 1e-4 && !canonicalNames.has(hit.object.name),
  );
  return { origin, target, targetDistance, targetHit, occluder };
};

const assertFocusSamplesVisible = (
  root: THREE.Group,
  samples: readonly TargetSample[],
  cameraState: CameraState,
): { firstHitNames: string[] } => {
  const firstHitNames: string[] = [];
  for (const sample of samples) {
    const { targetHit, occluder } = findDecorativeOccluder(root, sample, cameraState);
    if (occluder) {
      throw new Error(`${sample.id} is intercepted by ${occluder.object.name} at ${occluder.distance.toFixed(6)} m`);
    }
    if (!targetHit) throw new Error(`${sample.id} did not hit its canonical surface ${sample.canonicalObjectName}`);
    firstHitNames.push(targetHit.object.name);
  }
  return { firstHitNames };
};

describe("Architecture Rise mounted geometry visibility", () => {
  it("constructs real front and service apertures with inset glass and an attached return", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      root.updateMatrixWorld(true);
      const mainShell = root.getObjectByName("architecture-rise-main-facade-shell");
      const serviceReturn = root.getObjectByName("architecture-rise-attached-service-return");
      if (!mainShell || !serviceReturn) throw new Error("Architecture Rise wall assemblies were not mounted");
      const frontWindows = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows.filter(
        (window): window is ArchitectureRiseFrontWindow => window.elevation === "front",
      );
      const structuralMeshes = mountedMeshes(mainShell);
      const raycaster = new THREE.Raycaster();
      const front = toWorld(geometry.facade.frontFacadeZ);
      for (const window of frontWindows) {
        const apertureRay = new THREE.Ray(
          new THREE.Vector3(toWorld(window.centerXMm), toWorld(window.centerYMm), front - 0.02),
          new THREE.Vector3(0, 0, 1),
        );
        raycaster.set(apertureRay.origin, apertureRay.direction);
        raycaster.near = 0;
        raycaster.far = toWorld(geometry.building.depth + 40);
        expect(raycaster.intersectObjects(structuralMeshes, false), `${window.id} should be cut through the wall`)
          .toHaveLength(0);
        const pane = root.getObjectByName(`architecture-rise-window-${window.id}-glazing`);
        if (!(pane instanceof THREE.Mesh)) throw new Error(`Missing mounted glazing for ${window.id}`);
        const paneBounds = new THREE.Box3().setFromObject(pane);
        expect(paneBounds.min.z).toBeGreaterThanOrEqual(front + toWorld(80));
        expect(paneBounds.min.z).toBeLessThan(paneBounds.max.z);
      }

      const door = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.door;
      const doorRay = new THREE.Ray(
        new THREE.Vector3(toWorld(door.centerXMm), toWorld(door.centerYMm), front - 0.02),
        new THREE.Vector3(0, 0, 1),
      );
      raycaster.set(doorRay.origin, doorRay.direction);
      raycaster.far = toWorld(geometry.building.depth + 40);
      expect(raycaster.intersectObjects(structuralMeshes, false), "the entry must be a real opening")
        .toHaveLength(0);
      const doorRect = {
        minX: door.centerXMm - door.openingWidthMm / 2,
        maxX: door.centerXMm + door.openingWidthMm / 2,
        minY: door.centerYMm - door.openingHeightMm / 2,
        maxY: door.centerYMm + door.openingHeightMm / 2,
      };
      for (const window of frontWindows) {
        const minX = window.centerXMm - window.openingWidthMm / 2;
        const maxX = window.centerXMm + window.openingWidthMm / 2;
        const minY = window.centerYMm - window.openingHeightMm / 2;
        const maxY = window.centerYMm + window.openingHeightMm / 2;
        const xOverlap = Math.min(maxX, doorRect.maxX) - Math.max(minX, doorRect.minX);
        const yOverlap = Math.min(maxY, doorRect.maxY) - Math.max(minY, doorRect.minY);
        expect(xOverlap > 0 && yOverlap > 0, `${window.id} must not overlap the entry aperture`).toBe(false);
      }

      const serviceBounds = new THREE.Box3().setFromObject(serviceReturn);
      const mainBounds = new THREE.Box3().setFromObject(mainShell);
      expect(serviceBounds.min.x).toBeCloseTo(mainBounds.max.x, 6);
      const structuralReturn = root.getObjectByName("architecture-rise-side-return");
      if (!(structuralReturn instanceof THREE.Mesh)) throw new Error("The service return wall is missing");
      const structuralReturnBounds = new THREE.Box3().setFromObject(structuralReturn);
      expect(structuralReturnBounds.max.x).toBeCloseTo(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm), 6);
      expect(Math.min(mainBounds.max.z, serviceBounds.max.z) - Math.max(mainBounds.min.z, serviceBounds.min.z))
        .toBeGreaterThan(0);
      // Allow sub-micron world-unit rounding at the exact authored roof height.
      expect(serviceBounds.max.y).toBeLessThanOrEqual(toWorld(1800) + 1e-6);

      const eastWindows = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows.filter((window) => window.elevation === "east");
      const serviceWallMeshes = mountedMeshes(serviceReturn).filter((mesh) =>
        mesh.name === "architecture-rise-side-return" || mesh.name.startsWith("architecture-rise-service-return-wall-"),
      );
      for (const window of eastWindows) {
        const apertureRay = new THREE.Ray(
          new THREE.Vector3(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm + 20),
            toWorld(window.centerYMm), toWorld(window.centerZMm)),
          new THREE.Vector3(-1, 0, 0),
        );
        raycaster.set(apertureRay.origin, apertureRay.direction);
        raycaster.far = toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm -
          ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.minXMm + 40);
        expect(raycaster.intersectObjects(serviceWallMeshes, false), `${window.id} should be cut through the return`)
          .toHaveLength(0);
      }
      console.info(JSON.stringify({
        frontWindowApertures: frontWindows.length,
        serviceWindowApertures: eastWindows.length,
        realDoorAperture: true,
        glassInsetMm: ">= 80",
        serviceReturnJointXmm: serviceBounds.min.x * 1000,
      }));
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("keeps east mullions outside the glazing and first-hit from the service elevation", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const raycaster = new THREE.Raycaster();
    try {
      root.updateMatrixWorld(true);
      const serviceBounds = new THREE.Box3().setFromObject(
        root.getObjectByName("architecture-rise-attached-service-return")!,
      );
      const returnLayout = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn;
      const eastWindows = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows.filter(
        (window) => window.elevation === "east",
      );
      expect(eastWindows).toHaveLength(2);

      const evidence = eastWindows.map((window) => {
        const prefix = `architecture-rise-window-${window.id}`;
        const glass = root.getObjectByName(`${prefix}-glazing`);
        const mullion = root.getObjectByName(`${prefix}-mullion`);
        if (!(glass instanceof THREE.Mesh) || !(mullion instanceof THREE.Mesh)) {
          throw new Error(`${window.id} must mount glazing and a mullion mesh`);
        }
        const glassBounds = new THREE.Box3().setFromObject(glass);
        const mullionBounds = new THREE.Box3().setFromObject(mullion);
        const expectedBoundsWithinReturn = [glass, mullion, ...mountedMeshes(root).filter((mesh) =>
          mesh.name.startsWith(`${prefix}-reveal-`),
        )].map((mesh) => new THREE.Box3().setFromObject(mesh));
        expectedBoundsWithinReturn.forEach((bounds) => {
          expect(bounds.min.x).toBeGreaterThanOrEqual(serviceBounds.min.x - 1e-6);
          expect(bounds.max.x).toBeLessThanOrEqual(serviceBounds.max.x + 1e-6);
          expect(bounds.min.y).toBeGreaterThanOrEqual(serviceBounds.min.y - 1e-6);
          expect(bounds.max.y).toBeLessThanOrEqual(serviceBounds.max.y + 1e-6);
          expect(bounds.min.z).toBeGreaterThanOrEqual(toWorld(returnLayout.minZMm) - 1e-6);
          expect(bounds.max.z).toBeLessThanOrEqual(toWorld(returnLayout.maxZMm) + 1e-6);
        });

        expect(mullionBounds.min.x).toBeLessThan(glassBounds.max.x);
        expect(mullionBounds.max.x).toBeGreaterThan(glassBounds.max.x);
        expect(mullionBounds.min.y).toBeCloseTo(glassBounds.min.y, 6);
        expect(mullionBounds.max.y).toBeCloseTo(glassBounds.max.y, 6);
        expect(mullion.getWorldPosition(new THREE.Vector3()).z)
          .toBeCloseTo(glass.getWorldPosition(new THREE.Vector3()).z, 6);
        expect(mullionBounds.max.z - mullionBounds.min.z)
          .toBeLessThan(glassBounds.max.z - glassBounds.min.z);

        const origin = new THREE.Vector3(
          toWorld(returnLayout.maxXMm + 60),
          toWorld(window.centerYMm),
          toWorld(window.centerZMm),
        );
        const direction = new THREE.Vector3(-1, 0, 0);
        const firstHitName = (): string | undefined => {
          raycaster.set(origin, direction);
          raycaster.near = 0;
          raycaster.far = toWorld(returnLayout.maxXMm - returnLayout.minXMm + 100);
          return raycaster.intersectObjects(mountedMeshes(root), false)[0]?.object.name;
        };

        // Recreate the reviewed offset on the mounted mesh as a negative control.
        const reviewedCenterXmm = returnLayout.maxXMm - window.glazingInsetMm - window.glazingDepthMm / 2 - 4;
        const correctedPositionX = mullion.position.x;
        mullion.position.x = toWorld(reviewedCenterXmm);
        root.updateMatrixWorld(true);
        const reviewedFirstHit = firstHitName();
        expect(reviewedFirstHit, `${window.id} reviewed offset is hidden by the glass`).toBe(glass.name);

        mullion.position.x = correctedPositionX;
        root.updateMatrixWorld(true);
        const correctedFirstHit = firstHitName();
        expect(correctedFirstHit, `${window.id} mullion must be visible before the glass`).toBe(mullion.name);

        const adjacentPaneOrigin = origin.clone();
        adjacentPaneOrigin.z += toWorld(window.mullionWidthMm / 2 + 40);
        raycaster.set(adjacentPaneOrigin, direction);
        const adjacentPaneHit = raycaster.intersectObjects(mountedMeshes(root), false)[0]?.object.name;
        expect(adjacentPaneHit, `${window.id} adjacent pane remains unobstructed`).toBe(glass.name);

        return {
          window: window.id,
          glassBoundsMm: glassBounds.clone().min.multiplyScalar(1000).toArray().concat(
            glassBounds.clone().max.multiplyScalar(1000).toArray(),
          ),
          mullionBoundsMm: mullionBounds.clone().min.multiplyScalar(1000).toArray().concat(
            mullionBounds.clone().max.multiplyScalar(1000).toArray(),
          ),
          reviewedFirstHit,
          correctedFirstHit,
          adjacentPaneHit,
        };
      });

      console.info(JSON.stringify({ eastMullionExteriorRayEvidence: evidence }));
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("keeps all canonical focus samples clear from each derived physical lens center", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const samples = canonicalFocusSamples();
    const states = [
      { id: "reset-focus", state: cameraFor() },
      { id: "minimum-focus", state: cameraFor({ focusDistanceMm: 3090 }) },
      { id: "maximum-focus", state: cameraFor({ focusDistanceMm: 13000 }) },
      { id: "rise-12", state: cameraFor({ frontRiseMm: 12 }) },
      { id: "rise-35", state: cameraFor({ frontRiseMm: 35 }) },
      { id: "mixed-movements", state: cameraFor({ frontRiseMm: 22, frontTiltDeg: 0.4, frontSwingDeg: -1.1 }) },
    ];
    try {
      root.updateMatrixWorld(true);
      expect(geometry.getArchitectureFocusChartCells()).toHaveLength(64);
      expect(geometry.getArchitectureFocusChartBars()).toHaveLength(2);
      expect(samples.filter(({ id }) => id.startsWith("fine-panel-interior-")).length).toBe(3);
      expect(samples.filter(({ id }) => id.includes("fine-detail-frame-")).length).toBe(24);
      expect(samples.filter(({ id }) => id.includes("fine-detail-line-")).length).toBe(18);
      expect(samples).toHaveLength(111);

      const stateEvidence = states.map(({ id, state }) => ({
        id,
        focusDistanceMm: state.focusDistanceMm,
        riseMm: state.frontRiseMm,
        tiltDeg: state.frontTiltDeg,
        swingDeg: state.frontSwingDeg,
        visibleSamples: assertFocusSamplesVisible(root, samples, state).firstHitNames.length,
      }));
      expect(stateEvidence.every(({ visibleSamples }) => visibleSamples === samples.length)).toBe(true);
      console.info(JSON.stringify({
        checkerSamples: 64,
        markerSamples: 2,
        finePanelInteriorSamples: 3,
        frameAndGridSamples: 24,
        fineLineSamples: 18,
        samplesPerState: samples.length,
        states: stateEvidence,
        totalRays: samples.length * states.length,
      }));

      const controlSample = samples.find(({ id }) => id === "checker-cell-0");
      if (!controlSample) throw new Error("Negative-control focus sample was not created");
      const optics = deriveOpticsState(states[0]!.state, architectureRiseScene);
      const origin = new THREE.Vector3(
        toWorld(optics.lensCenterWorld.x),
        toWorld(optics.lensCenterWorld.y),
        toWorld(optics.lensCenterWorld.z),
      );
      const target = controlSample.targetWorldMm.clone().multiplyScalar(0.001);
      const blockerCenter = origin.clone().lerp(target, 0.55);
      const blockerGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
      const blockerMaterial = new THREE.MeshBasicMaterial();
      const blocker = new THREE.Mesh(blockerGeometry, blockerMaterial);
      blocker.name = "architecture-rise-regression-negative-control-blocker";
      blocker.position.copy(blockerCenter);
      root.add(blocker);
      root.updateMatrixWorld(true);
      const blockerEvidence = findDecorativeOccluder(root, controlSample, states[0]!.state);
      expect(blockerEvidence.occluder?.object.name).toBe(blocker.name);
      expect(() => assertFocusSamplesVisible(root, [controlSample], states[0]!.state))
        .toThrow(blocker.name);
      console.info(JSON.stringify({
        negativeControl: {
          result: "detected",
          object: blockerEvidence.occluder?.object.name,
          hitDistanceM: blockerEvidence.occluder?.distance,
          targetDistanceM: blockerEvidence.targetDistance,
        },
      }));
      root.remove(blocker);
      blockerGeometry.dispose();
      blockerMaterial.dispose();
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });
});
