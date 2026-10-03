import React from "react";
import { describe, expect, it } from "vitest";
import { WorldIllumination } from "../../render/WorldIllumination";
import { INTERIOR_CORNER_PRESENTATION } from "../../scenes/presentation/interiorCorner";

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

  it("emits no point light for a scene without world sources", () => {
    const tree = WorldIllumination({ sceneId: "architecture-rise" });
    expect(React.Children.toArray(tree.props.children)).toHaveLength(0);
  });
});
