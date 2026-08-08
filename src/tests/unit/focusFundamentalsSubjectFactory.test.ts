import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createFocusFundamentalsGroup,
} from "../../render/FocusFundamentalsSubjectFactory";
import {
  focusFundamentalsFocusDetails,
  focusFundamentalsObjectCenterMm,
  focusFundamentalsObjectRotationYRad,
  getFocusFundamentalsDetailMarkerLocalPosition,
} from "../../scenes/focusFundamentalsTargets";
import { toWorld } from "../../render/rttUtils";

describe("Focus Fundamentals shared subject factory", () => {
  it("creates one canonical object with both focus details and a floor", () => {
    const group = createFocusFundamentalsGroup();
    const secondGroup = createFocusFundamentalsGroup();
    group.updateMatrixWorld(true);
    secondGroup.updateMatrixWorld(true);

    expect(group.name).toBe("focus-fundamentals-subject");
    expect(group.children).toHaveLength(2);
    expect(group.getObjectByName("focus-fundamentals-floor")).toBeInstanceOf(THREE.Mesh);

    const object = group.getObjectByName("focus-fundamentals-object");
    expect(object).toBeInstanceOf(THREE.Group);
    expect(object?.position.z).toBeCloseTo(toWorld(focusFundamentalsObjectCenterMm.z), 12);
    expect(object?.rotation.y).toBeCloseTo(focusFundamentalsObjectRotationYRad, 12);

    const body = group.getObjectByName("focus-fundamentals-object-body");
    expect(body).toBeInstanceOf(THREE.Group);
    expect(group.getObjectByName("focus-fundamentals-front-frame")).toBeInstanceOf(THREE.Group);
    expect(group.getObjectByName("focus-fundamentals-back-frame")).toBeInstanceOf(THREE.Group);
    expect(group.getObjectByName("focus-fundamentals-depth-connectors")).toBeInstanceOf(THREE.Group);
    expect(object?.children.filter((child) => child.name.endsWith("-marker"))).toHaveLength(2);

    const firstFrameBar = group.getObjectByName("focus-fundamentals-front-frame-left") as THREE.Mesh;
    const secondFrameBar = secondGroup.getObjectByName("focus-fundamentals-front-frame-left") as THREE.Mesh;
    const firstNearMarker = group.getObjectByName("focus-near-detail-marker") as THREE.Mesh;
    const secondNearMarker = secondGroup.getObjectByName("focus-near-detail-marker") as THREE.Mesh;
    expect(firstFrameBar.geometry).toBe(secondFrameBar.geometry);
    expect(firstFrameBar.material).toBe(secondFrameBar.material);
    expect(firstNearMarker.geometry).toBe(secondNearMarker.geometry);
    expect(firstNearMarker.material).toBe(secondNearMarker.material);

    for (const detail of focusFundamentalsFocusDetails) {
      const marker = group.getObjectByName(`${detail.id}-marker`);
      expect(marker).toBeInstanceOf(THREE.Mesh);
      expect(marker?.userData).toMatchObject({
        focusTargetId: detail.id,
        focusDetailWorldMm: detail.worldPositionMm,
        surface: detail.surface,
      });

      const local = getFocusFundamentalsDetailMarkerLocalPosition(detail);
      expect(marker?.position.x).toBeCloseTo(toWorld(local.x), 12);
      expect(marker?.position.y).toBeCloseTo(toWorld(local.y), 12);
      expect(marker?.position.z).toBeCloseTo(toWorld(local.z), 12);
    }
  });
});
