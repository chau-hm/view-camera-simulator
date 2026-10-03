import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import {
  EMPTY_WORLD_ILLUMINATION,
  worldIlluminationDirectionalToWorld,
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
    if (source.kind !== "point") {
      throw new Error("Expected the Interior Corner point source");
    }
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

  it("resolves Architecture Rise daylight at its canonical facade anchor", () => {
    const resolved = resolveSceneWorldIllumination("architecture-rise");
    expect(resolved.sources).toHaveLength(1);
    const [source] = resolved.sources;
    if (source.kind !== "directional") {
      throw new Error("Expected the Architecture Rise directional source");
    }
    const { building, facade } = ARCHITECTURE_RISE_PRESENTATION.geometry;
    const targetMm = {
      x: building.center.x,
      y: building.center.y,
      z: facade.frontFacadeZ,
    };

    expect(source).toMatchObject({
      id: "architecture-rise-daylight",
      category: "natural",
      kind: "directional",
      color: "#fff8ee",
      intensity: 0.8,
      castsShadow: false,
      positionMm: {
        x: targetMm.x - 6000,
        y: targetMm.y + 8000,
        z: targetMm.z - 9000,
      },
      targetMm,
    });
    expect(worldIlluminationDirectionalToWorld(source)).toEqual({
      color: "#fff8ee",
      intensity: 0.8,
      position: [
        (targetMm.x - 6000) / 1000,
        (targetMm.y + 8000) / 1000,
        (targetMm.z - 9000) / 1000,
      ],
      target: [targetMm.x / 1000, targetMm.y / 1000, targetMm.z / 1000],
      castShadow: false,
    });
  });

  it("resolves one immutable procedural environment only for Architecture Rise", () => {
    const architecture = resolveSceneWorldIllumination("architecture-rise");
    expect(architecture.environment).toEqual({
      id: "architecture-rise-procedural-daylight-environment",
      kind: "procedural-sky-ground",
      zenithColor: "#f2f2ee",
      skyHorizonColor: "#737d80",
      groundHorizonColor: "#686b65",
      nadirColor: "#3f4540",
      intensity: 0.95,
    });
    expect(Object.isFrozen(architecture)).toBe(true);
    expect(Object.isFrozen(architecture.sources)).toBe(true);
    expect(Object.isFrozen(architecture.environment)).toBe(true);

    expect(resolveSceneWorldIllumination("interior-corner").environment).toBeUndefined();
    expect(resolveSceneWorldIllumination("table-tilt").environment).toBeUndefined();
    expect(resolveSceneWorldIllumination("interior-corner").sources).toHaveLength(1);
    expect(resolveSceneWorldIllumination("table-tilt")).toBe(EMPTY_WORLD_ILLUMINATION);
  });

  it.each([
    "table-tilt",
    "macro-bellows-extension",
  ])("returns an immutable empty fallback for %s", (sceneId) => {
    expect(resolveSceneWorldIllumination(sceneId)).toBe(EMPTY_WORLD_ILLUMINATION);
  });

  it("freezes the resolved world source list", () => {
    const interior = resolveSceneWorldIllumination("interior-corner");
    const architecture = resolveSceneWorldIllumination("architecture-rise");
    expect(Object.isFrozen(interior)).toBe(true);
    expect(Object.isFrozen(interior.sources)).toBe(true);
    expect(Object.isFrozen(interior.sources[0])).toBe(true);
    expect(Object.isFrozen(interior.sources[0].positionMm)).toBe(true);
    expect(Object.isFrozen(architecture)).toBe(true);
    expect(Object.isFrozen(architecture.sources)).toBe(true);
    const [architectureSource] = architecture.sources;
    expect(Object.isFrozen(architectureSource)).toBe(true);
    expect(Object.isFrozen(architectureSource.positionMm)).toBe(true);
    if (architectureSource.kind !== "directional") {
      throw new Error("Expected the Architecture Rise directional source");
    }
    expect(Object.isFrozen(architectureSource.targetMm)).toBe(true);
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

  it("owns a synthetic natural directional and artificial point source in one rig", () => {
    const scene = new THREE.Scene();
    const resolved = {
      sources: [
        ...resolveSceneWorldIllumination("architecture-rise").sources,
        ...resolveSceneWorldIllumination("interior-corner").sources,
      ],
    } as const;
    const rig = createWorldIlluminationRig(scene, resolved);
    expect(rig.lights).toHaveLength(2);
    expect(rig.lights.map((light) => light.name)).toEqual([
      "architecture-rise-daylight",
      "interior-corner-local-light",
    ]);

    const directional = rig.lights.find(
      (light): light is THREE.DirectionalLight => light instanceof THREE.DirectionalLight,
    );
    const point = rig.lights.find(
      (light): light is THREE.PointLight => light instanceof THREE.PointLight,
    );
    const daylightSource = resolved.sources[0];
    const practicalSource = resolved.sources.find((source) => source.kind === "point");
    expect(directional).toBeInstanceOf(THREE.DirectionalLight);
    expect(point).toBeInstanceOf(THREE.PointLight);
    if (
      !directional ||
      !point ||
      !practicalSource ||
      daylightSource.kind !== "directional"
    ) {
      throw new Error("Expected one directional and one point light");
    }
    expect(directional.parent).toBe(scene);
    expect(directional.name).toBe("architecture-rise-daylight");
    expect(directional.position.toArray()).toEqual(
      worldIlluminationDirectionalToWorld(daylightSource).position,
    );
    expect(directional.castShadow).toBe(false);
    expect(rig.targets).toHaveLength(1);
    expect(directional.target).toBe(rig.targets[0]);
    expect(directional.target.parent).toBe(scene);
    expect(directional.target.name).toBe("architecture-rise-daylight-target");
    expect(directional.target.position.toArray()).toEqual(
      worldIlluminationDirectionalToWorld(daylightSource).target,
    );

    expect(point.parent).toBe(scene);
    expect(point.name).toBe("interior-corner-local-light");
    expect(point.position.toArray()).toEqual(
      worldIlluminationPointToWorld(practicalSource).position,
    );
    expect(point.distance).toBe(7.5);
    expect(point.decay).toBe(2);
    expect(point.castShadow).toBe(false);

    const lightDisposals = rig.lights.map((light) => vi.spyOn(light, "dispose"));
    const [target] = rig.targets;
    disposeWorldIlluminationRig(scene, rig);
    rig.lights.forEach((light, index) => {
      expect(light.parent).toBeNull();
      expect(lightDisposals[index]).toHaveBeenCalledTimes(1);
    });
    expect(target.parent).toBeNull();
    expect(scene.children).toHaveLength(0);
  });
});
