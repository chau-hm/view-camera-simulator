import * as THREE from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { CameraMovementPresentationRegion } from "../../scenes/cameraMovementSceneCalibration";
import type { CameraMovementPresentationCalibration } from "../../scenes/cameraMovementSceneCalibration";
import type {
  CameraMovementLatticePresentation,
} from "../../scenes/presentation/understandingCameraMovements";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { toWorld } from "../rttUtils";

const edgeWeightForRole = (
  role: CameraMovementLatticePresentation["lattice"]["edges"][number]["role"],
  presentation: CameraMovementLatticePresentation["presentation"],
): number => {
  if (role === "outer-vertical") return presentation.outerVerticalWeight;
  if (role === "outer-horizontal") return presentation.outerHorizontalWeight;
  return presentation.internalEdgeWeight;
};

const colourForLatticeRegion = (
  region: CameraMovementLatticePresentation["lattice"]["edges"][number]["targetRegion"],
  presentation: CameraMovementLatticePresentation["presentation"],
): string => {
  switch (region) {
    case "upper":
      return presentation.upperRegionColour;
    case "middle":
      return presentation.middleRegionColour;
    case "lower":
      return presentation.lowerRegionColour;
    case "neutral":
      return presentation.inactiveColour;
  }
};

type LatticeStyleBatch = {
  role: CameraMovementLatticePresentation["lattice"]["edges"][number]["role"];
  targetRegion: CameraMovementLatticePresentation["lattice"]["edges"][number]["targetRegion"];
  edgeIds: string[];
  positions: number[];
};

const createStyleBatches = (
  lattice: CameraMovementLatticePresentation["lattice"],
): LatticeStyleBatch[] => {
  const batches = new Map<string, LatticeStyleBatch>();
  lattice.edges.forEach((edge) => {
    const key = `${edge.role}:${edge.targetRegion}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        role: edge.role,
        targetRegion: edge.targetRegion,
        edgeIds: [],
        positions: [],
      };
      batches.set(key, batch);
    }
    const resolvedBatch = batch;
    resolvedBatch.edgeIds.push(edge.id);
    resolvedBatch.positions.push(
      toWorld(edge.startWorld.x),
      toWorld(edge.startWorld.y),
      toWorld(edge.startWorld.z),
      toWorld(edge.endWorld.x),
      toWorld(edge.endWorld.y),
      toWorld(edge.endWorld.z),
    );
  });
  return [...batches.values()];
};

export const CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID =
  CAMERA_MOVEMENT_BASELINE_PRESENTATION.geometryId;

export type CameraMovementsGroupOptions = Readonly<{
  presentation: CameraMovementLatticePresentation;
  presentationRegion?: CameraMovementPresentationRegion;
}>;

export const cameraMovementsGroupOptionsFromPresentation = (
  presentation: CameraMovementLatticePresentation,
  presentationRegion?: CameraMovementPresentationRegion,
): CameraMovementsGroupOptions => ({ presentation, presentationRegion });

const resolveGroupOptions = (
  optionsOrPresentation?: CameraMovementsGroupOptions | CameraMovementPresentationRegion,
): Required<CameraMovementsGroupOptions> => {
  const options =
    typeof optionsOrPresentation === "object"
      ? optionsOrPresentation
      : cameraMovementsGroupOptionsFromPresentation(
          CAMERA_MOVEMENT_BASELINE_PRESENTATION,
          optionsOrPresentation,
        );
  return {
    ...options,
    presentationRegion:
      options.presentationRegion ?? options.presentation.presentation.defaultTargetRegion,
  };
};

/** Apply target highlighting without replacing the canonical lattice assets. */
export const applyCameraMovementsGroupStyle = (
  group: THREE.Group,
  presentation: CameraMovementPresentationCalibration,
  presentationRegion: CameraMovementPresentationRegion,
): void => {
  group.userData.presentationRegion = presentationRegion;
  group.traverse((object) => {
    const edgeRole = object.userData.edgeRole;
    const edgeTargetRegion = object.userData.edgeTargetRegion;
    if (
      (edgeRole !== "internal" &&
        edgeRole !== "outer-horizontal" &&
        edgeRole !== "outer-vertical") ||
      (edgeTargetRegion !== "upper" &&
        edgeTargetRegion !== "middle" &&
        edgeTargetRegion !== "lower" &&
        edgeTargetRegion !== "neutral")
    ) return;
    const selected =
      presentationRegion !== "whole" && edgeTargetRegion === presentationRegion;
    const opacity = edgeRole === "internal" ? presentation.internalEdgeOpacity : 1;
    const material = object as THREE.LineSegments & { material?: THREE.Material };
    const lineMaterial = material.material as
      | (THREE.Material & { color?: THREE.Color; linewidth?: number; opacity?: number; transparent?: boolean })
      | undefined;
    if (!lineMaterial) return;
    lineMaterial.color?.set(colourForLatticeRegion(edgeTargetRegion, presentation));
    if (typeof lineMaterial.linewidth === "number") {
      lineMaterial.linewidth = edgeWeightForRole(edgeRole, presentation);
    }
    if (typeof lineMaterial.opacity === "number") lineMaterial.opacity = opacity;
    if (typeof lineMaterial.transparent === "boolean") lineMaterial.transparent = opacity < 1;
    object.userData.lineOpacity = opacity;
    object.userData.selectedTarget = selected;
  });
};

/** Construct the current Three.js implementation from semantic presentation data. */
export function createCameraMovementsGroup(
  optionsOrPresentation?: CameraMovementsGroupOptions | CameraMovementPresentationRegion,
): THREE.Group {
  const {
    presentation: contract,
    presentationRegion,
  } = resolveGroupOptions(optionsOrPresentation);
  const { lattice, presentation } = contract;
  const group = new THREE.Group();
  group.name = "camera-movements-lattice-subject";
  group.userData.resourceOwnership = "owned";
  group.userData.semanticObjectId = contract.object.id;
  group.userData.presentationRegion = presentationRegion;
  group.userData.canonicalGeometryId = contract.geometryId;
  group.userData.canonicalGeometryKey = contract.geometryKey;
  group.userData.presentationKey = contract.presentationKey;
  group.userData.resourceKey = `${contract.geometryKey}|${contract.presentationKey}`;
  group.userData.canonicalEdgeCount = lattice.edges.length;
  group.userData.canonicalEdgeIds = lattice.edges.map(({ id }) => id);
  group.userData.canonicalUnits = lattice.units;
  group.userData.canonicalBounds = contract.subjectBoundsWorldMm;

  createStyleBatches(lattice).forEach((batch) => {
    const selected =
      presentationRegion !== "whole" && batch.targetRegion === presentationRegion;
    const opacity = batch.role === "internal" ? presentation.internalEdgeOpacity : 1;
    const weight = edgeWeightForRole(batch.role, presentation);
    const lineGeometry = new LineSegmentsGeometry();
    lineGeometry.setPositions(batch.positions);
    lineGeometry.computeBoundingBox();
    lineGeometry.computeBoundingSphere();

    const lineMaterial = new LineMaterial({
      color: colourForLatticeRegion(batch.targetRegion, presentation),
      linewidth: weight,
      opacity,
      transparent: opacity < 1,
      depthTest: true,
      depthWrite: true,
    });
    const segments = new LineSegments2(lineGeometry, lineMaterial);
    segments.name = `camera-movements-lattice-${batch.role}-${batch.targetRegion}`;
    segments.userData.edgeRole = batch.role;
    segments.userData.edgeTargetRegion = batch.targetRegion;
    segments.userData.canonicalEdgeIds = batch.edgeIds;
    segments.userData.lineWeight = weight;
    segments.userData.lineOpacity = opacity;
    segments.userData.selectedTarget = selected;
    segments.computeLineDistances();
    group.add(segments);
  });

  const gridSizeWorld = toWorld(contract.referenceGrid.halfExtentMm * 2);
  const gridDivisions = Math.max(
    1,
    Math.round((contract.referenceGrid.halfExtentMm * 2) / contract.referenceGrid.cellSizeMm),
  );
  const referenceGrid = new THREE.GridHelper(
    gridSizeWorld,
    gridDivisions,
    presentation.inactiveColour,
    presentation.inactiveColour,
  );
  referenceGrid.name = "camera-movements-reference-grid";
  referenceGrid.position.set(
    toWorld(contract.referenceGrid.centerWorldMm.x),
    toWorld(contract.referenceGrid.centerWorldMm.y),
    toWorld(contract.referenceGrid.centerWorldMm.z),
  );
  referenceGrid.userData.geometryKey = contract.geometryKey;
  referenceGrid.userData.presentationKey = contract.presentationKey;
  referenceGrid.userData.canonicalEdgeIds = [];
  referenceGrid.userData.cellSizeMm = contract.referenceGrid.cellSizeMm;
  referenceGrid.userData.halfExtentMm = contract.referenceGrid.halfExtentMm;
  const gridMaterials = Array.isArray(referenceGrid.material)
    ? referenceGrid.material
    : [referenceGrid.material];
  gridMaterials.forEach((material) => {
    material.transparent = presentation.internalEdgeOpacity < 1;
    material.opacity = presentation.internalEdgeOpacity;
    material.depthWrite = false;
  });
  group.add(referenceGrid);

  return group;
}

/** Dispose every resource owned by this lattice asset exactly once. */
export function disposeCameraMovementsGroup(group: THREE.Group): void {
  if (group.userData.resourcesDisposed === true) return;
  group.userData.resourcesDisposed = true;

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
      return;
    }
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      if (material) materials.add(material);
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  group.userData.disposedGeometryCount = geometries.size;
  group.userData.disposedMaterialCount = materials.size;
}
