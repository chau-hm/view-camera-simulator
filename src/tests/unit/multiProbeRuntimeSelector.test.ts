import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { selectRuntimeProbeByPaneRay } from "../e2e/fixtures/multi-probe-runtime-selector";

describe("selectRuntimeProbeByPaneRay", () => {
  it("selects the valid candidate with the smallest pane-ray residual", () => {
    const selection = selectRuntimeProbeByPaneRay(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
      [
        { probeIndex: 0, q: new THREE.Vector3(0.2, 0, 4) },
        null,
        { probeIndex: 1, q: new THREE.Vector3(0.05, 0, 2) },
      ],
    );

    expect(selection).toEqual({ probeIndex: 1, residualM: 0.05 });
  });

  it("breaks equal-residual ties by lower Probe index regardless of input order", () => {
    const selection = selectRuntimeProbeByPaneRay(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
      [
        { probeIndex: 2, q: new THREE.Vector3(0.25, 0, 3) },
        { probeIndex: 0, q: new THREE.Vector3(-0.25, 0, 6) },
      ],
    );

    expect(selection?.probeIndex).toBe(0);
    expect(selection?.residualM).toBe(0.25);
  });

  it("returns no selection when every candidate is invalid", () => {
    expect(selectRuntimeProbeByPaneRay(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
      [null, null],
    )).toBeNull();
  });
});
