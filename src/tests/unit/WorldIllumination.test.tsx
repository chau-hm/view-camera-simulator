import React from "react";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  DirectionalWorldIllumination,
  WorldIllumination,
} from "../../render/WorldIllumination";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import {
  worldIlluminationDirectionalToWorld,
  type WorldProceduralSkyGroundEnvironment,
} from "../../render/worldIlluminationContract";
import { WorldEnvironment } from "../../render/WorldEnvironment";

describe("Observer world illumination component", () => {
  it("emits the resolved Interior Corner source as an R3F point light", () => {
    const tree = WorldIllumination({ sceneId: "interior-corner" });
    const children = React.Children.toArray(tree.props.children);
    expect(children).toHaveLength(1);
    const pointLight = children[0];
    if (!React.isValidElement(pointLight)) {
      throw new Error("Expected an R3F point light element");
    }

    expect(pointLight.type).toBe("pointLight");
    expect(pointLight.props).toMatchObject({
      name: "interior-corner-local-light",
      color: "#fff1d6",
      intensity: 5,
      distance: 7.5,
      decay: 2,
      castShadow: false,
      position: [
        0.42,
        (INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310) / 1000,
        8.3,
      ],
    });
  });

  it("emits the resolved Architecture Rise source as an R3F directional light", () => {
    const tree = WorldIllumination({ sceneId: "architecture-rise" });
    const children = React.Children.toArray(tree.props.children);
    expect(children).toHaveLength(2);
    const componentElement = children.find(
      (child) => React.isValidElement(child) && child.type === DirectionalWorldIllumination,
    );
    if (
      !React.isValidElement(componentElement) ||
      componentElement.type !== DirectionalWorldIllumination
    ) {
      throw new Error("Expected the dedicated directional-light component");
    }

    const [source] = resolveSceneWorldIllumination("architecture-rise").sources;
    if (source.kind !== "directional") {
      throw new Error("Expected the resolved Architecture Rise directional source");
    }
    const directionalComponent = new DirectionalWorldIllumination({ source });
    const directionalTree = directionalComponent.render();
    const directionalChildren = React.Children.toArray(directionalTree.props.children);
    expect(directionalChildren).toHaveLength(2);
    const targetElement = directionalChildren[0];
    const lightElement = directionalChildren[1];
    if (
      !React.isValidElement<{ object: THREE.Object3D; position: [number, number, number] }>(targetElement) ||
      !React.isValidElement(lightElement)
    ) {
      throw new Error("Expected an explicit target object and directional light");
    }

    const light = worldIlluminationDirectionalToWorld(source);
    const { building, facade } = ARCHITECTURE_RISE_PRESENTATION.geometry;
    const targetObject = targetElement.props.object;
    expect(targetElement.type).toBe("primitive");
    expect(targetObject).toBeInstanceOf(THREE.Object3D);
    expect(targetObject.name).toBe("architecture-rise-daylight-target");
    expect(targetElement.props.position).toEqual(light.target);
    expect(lightElement.type).toBe("directionalLight");
    expect(lightElement.props).toMatchObject({
      name: "architecture-rise-daylight",
      color: "#fff8ee",
      intensity: 0.8,
      castShadow: false,
      position: light.position,
      target: targetObject,
    });
    expect(light.target).toEqual([
      building.center.x / 1000,
      building.center.y / 1000,
      facade.frontFacadeZ / 1000,
    ]);

    const rerenderedTree = directionalComponent.render();
    const rerenderedTargetElement = React.Children.toArray(
      rerenderedTree.props.children,
    )[0];
    if (!React.isValidElement<{ object: THREE.Object3D }>(rerenderedTargetElement)) {
      throw new Error("Expected the stable directional target primitive");
    }
    expect(rerenderedTargetElement.props.object).toBe(targetObject);

    const environmentElement = children.find(
      (child) => React.isValidElement(child) && child.type === WorldEnvironment,
    );
    if (
      !React.isValidElement<{
        environment: WorldProceduralSkyGroundEnvironment;
      }>(environmentElement)
    ) {
      throw new Error("Expected the renderer-owned environment adapter");
    }
    expect(environmentElement.props.environment).toBe(
      resolveSceneWorldIllumination("architecture-rise").environment,
    );
  });

  it("emits no world light for a scene without world sources", () => {
    const tree = WorldIllumination({ sceneId: "table-tilt" });
    expect(React.Children.toArray(tree.props.children)).toHaveLength(0);
  });
});
