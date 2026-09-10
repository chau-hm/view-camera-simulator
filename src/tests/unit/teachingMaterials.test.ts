import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createFocusFriendlyMaterial,
  disposeTeachingSubjectResources,
} from "../../render/TeachingMaterials";
import { createTeachingTexture } from "../../render/TeachingTextures";
import {
  createArchitectureForegroundGroup,
  disposeArchitectureForegroundGroup,
} from "../../render/ArchitectureForegroundSubjectFactory";
import {
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "../../render/TableTiltSubjectFactory";
import {
  createObliqueTabletopGroup,
  disposeObliqueTabletopGroup,
} from "../../render/ObliqueTabletopSubjectFactory";
import {
  createShelfSwingGroup,
  disposeShelfSwingGroup,
} from "../../render/ShelfSwingSubjectFactory";
import {
  createInteriorCornerGroup,
  disposeInteriorCornerGroup,
} from "../../render/InteriorCornerSubjectFactory";
import {
  createMirrorShiftRttGroup,
  disposeMirrorShiftGroup,
} from "../../render/MirrorShiftSubjectFactory";

const expectMappedStandardMaterial = (object: THREE.Object3D | undefined): void => {
  expect(object).toBeInstanceOf(THREE.Mesh);
  if (!(object instanceof THREE.Mesh)) return;
  expect(object.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  if (!(object.material instanceof THREE.MeshStandardMaterial)) return;
  expect(object.material.map).toBeInstanceOf(THREE.DataTexture);
  expect(object.material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
};

describe("focus-friendly teaching materials", () => {
  it("creates deterministic repeating color textures with mip-safe filtering", () => {
    const texture = createTeachingTexture({
      pattern: "fine-grid",
      primaryColor: "#d8e1e7",
      secondaryColor: "#a9bbca",
      repeat: [5, 4],
    });
    const sameTexture = createTeachingTexture({
      pattern: "fine-grid",
      primaryColor: "#d8e1e7",
      secondaryColor: "#a9bbca",
      repeat: [5, 4],
    });

    expect(texture.image).toMatchObject({ width: 64, height: 64 });
    expect(texture.image.data).toEqual(sameTexture.image.data);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(texture.magFilter).toBe(THREE.LinearFilter);
    expect(texture.repeat.x).toBe(5);
    expect(texture.repeat.y).toBe(4);
    texture.dispose();
    sameTexture.dispose();
  });

  it("uses lit mapped materials on representative photographic surfaces", () => {
    const architecture = createArchitectureForegroundGroup();
    const tableTilt = createTableTiltGroup();
    const obliqueTabletop = createObliqueTabletopGroup();
    const shelf = createShelfSwingGroup();
    const interior = createInteriorCornerGroup();
    const mirror = createMirrorShiftRttGroup();

    try {
      expectMappedStandardMaterial(
        architecture.getObjectByName("architecture-foreground-front-facade"),
      );
      expectMappedStandardMaterial(tableTilt.getObjectByName("table-tilt-tabletop"));
      expectMappedStandardMaterial(
        obliqueTabletop.getObjectByName("oblique-tabletop-subject-board-plan-surface"),
      );
      expectMappedStandardMaterial(
        shelf.getObjectByName("shelf-swing-middle-station-chart-backing"),
      );
      expectMappedStandardMaterial(interior.getObjectByName("interior-corner-back-wall"));

      const mirroredProp = mirror
        .getObjectByName("mirror-shift-real-props")
        ?.children.find((child) => child instanceof THREE.Mesh);
      expectMappedStandardMaterial(mirroredProp);
    } finally {
      disposeArchitectureForegroundGroup(architecture);
      disposeTableTiltGroup(tableTilt);
      disposeObliqueTabletopGroup(obliqueTabletop);
      disposeShelfSwingGroup(shelf);
      disposeInteriorCornerGroup(interior);
      disposeMirrorShiftGroup(mirror);
    }
  });

  it("disposes subject-owned texture maps with their materials", () => {
    const root = new THREE.Group();
    const material = createFocusFriendlyMaterial({
      pattern: "linear-grain",
      primaryColor: "#594c40",
      secondaryColor: "#765f4d",
    });
    const texture = material.map;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    root.add(mesh);

    let textureDisposed = false;
    texture?.addEventListener("dispose", () => {
      textureDisposed = true;
    });

    disposeTeachingSubjectResources(root);

    expect(textureDisposed).toBe(true);
  });
});
