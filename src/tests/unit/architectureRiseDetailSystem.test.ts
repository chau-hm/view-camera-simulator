import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  ARCHITECTURE_RISE_DETAIL_STYLE,
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import { createArchitectureRiseBrickTextures } from "../../render/architecture-rise/ArchitectureRiseBrickMaterial";
import {
  getArchitectureRiseCorniceBracketCentersMm,
} from "../../render/architecture-rise/ArchitectureRiseCornice";
import { createWorldAlignedBrickBoxGeometry } from "../../render/architecture-rise/ArchitectureRiseMasonry";
import { toWorld } from "../../render/rttUtils";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { ARCHITECTURE_RISE_PRESENTATION_LAYOUT } from "../../scenes/presentation/architectureRiseLayout";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  activeTaskId: null,
  mode: "free",
});

const mountedMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
};

const requiredMesh = (root: THREE.Object3D, name: string): THREE.Mesh => {
  const object = root.getObjectByName(name);
  if (!(object instanceof THREE.Mesh)) throw new Error(`Expected mounted mesh ${name}`);
  return object;
};

const bounds = (mesh: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(mesh);

type BrickTextureStyle = typeof ARCHITECTURE_RISE_DETAIL_STYLE.masonry;
type BrickTextureEdgeSample = Readonly<{
  row: number;
  rawColumn: number;
  periodicBrickIdentity: number | null;
  isBrick: boolean;
  albedo: readonly number[];
  roughness: number;
}>;

const positiveMod = (value: number, modulus: number): number => ((value % modulus) + modulus) % modulus;

const sampleBrickTextureEdge = (
  textures: ReturnType<typeof createArchitectureRiseBrickTextures>,
  style: BrickTextureStyle,
  row: number,
  edge: "left" | "right",
): BrickTextureEdgeSample => {
  const width = textures.map.image.width;
  const height = textures.map.image.height;
  const x = edge === "left" ? 2 : width - 3;
  const coursePitchMm = style.brickHeightMm + style.mortarJointMm;
  const y = Math.floor(
    ((row * coursePitchMm + style.brickHeightMm / 2) / textures.tileHeightMm) * height,
  );
  const texelCenterXMm = ((x + 0.5) / width) * textures.tileWidthMm;
  const texelCenterYMm = ((y + 0.5) / height) * textures.tileHeightMm;
  const sampledRow = Math.floor(texelCenterYMm / coursePitchMm);
  const staggerMm = sampledRow % 2 === 0 ? 0 : (style.brickLengthMm + style.mortarJointMm) / 2;
  const brickPitchMm = style.brickLengthMm + style.mortarJointMm;
  const localBrickXMm = positiveMod(texelCenterXMm - staggerMm, brickPitchMm);
  const courseYMm = positiveMod(texelCenterYMm, coursePitchMm);
  const isBrick = courseYMm < style.brickHeightMm && localBrickXMm < style.brickLengthMm;
  const rawColumn = Math.floor((texelCenterXMm - staggerMm) / brickPitchMm);
  const periodicBrickIdentity = isBrick
    ? sampledRow * style.tileBrickPitches + positiveMod(rawColumn, style.tileBrickPitches)
    : null;
  const offset = (y * width + x) * 4;
  const albedoData = textures.map.image.data as Uint8Array;
  const roughnessData = textures.roughnessMap.image.data as Uint8Array;
  return {
    row: sampledRow,
    rawColumn,
    periodicBrickIdentity,
    isBrick,
    albedo: Array.from(albedoData.slice(offset, offset + 3)),
    roughness: roughnessData[offset]!,
  };
};

const frontFaceUvAt = (
  brickGeometry: THREE.BufferGeometry,
  centerMm: readonly [number, number, number],
  pointMm: readonly [number, number, number],
): THREE.Vector2 => {
  const positions = brickGeometry.getAttribute("position");
  const normals = brickGeometry.getAttribute("normal");
  const uvs = brickGeometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    if (Math.abs(normals.getZ(index)) < 0.5) continue;
    const xMm = centerMm[0] + positions.getX(index) * 1000;
    const yMm = centerMm[1] + positions.getY(index) * 1000;
    const zMm = centerMm[2] + positions.getZ(index) * 1000;
    if (
      Math.abs(xMm - pointMm[0]) < 1e-5 &&
      Math.abs(yMm - pointMm[1]) < 1e-5 &&
      Math.abs(zMm - pointMm[2]) < 1e-5
    ) return new THREE.Vector2(uvs.getX(index), uvs.getY(index));
  }
  throw new Error(`No facade face vertex at ${pointMm.join(",")}`);
};

const positiveEndFaceUvAt = (
  brickGeometry: THREE.BufferGeometry,
  centerMm: readonly [number, number, number],
  normalAxis: "x" | "z",
  pointMm: readonly [number, number, number],
): THREE.Vector2 => {
  const positions = brickGeometry.getAttribute("position");
  const normals = brickGeometry.getAttribute("normal");
  const uvs = brickGeometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    const normal = normalAxis === "x" ? normals.getX(index) : normals.getZ(index);
    if (normal < 0.5) continue;
    const xMm = centerMm[0] + positions.getX(index) * 1000;
    const yMm = centerMm[1] + positions.getY(index) * 1000;
    const zMm = centerMm[2] + positions.getZ(index) * 1000;
    if (
      Math.abs(xMm - pointMm[0]) < 1e-5 &&
      Math.abs(yMm - pointMm[1]) < 1e-5 &&
      Math.abs(zMm - pointMm[2]) < 1e-5
    ) return new THREE.Vector2(uvs.getX(index), uvs.getY(index));
  }
  throw new Error(`No exposed end-face vertex at ${pointMm.join(",")}`);
};

describe("Architecture Rise procedural detail system", () => {
  it("creates deterministic running-bond masonry with physical tile dimensions", () => {
    const first = createArchitectureRiseBrickTextures(ARCHITECTURE_RISE_DETAIL_STYLE.masonry);
    const second = createArchitectureRiseBrickTextures(ARCHITECTURE_RISE_DETAIL_STYLE.masonry);
    try {
      expect(first.tileWidthMm).toBe(1824);
      expect(first.tileHeightMm).toBe(608);
      expect(first.map.image.width / first.map.image.height).toBeCloseTo(first.tileWidthMm / first.tileHeightMm, 5);
      expect(first.map.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(first.roughnessMap.colorSpace).toBe(THREE.NoColorSpace);
      [first.map, first.roughnessMap, first.normalMap].forEach((texture) => {
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.image.width).toBe(first.map.image.width);
        expect(texture.image.height).toBe(first.map.image.height);
        expect((texture.image.data as Uint8Array).length).toBe(
          texture.image.width * texture.image.height * 4,
        );
      });
      expect(first.normalMap.colorSpace).toBe(THREE.NoColorSpace);
      expect(first.map.image.width).toBeGreaterThan(0);
      expect(first.map.image.height).toBeGreaterThan(0);
      expect(Array.from(first.map.image.data as Uint8Array)).toEqual(Array.from(second.map.image.data as Uint8Array));
      expect(Array.from(first.roughnessMap.image.data as Uint8Array)).toEqual(Array.from(second.roughnessMap.image.data as Uint8Array));
      expect(Array.from(first.normalMap.image.data as Uint8Array)).toEqual(Array.from(second.normalMap.image.data as Uint8Array));

      const stoneAndMortarColors = new Set<string>();
      const data = first.map.image.data as Uint8Array;
      for (let index = 0; index < data.length; index += 4) {
        stoneAndMortarColors.add(`${data[index]}-${data[index + 1]}-${data[index + 2]}`);
      }
      expect(stoneAndMortarColors.size).toBeGreaterThan(10);
    } finally {
      [first, second].forEach(({ map, roughnessMap, normalMap }) => {
        map.dispose();
        roughnessMap.dispose();
        normalMap.dispose();
      });
    }
  });

  it("keeps a staggered brick's albedo and roughness continuous across horizontal repeat seams", () => {
    const defaultStyle = ARCHITECTURE_RISE_DETAIL_STYLE.masonry;
    const styles: readonly [string, BrickTextureStyle][] = [
      ["default", defaultStyle],
      ["five-pitch tile", { ...defaultStyle, tileBrickPitches: 5 }],
    ];
    const staggeredCourse = 1;

    styles.forEach(([configuration, style]) => {
      const textures = createArchitectureRiseBrickTextures(style);
      try {
        const left = sampleBrickTextureEdge(textures, style, staggeredCourse, "left");
        const right = sampleBrickTextureEdge(textures, style, staggeredCourse, "right");
        expect(left.row, `${configuration} left sample course`).toBe(staggeredCourse);
        expect(right.row, `${configuration} right sample course`).toBe(staggeredCourse);
        expect(left.isBrick, `${configuration} left sample must be inside a brick`).toBe(true);
        expect(right.isBrick, `${configuration} right sample must be inside a brick`).toBe(true);
        expect(left.periodicBrickIdentity, `${configuration} periodic brick identity`).toBe(
          right.periodicBrickIdentity,
        );
        expect(right.albedo, `${configuration} repeat-edge albedo: ${JSON.stringify({ left, right })}`).toEqual(
          left.albedo,
        );
        expect(right.roughness, `${configuration} repeat-edge roughness: ${JSON.stringify({ left, right })}`).toBe(
          left.roughness,
        );
      } finally {
        textures.map.dispose();
        textures.roughnessMap.dispose();
        textures.normalMap.dispose();
      }
    });
  });

  it("keeps the non-staggered course's natural brick-to-mortar tile boundary", () => {
    const style = ARCHITECTURE_RISE_DETAIL_STYLE.masonry;
    const textures = createArchitectureRiseBrickTextures(style);
    try {
      const left = sampleBrickTextureEdge(textures, style, 0, "left");
      const right = sampleBrickTextureEdge(textures, style, 0, "right");
      expect(left.isBrick).toBe(true);
      expect(left.periodicBrickIdentity).toBe(0);
      expect(right.isBrick).toBe(false);
      expect(right.periodicBrickIdentity).toBeNull();
    } finally {
      textures.map.dispose();
      textures.roughnessMap.dispose();
      textures.normalMap.dispose();
    }
  });

  it("keeps physical brick UV phase continuous across segmented facade meshes", () => {
    const style = ARCHITECTURE_RISE_DETAIL_STYLE.masonry;
    const leftCenter: [number, number, number] = [-200, 0, 0];
    const rightCenter: [number, number, number] = [200, 0, 0];
    const left = createWorldAlignedBrickBoxGeometry([400, 500, 100], leftCenter, style, "x");
    const right = createWorldAlignedBrickBoxGeometry([400, 500, 100], rightCenter, style, "x");
    try {
      const sharedWorldPoint: [number, number, number] = [0, 250, 50];
      const leftUv = frontFaceUvAt(left, leftCenter, sharedWorldPoint);
      const rightUv = frontFaceUvAt(right, rightCenter, sharedWorldPoint);
      expect(leftUv.x).toBeCloseTo(rightUv.x, 6);
      expect(leftUv.y).toBeCloseTo(rightUv.y, 6);
      expect(left.userData.architectureRiseBrickUv).toMatchObject({
        axis: "x",
        tileWidthMm: 1824,
        tileHeightMm: 608,
      });
      expect(left.getAttribute("position").count).toBe(24);
      expect(right.getAttribute("position").count).toBe(24);
    } finally {
      left.dispose();
      right.dispose();
    }
  });

  it("maps exposed wall end faces along their actual world tangent", () => {
    const style = ARCHITECTURE_RISE_DETAIL_STYLE.masonry;
    const center: [number, number, number] = [320, 500, 8400];
    const frontWallEnd = createWorldAlignedBrickBoxGeometry([200, 300, 100], center, style, "x");
    const returnWallEnd = createWorldAlignedBrickBoxGeometry([100, 300, 200], center, style, "z");
    const expectedUPitch = 100 / ((style.brickLengthMm + style.mortarJointMm) * style.tileBrickPitches);
    try {
      const frontStart = positiveEndFaceUvAt(frontWallEnd, center, "x", [420, 650, 8350]);
      const frontEnd = positiveEndFaceUvAt(frontWallEnd, center, "x", [420, 650, 8450]);
      const returnStart = positiveEndFaceUvAt(returnWallEnd, center, "z", [270, 650, 8500]);
      const returnEnd = positiveEndFaceUvAt(returnWallEnd, center, "z", [370, 650, 8500]);
      expect(frontEnd.x - frontStart.x).toBeCloseTo(expectedUPitch, 6);
      expect(returnEnd.x - returnStart.x).toBeCloseTo(expectedUPitch, 6);
    } finally {
      frontWallEnd.dispose();
      returnWallEnd.dispose();
    }
  });

  it("attaches window profiles and sill brackets without crossing the actual glazing", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      root.updateMatrixWorld(true);
      const windows = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows;
      windows.forEach((window) => {
        const prefix = `architecture-rise-window-${window.id}`;
        const glassBounds = bounds(requiredMesh(root, `${prefix}-glazing`));
        const sill = bounds(requiredMesh(root, `${prefix}-stone-sill`));
        const sillCap = bounds(requiredMesh(root, `${prefix}-profile-sill-cap`));
        const lintel = bounds(requiredMesh(root, `${prefix}-stone-lintel`));
        const lintelCap = bounds(requiredMesh(root, `${prefix}-profile-lintel-cap`));
        expect(sill.intersectsBox(glassBounds), `${window.id} sill must clear its glazing`).toBe(false);
        expect(lintel.intersectsBox(glassBounds), `${window.id} lintel must clear its glazing`).toBe(false);
        expect(sillCap.intersectsBox(glassBounds), `${window.id} projecting sill must clear its glazing`).toBe(false);
        expect(lintelCap.intersectsBox(glassBounds), `${window.id} projecting lintel must clear its glazing`).toBe(false);
        expect(Math.abs(sillCap.max.y - sill.min.y)).toBeLessThan(1e-6);
        expect(Math.abs(lintelCap.min.y - lintel.max.y)).toBeLessThan(1e-6);

        const bracketSuffixes = window.elevation === "front" ? ["left", "right"] : ["near", "far"];
        bracketSuffixes.forEach((suffix) => {
          const bracketBounds = bounds(requiredMesh(root, `${prefix}-sill-bracket-${suffix}`));
          expect(Math.abs(bracketBounds.max.y - sillCap.min.y), `${window.id} ${suffix} bracket must touch sill cap`)
            .toBeLessThan(1e-6);
          expect(bracketBounds.intersectsBox(glassBounds)).toBe(false);
        });
      });

      const eastWindows = windows.filter((window) => window.elevation === "east");
      eastWindows.forEach((window) => {
        const prefix = `architecture-rise-window-${window.id}`;
        const glass = requiredMesh(root, `${prefix}-glazing`);
        const mullion = requiredMesh(root, `${prefix}-mullion`);
        const glassBounds = bounds(glass);
        const mullionBounds = bounds(mullion);
        expect(mullionBounds.max.x).toBeGreaterThan(glassBounds.max.x);
        expect(mullionBounds.min.x).toBeGreaterThanOrEqual(glassBounds.min.x - 1e-6);
        const origin = new THREE.Vector3(
          toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm + 200),
          toWorld(window.centerYMm),
          toWorld(window.centerZMm),
        );
        const direction = new THREE.Vector3(-1, 0, 0);
        const raycaster = new THREE.Raycaster(origin, direction, 0, toWorld(500));
        const firstMullionHit = raycaster.intersectObjects(mountedMeshes(root), false)[0];
        expect(firstMullionHit?.object.name).toBe(`${prefix}-mullion`);

        const paneOrigin = origin.clone();
        paneOrigin.z += toWorld(62);
        const paneRay = new THREE.Raycaster(paneOrigin, direction, 0, toWorld(500));
        const firstPaneHit = paneRay.intersectObjects(mountedMeshes(root), false)[0];
        expect(firstPaneHit?.object.name).toBe(`${prefix}-glazing`);
      });
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("keeps cornice brackets clear of upper window trim and connects every return", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    try {
      root.updateMatrixWorld(true);
      const masonry = root.getObjectByName("architecture-rise-masonry-relief");
      if (!masonry) throw new Error("Cornice and masonry relief group is missing");
      const bracketMeshes = mountedMeshes(masonry).filter((mesh) => mesh.userData.architectureRole === "cornice-support-bracket");
      const centers = getArchitectureRiseCorniceBracketCentersMm({
        facadeWidthMm: geometry.building.width,
        corniceBottomYMm: geometry.facade.mainBodyTopY - 20 - ARCHITECTURE_RISE_DETAIL_STYLE.cornice.bandHeightMm / 2,
        layout: ARCHITECTURE_RISE_PRESENTATION_LAYOUT,
        style: ARCHITECTURE_RISE_DETAIL_STYLE,
      });
      expect(bracketMeshes).toHaveLength(centers.length);
      expect(bracketMeshes.length).toBeGreaterThan(4);
      bracketMeshes.forEach((bracket) => {
        const bracketBounds = bounds(bracket);
        ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows
          .filter((window) => window.elevation === "front")
          .filter((window) => window.centerYMm + window.openingHeightMm / 2 + window.trimWidthMm + ARCHITECTURE_RISE_DETAIL_STYLE.window.outerLintelThicknessMm >=
            geometry.facade.mainBodyTopY - 20 - ARCHITECTURE_RISE_DETAIL_STYLE.cornice.bandHeightMm / 2 - ARCHITECTURE_RISE_DETAIL_STYLE.cornice.bracketHeightMm)
          .forEach((window) => {
            const openingHalfSpan = window.openingWidthMm / 2 + window.trimWidthMm + ARCHITECTURE_RISE_DETAIL_STYLE.window.outerLintelProjectionMm;
            const bracketHalfWidth = ARCHITECTURE_RISE_DETAIL_STYLE.cornice.bracketWidthMm / 2;
            const windowSafetyClearance = 20;
            const forbiddenMinX = window.centerXMm - openingHalfSpan - bracketHalfWidth - windowSafetyClearance;
            const forbiddenMaxX = window.centerXMm + openingHalfSpan + bracketHalfWidth + windowSafetyClearance;
            const centerX = bracket.position.x * 1000;
            expect(centerX <= forbiddenMinX || centerX >= forbiddenMaxX, `${bracket.name} clears ${window.id} lintel projection`).toBe(true);
            expect(bracketBounds.intersectsBox(bounds(requiredMesh(root, `architecture-rise-window-${window.id}-profile-lintel-cap`))))
              .toBe(false);
          });
      });

      const front = bounds(requiredMesh(root, "architecture-rise-cornice-front"));
      const west = bounds(requiredMesh(root, "architecture-rise-cornice-return-west"));
      const east = bounds(requiredMesh(root, "architecture-rise-cornice-return-east"));
      const back = bounds(requiredMesh(root, "architecture-rise-cornice-back"));
      expect(front.intersectsBox(west)).toBe(true);
      expect(front.intersectsBox(east)).toBe(true);
      expect(west.intersectsBox(back)).toBe(true);
      expect(east.intersectsBox(back)).toBe(true);

      const quietZones = [
        geometry.getArchitectureFocusChartCells(),
        geometry.getArchitectureFacadeFineDetailPieces(),
      ].map((pieces) => ({
        minX: Math.min(...pieces.map((piece) => piece.x - piece.width / 2)) - ARCHITECTURE_RISE_DETAIL_STYLE.masonry.quietZoneMarginMm,
        maxX: Math.max(...pieces.map((piece) => piece.x + piece.width / 2)) + ARCHITECTURE_RISE_DETAIL_STYLE.masonry.quietZoneMarginMm,
        minY: Math.min(...pieces.map((piece) => piece.y - piece.height / 2)) - ARCHITECTURE_RISE_DETAIL_STYLE.masonry.quietZoneMarginMm,
        maxY: Math.max(...pieces.map((piece) => piece.y + piece.height / 2)) + ARCHITECTURE_RISE_DETAIL_STYLE.masonry.quietZoneMarginMm,
      }));
      const detailMeshes = [
        ...mountedMeshes(masonry),
        ...mountedMeshes(root.getObjectByName("architecture-rise-entry-assembly")!),
      ];
      detailMeshes.forEach((mesh) => {
        const box = bounds(mesh);
        quietZones.forEach((zone) => {
          const overlapsProjection = box.max.x * 1000 > zone.minX && box.min.x * 1000 < zone.maxX &&
            box.max.y * 1000 > zone.minY && box.min.y * 1000 < zone.maxY;
          expect(overlapsProjection, `${mesh.name} must stay outside canonical quiet zones`).toBe(false);
        });
      });
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("detects an intentionally obstructing architectural detail in the negative control", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const state = cameraFor();
    try {
      root.updateMatrixWorld(true);
      const piece = geometry.getArchitectureFacadeFineDetailPieces().find((item) => item.role === "fine");
      if (!piece) throw new Error("Canonical fine lines are missing");
      const source = deriveOpticsState(state, architectureRiseScene).lensCenterWorld;
      const origin = new THREE.Vector3(toWorld(source.x), toWorld(source.y), toWorld(source.z));
      const target = new THREE.Vector3(toWorld(piece.x), toWorld(piece.y), toWorld(piece.z - piece.depth / 2));
      const controlCenter = origin.clone().lerp(target, 0.55);
      const blockerGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const blockerMaterial = new THREE.MeshBasicMaterial({ color: "#ff00ff" });
      const blocker = new THREE.Mesh(blockerGeometry, blockerMaterial);
      blocker.name = "architecture-rise-detail-negative-control-blocker";
      blocker.position.copy(controlCenter);
      root.add(blocker);
      root.updateMatrixWorld(true);

      const delta = target.clone().sub(origin);
      const targetDistance = delta.length();
      const raycaster = new THREE.Raycaster(origin, delta.normalize(), 0, targetDistance + 0.001);
      const firstHit = raycaster.intersectObjects(mountedMeshes(root), false)[0];
      expect(firstHit?.object.name).toBe(blocker.name);
      expect(firstHit?.distance).toBeLessThan(targetDistance);
      console.info(JSON.stringify({
        architecturalDetailNegativeControl: {
          result: "detected",
          firstHit: firstHit?.object.name,
          hitDistanceM: firstHit?.distance,
          canonicalTargetDistanceM: targetDistance,
        },
      }));
      root.remove(blocker);
      blockerGeometry.dispose();
      blockerMaterial.dispose();
    } finally {
      disposeArchitectureRiseGroup(root);
    }
  });

  it("disposes every shared and custom geometry/texture resource exactly once", () => {
    const root = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        [material.map, material.normalMap, material.roughnessMap].forEach((texture) => {
          if (texture instanceof THREE.Texture) textures.add(texture);
        });
      });
    });
    const disposedGeometry = new Map<THREE.BufferGeometry, number>();
    const disposedTexture = new Map<THREE.Texture, number>();
    geometries.forEach((item) => item.addEventListener("dispose", () => disposedGeometry.set(item, (disposedGeometry.get(item) ?? 0) + 1)));
    textures.forEach((item) => item.addEventListener("dispose", () => disposedTexture.set(item, (disposedTexture.get(item) ?? 0) + 1)));
    disposeArchitectureRiseGroup(root);
    expect([...disposedGeometry.values()]).toHaveLength(geometries.size);
    expect([...disposedTexture.values()]).toHaveLength(textures.size);
    expect([...disposedGeometry.values()].every((count) => count === 1)).toBe(true);
    expect([...disposedTexture.values()].every((count) => count === 1)).toBe(true);
  });
});
