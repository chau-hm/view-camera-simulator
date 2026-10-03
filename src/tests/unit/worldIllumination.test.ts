import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import {
  EMPTY_WORLD_ILLUMINATION,
  worldIlluminationPointToWorld,
} from "../../render/worldIlluminationContract";
import {
  createWorldIlluminationRig,
  disposeWorldIlluminationRig,
} from "../../render/worldIlluminationRig";

describe("world illumination contract", () => {
  it("resolves one artificial Interior Corner point source in scene millimetres", () => {
    const resolved = resolveSceneWorldIllumination("interior-corner");
    expect(resolved.sources).toHaveLength(1);
    const [source] = resolved.sources;
    expect(source).toMatchObject({
      id: "interior-corner-local-light",
      category: "artificial",
      kind: "point",
      color: "#fff1d6",
      intensity: 5,
      distanceMm: 7500,
      decay: 2,
      castsShadow: false,
      positionMm: {
        x: 420,
        y: INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310,
        z: 8300,
      },
    });
    expect(worldIlluminationPointToWorld(source)).toMatchObject({
      distance: 7.5,
      position: [0.42, (INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310) / 1000, 8.3],
      castShadow: false,
    });
  });

  it.each([
    "architecture-rise",
    "table-tilt",
    "macro-bellows-extension",
  ])("returns an immutable empty fallback for %s", (sceneId) => {
    expect(resolveSceneWorldIllumination(sceneId)).toBe(EMPTY_WORLD_ILLUMINATION);
  });

  it("freezes the resolved world source list", () => {
    expect(Object.isFrozen(resolveSceneWorldIllumination("interior-corner"))).toBe(true);
    expect(Object.isFrozen(resolveSceneWorldIllumination("interior-corner").sources)).toBe(true);
  });

  it("owns and removes one light per resolved point source", () => {
    const scene = new THREE.Scene();
    const resolved = resolveSceneWorldIllumination("interior-corner");
    const rig = createWorldIlluminationRig(scene, resolved);
    expect(rig.lights).toHaveLength(1);
    const light = rig.lights[0];
    expect(light).toBeInstanceOf(THREE.PointLight);
    expect(light.parent).toBe(scene);
    expect(light.name).toBe("interior-corner-local-light");
    expect((light as THREE.PointLight).color.equals(new THREE.Color("#fff1d6"))).toBe(true);
    expect((light as THREE.PointLight).intensity).toBe(5);
    expect((light as THREE.PointLight).distance).toBe(7.5);
    expect((light as THREE.PointLight).decay).toBe(2);
    expect((light as THREE.PointLight).position.toArray()).toEqual([
      0.42,
      (INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310) / 1000,
      8.3,
    ]);
    expect((light as THREE.PointLight).castShadow).toBe(false);
    const dispose = vi.spyOn(light, "dispose");
    disposeWorldIlluminationRig(scene, rig);
    expect(light.parent).toBeNull();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
  });

  it("constructs every point source in a multi-source list", () => {
    const scene = new THREE.Scene();
    const resolved = {
      sources: [
        ...resolveSceneWorldIllumination("interior-corner").sources,
        {
          id: "synthetic-fill",
          category: "artificial" as const,
          kind: "point" as const,
          color: "#ffffff",
          intensity: 1.25,
          positionMm: { x: -100, y: 200, z: 300 },
          distanceMm: 1000,
          decay: 1,
          castsShadow: false,
        },
      ],
    } as const;
    const rig = createWorldIlluminationRig(scene, resolved);
    expect(rig.lights.map((light) => light.name)).toEqual([
      "interior-corner-local-light",
      "synthetic-fill",
    ]);
    expect(scene.children).toHaveLength(2);
    disposeWorldIlluminationRig(scene, rig);
    expect(scene.children).toHaveLength(0);
  });
});
