import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
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

const physicalCameraStates = () => [
  { id: "reset-focus", state: cameraFor() },
  { id: "minimum-focus", state: cameraFor({ focusDistanceMm: 3090 }) },
  { id: "maximum-focus", state: cameraFor({ focusDistanceMm: 13000 }) },
  { id: "rise-12", state: cameraFor({ frontRiseMm: 12 }) },
  { id: "rise-35", state: cameraFor({ frontRiseMm: 35 }) },
  { id: "mixed-movements", state: cameraFor({ frontRiseMm: 22, frontTiltDeg: 0.4, frontSwingDeg: -1.1 }) },
];

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
      // Probe both the opening and the stone spandrel through the complete front assembly.
      const doorRadius = door.openingWidthMm / 2;
      const springY = door.centerYMm + door.openingHeightMm / 2 - doorRadius;
      const frontHit = (xMm: number, yMm: number) => {
        raycaster.set(
          new THREE.Vector3(toWorld(door.centerXMm + xMm), toWorld(springY + yMm), front - 0.3),
          new THREE.Vector3(0, 0, 1),
        );
        return raycaster.intersectObjects(mountedMeshes(root), false)[0]?.object.name;
      };
      expect(frontHit(0.3 * doorRadius, 0.65 * doorRadius)).toBe("architecture-rise-entry-fanlight");
      expect(frontHit(0.9 * doorRadius, 0.65 * doorRadius)).toBe("architecture-rise-entry-arch-stones");
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

  it("exposes recessed rear windows and the service door through the mounted masonry", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      root.updateMatrixWorld(true);
      const meshes = mountedMeshes(root);
      const back = toWorld(geometry.facade.backFacadeZ);
      const rearWall = root.getObjectByName("architecture-rise-rear-wall");
      if (!rearWall) throw new Error("Missing structural rear wall");
      const structuralMeshes = mountedMeshes(rearWall);
      expect(structuralMeshes.length).toBeGreaterThan(0);
      const castInward = (x: number, y: number, objects = meshes) => {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x, y, back + 0.35), new THREE.Vector3(0, 0, -1), 0, 0.7,
        );
        return ray.intersectObjects(objects, false)[0];
      };
      const requiredBounds = (name: string) => {
        const mesh = root.getObjectByName(name);
        if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing rear assembly part ${name}`);
        return new THREE.Box3().setFromObject(mesh);
      };
      const openings = ["room-ground", "room-middle", "room-top", "stair-lower", "stair-upper"];
      for (const id of openings) {
        const prefix = `architecture-rise-rear-${id}`;
        const glass = requiredBounds(`${prefix}-glazing`);
        const center = glass.getCenter(new THREE.Vector3());
        const size = glass.getSize(new THREE.Vector3());
        const sill = requiredBounds(`${prefix}-sill`);
        const lintel = requiredBounds(`${prefix}-lintel`);
        expect(back - glass.max.z, id).toBeGreaterThanOrEqual(toWorld(80));
        expect(sill.intersectsBox(glass), `${id} sill clears glazing`).toBe(false);
        expect(lintel.intersectsBox(glass), `${id} lintel clears glazing`).toBe(false);

        // The stone and brick meet inside the reveal. A ray from the void must
        // encounter the exposed stone before the masonry to avoid coplanar faces.
        const insideReveal = new THREE.Vector3(center.x + size.x / 4, center.y, back - toWorld(40));
        for (const [part, directionY] of [["sill", -1], ["lintel", 1]] as const) {
          const ray = new THREE.Raycaster(insideReveal, new THREE.Vector3(0, directionY, 0), 0, 1);
          const stone = ray.intersectObjects(meshes, false)[0];
          const brick = ray.intersectObjects(structuralMeshes, false)[0];
          expect(stone?.object.name, `${id} first visible ${part} surface`).toBe(`${prefix}-${part}`);
          if (!brick || !stone) throw new Error(`Missing mounted ${part} or its masonry bearing for ${id}`);
          expect(brick.distance - stone.distance, `${id} separates ${part} from its bearing`)
            .toBeGreaterThan(toWorld(0.1));
        }

        // Cast from the service yard into each quadrant, clear of the intended sash bars.
        for (const signX of [-1, 1]) {
          for (const signY of [-1, 1]) {
            const x = center.x + signX * size.x / 4;
            const y = center.y + signY * size.y / 4;
            expect(castInward(x, y, structuralMeshes), id).toBeUndefined();
            expect(castInward(x, y)?.object.name, id).toBe(`${prefix}-glazing`);
          }
        }
        const transom = requiredBounds(`${prefix}-transom`);
        const transomY = transom.getCenter(new THREE.Vector3()).y;
        expect(castInward(center.x + size.x / 4, transomY)?.object.name, id).toBe(`${prefix}-transom`);
        // A masonry hit just beyond each jamb makes the through-opening probes meaningful.
        for (const x of [glass.min.x - 0.1, glass.max.x + 0.1]) {
          expect(castInward(x, center.y, structuralMeshes), `${id} jamb`).toBeDefined();
        }
      }
      const door = requiredBounds("architecture-rise-rear-service-door-leaf");
      const doorCenter = door.getCenter(new THREE.Vector3());
      expect(castInward(doorCenter.x, doorCenter.y, structuralMeshes)).toBeUndefined();
      expect(castInward(doorCenter.x, doorCenter.y)?.object.name).toBe("architecture-rise-rear-service-door-leaf");
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("joins the recessed roof deck to all four parapet walls", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      root.updateMatrixWorld(true);
      const roofBounds = (name: string) => {
        const mesh = root.getObjectByName(`architecture-rise-roof-${name}`);
        if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing roof part ${name}`);
        return new THREE.Box3().setFromObject(mesh);
      };
      const deck = roofBounds("deck");
      const front = roofBounds("parapet");
      const rear = roofBounds("parapet-rear");
      const west = roofBounds("parapet-west");
      const east = roofBounds("parapet-east");
      expect(deck.min.z).toBeCloseTo(front.max.z, 6);
      expect(deck.max.z).toBeCloseTo(rear.min.z, 6);
      expect(deck.min.x).toBeCloseTo(west.max.x, 6);
      expect(deck.max.x).toBeCloseTo(east.min.x, 6);
      for (const wall of [front, rear, west, east]) {
        expect(deck.max.y).toBeGreaterThan(wall.min.y);
        expect(deck.max.y).toBeLessThan(wall.max.y);
      }
      const center = deck.getCenter(new THREE.Vector3());
      center.y = toWorld(geometry.facade.parapetTopY + 100);
      const fromAbove = new THREE.Raycaster(center, new THREE.Vector3(0, -1, 0));
      const meshes = mountedMeshes(root);
      expect(fromAbove.intersectObjects(meshes, false)[0]?.object.name).toBe("architecture-rise-roof-deck");

      // Probe both ends and the centre of each run, just inside the wall footprint.
      // Deduplicate the two triangles of a single face when a probe lies on its diagonal.
      const half = toWorld(geometry.building.width / 2 - 10);
      const frontZ = toWorld(geometry.facade.frontFacadeZ + 10);
      const rearZ = toWorld(geometry.facade.backFacadeZ - 10);
      const capProbes = [
        ...[-half, -0.4, half].flatMap(x => [[x, frontZ], [x, rearZ]] as const),
        [-half, center.z], [half, center.z],
        [toWorld(geometry.building.width / 2 - 120), frontZ],
      ] as const;
      for (const [x, z] of capProbes) {
        fromAbove.ray.origin.set(x, center.y, z);
        const hits = fromAbove.intersectObjects(meshes, false);
        const top = hits[0];
        expect(top?.object.name).toMatch(/(?:coping|pier-cap)/);
        if (!top) throw new Error("Missing roof finish");
        const coincident = hits.filter(hit => Math.abs(hit.distance - top.distance) < toWorld(0.1));
        expect(new Set(coincident.map(hit => hit.object)).size, `coincident cap faces at (${x}, ${z})`).toBe(1);
      }
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
    const root = createRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, {
      presentation: ARCHITECTURE_RISE_PRESENTATION,
    });
    const samples = canonicalFocusSamples();
    const states = physicalCameraStates();
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
      disposeRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, root);
    }
  });
  it("preserves roofline, facade, street sign and depth-reference sightlines in the mounted streetscape", () => {
    const root = createRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, {
      presentation: ARCHITECTURE_RISE_PRESENTATION,
    });
    try {
      const environment = root.getObjectByName("architecture-rise-urban-environment");
      if (!environment) throw new Error("Architecture Rise urban environment is not mounted");
      root.updateMatrixWorld(true);
      const urbanMeshes = new Set(mountedMeshes(environment));
      expect(urbanMeshes.size).toBeGreaterThan(0);
      const existingMeshes = mountedMeshes(root).filter(mesh => !urbanMeshes.has(mesh));
      const front = geometry.facade.frontFacadeZ;
      const roof = geometry.compositionTargets.buildingTop;
      const main = geometry.compositionTargets.buildingMain;
      const probes = [
        ...[roof.min.x, 0, roof.max.x].flatMap(x =>
          [geometry.facade.parapetTopY - 30, geometry.facade.parapetBottomY + 75]
            .map(y => ({ id: "roofline", x, y, z: front + 40 }))),
        ...[main.min.x * 0.72, 0, main.max.x * 0.72].flatMap(x =>
          [main.min.y + 250, 600, main.max.y - 450]
            .map(y => ({ id: "main-body", x, y, z: front + 180 }))),
        ...ARCHITECTURE_RISE_PRESENTATION.referenceObjects.flatMap(ref =>
          [-0.25, 0, 0.25].map(fraction => ({
            id: ref.id, x: ref.x + fraction * ref.width,
            y: geometry.ground.y + ref.height / 2, z: ref.z,
          }))),
        ...[-0.28, 0, 0.28].map(fraction => {
          const sign = geometry.streetContext.streetSign;
          return { id: "street-sign", x: sign.x, y: sign.panelCenterY + fraction * sign.faceHeight, z: sign.z };
        }),
      ];
      const { position } = architectureRiseScene.cameraPlacement!;
      const views = [
        ...physicalCameraStates().map(({ id, state }) => ({
          id, position: deriveOpticsState(state, architectureRiseScene).lensCenterWorld,
        })),
        { id: "observer-reset", position },
      ];
      const world = (p: { x: number; y: number; z: number }) =>
        new THREE.Vector3(toWorld(p.x), toWorld(p.y), toWorld(p.z));
      const all = mountedMeshes(root);
      for (const view of views) {
        const origin = world(view.position);
        for (const probe of probes) {
          const direction = world(probe).sub(origin);
          const ray = new THREE.Raycaster(origin, direction.clone().normalize(), 0, direction.length() + 0.12);
          const before = ray.intersectObjects(existingMeshes, false)[0];
          const after = ray.intersectObjects(all, false)[0];
          // A probe can meet a canonical surface in front of its nominal point,
          // such as the facade in front of a far-side reference from the lens.
          expect(before?.object, `${view.id} ${probe.id} baseline surface`).toBeDefined();
          expect(after?.object.name, `${view.id} ${probe.id} first surface`).toBe(before?.object.name);
        }
      }

      const state = physicalCameraStates()[0].state;
      const sample = canonicalFocusSamples()[0];
      const { origin, target } = findDecorativeOccluder(root, sample, state);
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), new THREE.MeshStandardMaterial());
      blocker.name = "architecture-rise-urban-building-negative-control";
      blocker.position.copy(origin).lerp(target, 0.52);
      environment.add(blocker);
      root.updateMatrixWorld(true);
      try {
        expect(() => assertFocusSamplesVisible(root, [sample], state)).toThrow(blocker.name);
      } finally {
        blocker.removeFromParent();
        blocker.geometry.dispose();
        blocker.material.dispose();
      }
      expect(assertFocusSamplesVisible(root, [sample], state).firstHitNames).toHaveLength(1);
      console.info(JSON.stringify({
        additionalSightlines: { probes: probes.length, views: views.map(view => view.id), totalRays: probes.length * views.length },
        environmentNegativeControl: "detected, removed, and visibility recovered",
      }));
    } finally {
      disposeRegisteredSceneAsset(ARCHITECTURE_RISE_ASSET_KEY, root);
    }
  });

});
