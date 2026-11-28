import * as THREE from "three";
import { computePhysicalBlurFootprint } from "../../src/core/optics/computePhysicalBlurFootprint.ts";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../src/render/groundGlassFilmPlaneProjection.ts";
import { OPTICAL_FIXTURE_TARGETS } from "./optical-fixture.js";

/** Canonical prediction and geometric visibility, not an assertion of image sharpness. */
export function inspectOpticalFixture(group, optics, camera, dimensions) {
  const root = group.parent || group;
  root.updateWorldMatrix(true, true);
  const raycaster = new THREE.Raycaster();
  const lens = optics.lensCenterWorld;
  const start = new THREE.Vector3(lens.x, lens.y, lens.z).multiplyScalar(0.001);
  return OPTICAL_FIXTURE_TARGETS.map((target) => {
    const mesh = group.getObjectByName(target.id);
    if (!mesh) return { id: target.id, valid: false, rejection: "target missing" };
    const pointM = mesh.getWorldPosition(new THREE.Vector3());
    const point = { x: pointM.x * 1000, y: pointM.y * 1000, z: pointM.z * 1000 };
    const projection = projectWorldPointToFilmPlaneGroundGlass({ worldPoint: point, lensCenterWorld: lens, filmPlaneCornersWorld: optics.filmPlaneCornersWorld });
    const delta = pointM.clone().sub(start);
    raycaster.set(start, delta.clone().normalize());
    raycaster.near = 0;
    raycaster.far = delta.length() + 0.001;
    const hits = raycaster.intersectObjects(root.children, true).filter(({ object }) => {
      for (let current = object; current; current = current.parent) if (!current.visible) return false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      return materials.some((material) => material && material.visible !== false);
    });
    const first = hits[0];
    const unoccluded = Boolean(first && first.object === mesh && Math.abs(first.distance - delta.length()) < 0.001);
    const footprint = computePhysicalBlurFootprint({
      objectPoint: point,
      lensCenter: lens,
      lensPlaneNormal: optics.lensPlane.normal,
      lensPlaneBasisX: optics.rearStandardFrame.rightWorld,
      lensPlaneBasisY: optics.rearStandardFrame.upWorld,
      filmPlane: optics.filmPlane,
      filmPlaneBasisX: optics.rearStandardFrame.rightWorld,
      filmPlaneBasisY: optics.rearStandardFrame.upWorld,
      focalLengthMm: camera.focalLengthMm,
      apertureFNumber: camera.aperture,
    });
    const focus = optics.focusPlane;
    const signedFocusDistanceMm = focus
      ? (point.x - focus.point.x) * focus.normal.x + (point.y - focus.point.y) * focus.normal.y + (point.z - focus.point.z) * focus.normal.z
      : null;
    const rejection = !projection.visible ? "outside film" : !unoccluded ? "occluded or raycast missed target" : !footprint.valid ? "unresolved footprint" : null;
    const sampledWidthMm = dimensions?.sampledFilmWidthMm;
    const internalPixelsPerMm = sampledWidthMm > 0 && dimensions?.internalWidthPx > 0 ? dimensions.internalWidthPx / sampledWidthMm : null;
    const displayPixelsPerMm = sampledWidthMm > 0 && dimensions?.displayWidthPx > 0 ? dimensions.displayWidthPx / sampledWidthMm : null;
    return {
      id: target.id,
      diagnosticOnly: true,
      worldM: pointM.toArray(),
      worldMm: point,
      surfaceNormalWorld: new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld).toArray(),
      distanceFromLensMm: delta.length() * 1000,
      projected: projection,
      unoccluded,
      firstHit: first?.object?.name ?? null,
      occlusionScope: group.parent ? "mounted scene" : "fixture group only",
      signedFocusDistanceMm,
      footprint,
      majorRadiusInternalPx: internalPixelsPerMm === null ? null : footprint.majorRadiusMm * internalPixelsPerMm,
      majorRadiusDisplayPx: displayPixelsPerMm === null ? null : footprint.majorRadiusMm * displayPixelsPerMm,
      valid: rejection === null,
      rejection,
      imageMeasurement: "not measured; reject ROI unless contrast, clipping and bounds checks pass",
    };
  });
}

/** Display-referred RGB8 edge spread. Returns no measurement for unsuitable regions.
 * The supplied crop must contain one approximately vertical edge, with flat
 * plateaus on both sides. Reproject and register each crop for each state. */
export function measureVerticalEdgeRgba(data, width, height, roi) {
  const { x, y, width: w, height: h } = roi;
  const reject = (reason) => ({ valid: false, rejection: reason });
  if (![width, height, x, y, w, h].every(Number.isInteger) || w < 8 || h < 3 || x < 0 || y < 0 || x + w > width || y + h > height || data.length !== width * height * 4) return reject("invalid or out-of-frame ROI");
  const profile = new Float64Array(w);
  let clipped = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = (yy * width + x + xx) * 4;
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    profile[xx] += lum / h;
    if (lum <= 5 || lum >= 250) clipped++;
  }
  const clippedFraction = clipped / (w * h);
  if (clippedFraction > 0.1) return reject("dark or saturated ROI");
  const n = Math.max(2, Math.floor(w / 5));
  const average = (start, end) => Array.from(profile.slice(start, end)).reduce((a, b) => a + b, 0) / (end - start);
  const left = average(0, n), right = average(w - n, w);
  const contrast = Math.abs(right - left);
  if (Math.min(left, right) <= 5 || Math.max(left, right) >= 250 || contrast < 12) return reject("weak or clipped edge contrast");
  const direction = Math.sign(right - left);
  const normalized = Array.from(profile, (v) => (v - left) * direction / contrast);
  const crossing = (threshold) => {
    for (let i = 1; i < w; i++) {
      if (normalized[i - 1] <= threshold && normalized[i] >= threshold && normalized[i] > normalized[i - 1]) {
        return i - 1 + (threshold - normalized[i - 1]) / (normalized[i] - normalized[i - 1]);
      }
    }
    return null;
  };
  const p10 = crossing(0.1), p50 = crossing(0.5), p90 = crossing(0.9);
  if (p10 === null || p50 === null || p90 === null || p10 >= p50 || p50 >= p90 || p10 < n - 1 || p90 > w - n) return reject("edge spread unresolved or lacks flat margins");
  return { valid: true, edgeX: x + p50, width10to90Px: p90 - p10, contrastLuma8: contrast, clippedFraction, leftLuma8: left, rightLuma8: right, space: "display-referred RGB8; normalize display exposure separately" };
}
