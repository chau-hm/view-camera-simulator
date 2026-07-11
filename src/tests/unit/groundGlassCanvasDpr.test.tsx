import React from "react";
import renderer from "react-test-renderer";
import { Canvas } from "@react-three/fiber";
import { GroundGlassRTT } from "../../render/GroundGlassRTT";
import { getRenderQualitySettings } from "../../render/renderQuality";

// Provide a minimal opticsState stub that satisfies DerivedOpticsState shape where required by the component
const minimalOpticsState: any = {
  filmPlaneCornersWorld: { topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 }, bottomLeft: { x: 0, y: 1 } },
  filmPlane: { point: { z: 1000 } },
  lensCenterWorld: { x: 0, y: 0, z: 0 },
  opticalAxis: { direction: { x: 0, y: 0, z: 1 } },
  focusTargets: [],
  offAxisProjectionMatrix: [],
  diagnostics: {},
};

describe("GroundGlassRTT Canvas DPR prop", () => {
  it("passes the profile DPR to Canvas for High/Standard/Low", () => {
    const qualities: Array<"low" | "standard" | "high"> = ["low", "standard", "high"];
    qualities.forEach((q) => {
      const tree = renderer.create(
        <GroundGlassRTT opticsState={minimalOpticsState} widthPx={500} heightPx={400} renderQuality={q} />
      ).root;
      // find Canvas node
      const canvasNode = tree.find((n) => n.type === Canvas);
      expect(canvasNode).toBeTruthy();
      const expectedDpr = getRenderQualitySettings(q).dpr;
      expect(canvasNode.props.dpr).toBe(expectedDpr);
    });
  });
});
