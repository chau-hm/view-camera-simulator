import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createArchitectureForegroundGroup,
  disposeArchitectureForegroundGroup,
} from "../../render/ArchitectureForegroundSubjectFactory";
import {
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "../../render/TableTiltSubjectFactory";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../../scenes/presentation/architectureForeground";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import {
  canonicalGeometrySignature,
  completeSubjectSignature,
} from "./helpers/canonicalSubjectSignatures";

const disposeTestRoots = (...roots: readonly THREE.Object3D[]): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  roots.forEach((root) => root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  }));
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
};

const createTriangle = (indices: number[] = [0, 1, 2]): THREE.Group => {
  const group = new THREE.Group();
  group.name = "test-subject";
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ], 3));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: "#8a6848" }));
  mesh.name = "test-triangle";
  group.add(mesh);
  return group;
};

const rectangleWithHole = (holeWidth = 0.5): THREE.Shape => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(4, 0);
  shape.lineTo(4, 3);
  shape.lineTo(0, 3);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(1, 1);
  hole.lineTo(1 + holeWidth, 1);
  hole.lineTo(1 + holeWidth, 2);
  hole.lineTo(1, 2);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
};

const createExtrudedShape = (depth: number, holeWidth = 0.5): THREE.Group => {
  const group = new THREE.Group();
  group.name = "test-extrusion-subject";
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rectangleWithHole(holeWidth), { depth, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: "#b8a080" }),
  );
  mesh.name = "test-extrusion";
  group.add(mesh);
  return group;
};

const mutateTestOwnedPosition = (root: THREE.Group, meshName: string): void => {
  const mesh = root.getObjectByName(meshName);
  if (!(mesh instanceof THREE.Mesh)) throw new Error(`Missing mesh ${meshName}`);
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  position.array[0] = Number(position.array[0]) + 0.01;
  position.needsUpdate = true;
};

describe("canonical test subject signatures", () => {
  it("matches independently mounted Table Tilt geometry and normalizes only its generated Shape UUID", () => {
    const first = createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
    const second = createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
    try {
      const extrusionNames = [
        "table-tilt-studio-rear-wall",
        "table-tilt-studio-side-wall",
        "table-tilt-studio-window-frame",
      ];
      for (const name of extrusionNames) {
        const firstMesh = first.getObjectByName(name) as THREE.Mesh;
        const secondMesh = second.getObjectByName(name) as THREE.Mesh;
        const firstShape = (firstMesh.geometry as THREE.BufferGeometry & {
          parameters: { shapes: THREE.Shape };
        }).parameters.shapes;
        const secondShape = (secondMesh.geometry as THREE.BufferGeometry & {
          parameters: { shapes: THREE.Shape };
        }).parameters.shapes;
        expect(firstShape.uuid).not.toBe(secondShape.uuid);
      }
      expect(canonicalGeometrySignature(first)).toBe(canonicalGeometrySignature(second));
    } finally {
      disposeTableTiltGroup(first);
      disposeTableTiltGroup(second);
    }
  });

  it("matches equivalent extrusions with different Shape UUIDs while retaining their holes", () => {
    const first = createExtrudedShape(0.25);
    const second = createExtrudedShape(0.25);
    try {
      const firstShape = ((first.getObjectByName("test-extrusion") as THREE.Mesh)
        .geometry as THREE.BufferGeometry & { parameters: { shapes: THREE.Shape } }).parameters.shapes;
      const secondShape = ((second.getObjectByName("test-extrusion") as THREE.Mesh)
        .geometry as THREE.BufferGeometry & { parameters: { shapes: THREE.Shape } }).parameters.shapes;
      expect(firstShape.uuid).not.toBe(secondShape.uuid);
      expect(firstShape.holes[0]?.curves).toEqual(secondShape.holes[0]?.curves);
      expect(canonicalGeometrySignature(first)).toBe(canonicalGeometrySignature(second));
    } finally {
      disposeTestRoots(first, second);
    }
  });

  it("matches independently mounted Architecture + Foreground subjects", () => {
    const first = createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION });
    const second = createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION });
    try {
      expect(canonicalGeometrySignature(first)).toBe(canonicalGeometrySignature(second));
    } finally {
      disposeArchitectureForegroundGroup(first);
      disposeArchitectureForegroundGroup(second);
    }
  });

  it("detects changes to the protected Architecture + Foreground subject and accepted courtyard", () => {
    const original = createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION });
    const changedProtected = createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION });
    const changedCourtyard = createArchitectureForegroundGroup({ presentation: ARCHITECTURE_FOREGROUND_PRESENTATION });
    const protectedName = "architecture-foreground-front-joinery";
    const courtyardName = "courtyard-ground-approach";
    const coreOptions = { skipSubtreeNames: ["architecture-foreground-courtyard-environment"] };
    try {
      const originalCore = canonicalGeometrySignature(original, coreOptions);
      mutateTestOwnedPosition(changedProtected, protectedName);
      expect(canonicalGeometrySignature(changedProtected, coreOptions)).not.toBe(originalCore);

      const originalFull = canonicalGeometrySignature(original);
      mutateTestOwnedPosition(changedCourtyard, courtyardName);
      expect(canonicalGeometrySignature(changedCourtyard)).not.toBe(originalFull);
    } finally {
      disposeArchitectureForegroundGroup(original);
      disposeArchitectureForegroundGroup(changedProtected);
      disposeArchitectureForegroundGroup(changedCourtyard);
    }
  });

  it("rejects changed vertex data, index topology, and world transforms", () => {
    const original = createTriangle();
    const movedVertex = createTriangle();
    const changedIndex = createTriangle([0, 2, 1]);
    const movedTransform = createTriangle();
    (movedTransform.getObjectByName("test-triangle") as THREE.Mesh).position.x = 0.1;
    try {
      expect(canonicalGeometrySignature(movedVertex)).toBe(canonicalGeometrySignature(original));
      const movedMesh = movedVertex.getObjectByName("test-triangle") as THREE.Mesh;
      const position = movedMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      position.array[0] = 0.01;
      position.needsUpdate = true;
      expect(canonicalGeometrySignature(movedVertex)).not.toBe(canonicalGeometrySignature(original));
      expect(canonicalGeometrySignature(changedIndex)).not.toBe(canonicalGeometrySignature(original));
      expect(canonicalGeometrySignature(movedTransform)).not.toBe(canonicalGeometrySignature(original));
    } finally {
      disposeTestRoots(original, movedVertex, changedIndex, movedTransform);
    }
  });

  it("rejects extrusion depth and Shape hole geometry changes", () => {
    const original = createExtrudedShape(0.25);
    const changedDepth = createExtrudedShape(0.26);
    const changedHole = createExtrudedShape(0.25, 0.6);
    try {
      expect(canonicalGeometrySignature(changedDepth)).not.toBe(canonicalGeometrySignature(original));
      expect(canonicalGeometrySignature(changedHole)).not.toBe(canonicalGeometrySignature(original));
    } finally {
      disposeTestRoots(original, changedDepth, changedHole);
    }
  });

  it("detects geometry draw-range and material-group changes", () => {
    const original = createTriangle();
    const changed = createTriangle();
    const originalGeometry = (original.getObjectByName("test-triangle") as THREE.Mesh).geometry;
    const changedGeometry = (changed.getObjectByName("test-triangle") as THREE.Mesh).geometry;
    originalGeometry.addGroup(0, 3, 0);
    changedGeometry.addGroup(0, 3, 1);
    changedGeometry.setDrawRange(0, 2);
    try {
      expect(canonicalGeometrySignature(changed)).not.toBe(canonicalGeometrySignature(original));
    } finally {
      disposeTestRoots(original, changed);
    }
  });

  it("detects material-assignment identity and focus-critical material changes", () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const shared = new THREE.MeshStandardMaterial({ color: "#334455", roughness: 0.8 });
    const separate = new THREE.MeshStandardMaterial({ color: "#334455", roughness: 0.8 });
    const sharedRoot = new THREE.Group();
    const separateRoot = new THREE.Group();
    sharedRoot.add(new THREE.Mesh(geometry, shared), new THREE.Mesh(geometry, shared));
    separateRoot.add(new THREE.Mesh(geometry.clone(), shared.clone()), new THREE.Mesh(geometry.clone(), separate));
    const focusRoot = new THREE.Group();
    const focus = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#334455", roughness: 0.8 }),
    );
    focus.name = "focus-critical-material";
    focusRoot.add(focus);
    const baselineFocus = completeSubjectSignature(focusRoot);
    (focus.material as THREE.MeshStandardMaterial).color.set("#445566");
    try {
      expect(completeSubjectSignature(separateRoot)).not.toBe(completeSubjectSignature(sharedRoot));
      expect(completeSubjectSignature(focusRoot)).not.toBe(baselineFocus);
    } finally {
      disposeTestRoots(sharedRoot, separateRoot, focusRoot);
    }
  });
});
