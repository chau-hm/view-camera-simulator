import * as THREE from "three";
import { giMeshes } from "./vendor/src/core/gi.js";
import { computePhysicalBlurFootprint } from "../../src/core/optics/computePhysicalBlurFootprint.ts";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../src/render/groundGlassFilmPlaneProjection.ts";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttTextureUvToCanonicalFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../src/render/groundGlassRttOrientation.ts";

const MATRIX_EPSILON = 1e-5;
const PROJECTION_EPSILON = 2e-3;
const DEFAULT_SURFACE_TOLERANCE_MM = 2;
const INSPECTED_TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "displacementMap",
];

const asVec3 = (point, multiplier = 1) =>
  new THREE.Vector3(point.x * multiplier, point.y * multiplier, point.z * multiplier);
const vectorToObject = (vector) => ({ x: vector.x, y: vector.y, z: vector.z });
const isVisibleInHierarchy = (object, root) => {
  for (let node = object; node; node = node.parent) {
    if (!node.visible) return false;
    if (node === root) return true;
  }
  return false;
};

function deterministicObjectPath(object, root) {
  const parts = [];
  for (let node = object; node && node !== root; node = node.parent) {
    const siblings = node.parent?.children || [];
    const sameName = siblings.filter((sibling) => sibling.name === node.name && sibling.type === node.type);
    const occurrence = sameName.indexOf(node);
    parts.unshift(`${node.name || node.type}[${Math.max(0, occurrence)}]`);
  }
  return parts.join("/");
}

function isExpectedRoomTranslation(viewGroup, origin) {
  const expected = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
  return viewGroup.matrixWorld.elements.every(
    (value, index) => Math.abs(value - expected.elements[index]) <= MATRIX_EPSILON,
  );
}

function resolveCanonicalFilmUv(probe, previewMode) {
  if (probe.filmUv) {
    return { u: probe.filmUv.u, v: probe.filmUv.v, source: "canonical-film-uv" };
  }
  if (!probe.displayUv) return null;
  const displayTransform = resolveGroundGlassRttDisplayTransform(probe.previewMode || previewMode);
  const rttSourceUv = applyGroundGlassRttDisplayTransform(probe.displayUv, displayTransform);
  return {
    ...mapGroundGlassRttTextureUvToCanonicalFilmUv(rttSourceUv),
    source: "display-uv-through-rtt-orientation",
  };
}

function filmPointAtUv(corners, uv) {
  const { topLeft, topRight, bottomLeft, bottomRight } = corners;
  const point = (key) => asVec3(corners[key]);
  const tl = point("topLeft"), tr = point("topRight"), bl = point("bottomLeft"), br = point("bottomRight");
  return tl.multiplyScalar((1 - uv.u) * (1 - uv.v))
    .add(tr.multiplyScalar(uv.u * (1 - uv.v)))
    .add(bl.multiplyScalar((1 - uv.u) * uv.v))
    .add(br.multiplyScalar(uv.u * uv.v));
}

function textureDescription(texture) {
  if (!texture?.isTexture) return { present: false };
  const image = texture.image || texture.source?.data || null;
  const width = image?.naturalWidth || image?.videoWidth || image?.width || null;
  const height = image?.naturalHeight || image?.videoHeight || image?.height || null;
  return {
    present: true,
    width,
    height,
    colorSpace: texture.colorSpace || null,
    mapping: texture.mapping,
  };
}

function materialDescription(material, meshKey, materialSlot) {
  const textureMaps = Object.fromEntries(
    INSPECTED_TEXTURE_SLOTS.map((slot) => [slot, textureDescription(material[slot])]),
  );
  return {
    stableId: `${meshKey || "non-gi"}/material[${materialSlot}]:${material.name || material.type}`,
    name: material.name || null,
    type: material.type,
    supportedPbr: Boolean(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial),
    color: material.color?.getHexString?.() ?? null,
    roughness: Number.isFinite(material.roughness) ? material.roughness : null,
    metalness: Number.isFinite(material.metalness) ? material.metalness : null,
    ior: Number.isFinite(material.ior) ? material.ior : null,
    transmission: Number.isFinite(material.transmission) ? material.transmission : null,
    sheen: Number.isFinite(material.sheen) ? material.sheen : null,
    textures: textureMaps,
  };
}

function unsupportedMaterialReason(material) {
  if (material.isShaderMaterial || material.isRawShaderMaterial) return "custom shader material is unsupported for surface verification";
  if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) return "surface material is not a standard/physical PBR material";
  if (material.transparent || material.alphaTest > 0 || material.alphaToCoverage || material.alphaMap) {
    return "alpha-tested or transparent material cannot be visibility-verified by geometry raycast";
  }
  if (material.displacementMap) return "displacement-mapped surface does not match base-geometry raycast";
  return null;
}

function resolveMaterial(mesh, hit) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const slot = Number.isInteger(hit.face?.materialIndex) ? hit.face.materialIndex : 0;
  return { material: materials[slot] || null, slot };
}

function getFocusPlaneDistanceMm(pointMm, focusPlane) {
  if (!focusPlane?.point || !focusPlane?.normal) return null;
  return (pointMm.x - focusPlane.point.x) * focusPlane.normal.x +
    (pointMm.y - focusPlane.point.y) * focusPlane.normal.y +
    (pointMm.z - focusPlane.point.z) * focusPlane.normal.z;
}

function reject(probe, reason, extra = {}) {
  return { id: probe?.id || null, valid: false, rejection: reason, ...extra };
}

/**
 * Inspect real surfaces in a mounted Room-at-Dawn view without changing scene resources.
 * `filmUv` uses canonical physical film coordinates from the top-left corner. `displayUv`
 * uses top-origin Ground Glass canvas coordinates and is converted through the current
 * Raw/Upright transform before raycasting. Alternatively, `sourceM` names a known upstream
 * point that must lie on the visible surface within `surfaceToleranceMm`.
 *
 * The view group must have only the experiment's expected translation T(-preset.origin) in
 * metres. Canonical optics remain in millimetres. The caller supplies the completed frame
 * identity so measurements cannot be detached from the image used to select their probes.
 */
export function inspectRoomSurfaceProbes({
  viewGroup,
  optics,
  camera,
  preset,
  probes,
  frameIdentity = null,
  previewMode = "upright",
  raycastScene = null,
}) {
  if (!viewGroup?.isObject3D || !optics?.lensCenterWorld || !optics?.filmPlaneCornersWorld) {
    throw new TypeError("viewGroup and canonical optics with lens/film corners are required");
  }
  if (!Array.isArray(probes) || probes.length === 0) throw new TypeError("at least one room surface probe is required");
  if (!Array.isArray(preset?.origin) || preset.origin.length !== 3 || !preset.origin.every(Number.isFinite)) {
    throw new TypeError("preset.origin must be three finite upstream metre coordinates");
  }
  if (!["raw", "upright"].includes(previewMode)) throw new TypeError("previewMode must be raw or upright");

  viewGroup.updateWorldMatrix(true, true);
  const originM = new THREE.Vector3(...preset.origin);
  const translationValid = isExpectedRoomTranslation(viewGroup, originM);
  const giEntries = giMeshes(viewGroup);
  const giByMesh = new Map(giEntries.map((entry) => [entry.mesh, entry]));
  const roomObjects = new Set();
  viewGroup.traverse((object) => roomObjects.add(object));
  let sceneRoot = raycastScene || viewGroup;
  if (!raycastScene) {
    while (sceneRoot.parent && !sceneRoot.isScene) sceneRoot = sceneRoot.parent;
  }
  if (!sceneRoot.isObject3D || !sceneRoot.getObjectById(viewGroup.id)) {
    throw new TypeError("raycastScene must contain the mounted viewGroup");
  }
  sceneRoot.updateWorldMatrix(true, true);
  const lensRuntimeM = asVec3(optics.lensCenterWorld, 0.001);
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0;
  const viewTransform = viewGroup.matrixWorld.clone();

  return probes.map((probe) => {
    if (!probe || typeof probe.id !== "string" || !probe.id) return reject(probe, "probe id is required");
    if (!translationValid) return reject(probe, "unsupported view transform; expected only T(-preset.origin) metres");
    const hasKnownPoint = Array.isArray(probe.sourceM) && probe.sourceM.length === 3 && probe.sourceM.every(Number.isFinite);
    const canonicalUv = resolveCanonicalFilmUv(probe, previewMode);
    if (hasKnownPoint && canonicalUv) return reject(probe, "choose a known sourceM point or a film/display UV probe, not both");
    if (!hasKnownPoint && !canonicalUv) return reject(probe, "probe must provide sourceM, filmUv, or displayUv");
    if (canonicalUv && (!Number.isFinite(canonicalUv.u) || !Number.isFinite(canonicalUv.v) || canonicalUv.u < 0 || canonicalUv.u > 1 || canonicalUv.v < 0 || canonicalUv.v > 1)) {
      return reject(probe, "probe UV must be finite and within [0,1]");
    }

    let rayDirection;
    let requestedWorldMm = null;
    let filmUv = canonicalUv;
    if (hasKnownPoint) {
      requestedWorldMm = {
        x: (probe.sourceM[0] - preset.origin[0]) * 1000,
        y: (probe.sourceM[1] - preset.origin[1]) * 1000,
        z: (probe.sourceM[2] - preset.origin[2]) * 1000,
      };
      const projected = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: requestedWorldMm,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });
      filmUv = { u: projected.uRaw, v: projected.vRaw, source: "known-source-point" };
      if (!projected.visible) return reject(probe, "known source point projects outside the film", { sourceM: probe.sourceM, projection: projected });
      rayDirection = asVec3(requestedWorldMm, 0.001).sub(lensRuntimeM);
    } else {
      const filmPointMm = filmPointAtUv(optics.filmPlaneCornersWorld, filmUv);
      rayDirection = asVec3(optics.lensCenterWorld, 0.001).sub(filmPointMm.multiplyScalar(0.001));
    }
    if (!Number.isFinite(rayDirection.lengthSq()) || rayDirection.lengthSq() < 1e-12) {
      return reject(probe, "probe ray is degenerate");
    }
    raycaster.set(lensRuntimeM, rayDirection.normalize());
    const hits = raycaster.intersectObject(sceneRoot, true);
    const firstHit = hits.find((hit) => isVisibleInHierarchy(hit.object, sceneRoot));
    if (!firstHit || !firstHit.object?.isMesh) {
      return reject(probe, "no visible mesh intersects the canonical probe ray", {
        frameIdentity,
        canonicalFilmUv: filmUv ? { u: filmUv.u, v: filmUv.v } : null,
        raycastScope: sceneRoot.isScene ? "mounted-render-scene" : "mounted-room-view-only",
        viewTransform: viewTransform.toArray(),
      });
    }

    const mesh = firstHit.object;
    if (!roomObjects.has(mesh)) {
      return reject(probe, "probe ray is occluded by a visible mesh outside the mounted room group", {
        frameIdentity,
        raycastScope: sceneRoot.isScene ? "mounted-render-scene" : "mounted-render-root",
        externalOccluder: {
          name: mesh.name || null,
          type: mesh.type,
          path: deterministicObjectPath(mesh, sceneRoot),
        },
        canonicalFilmUv: filmUv ? { u: filmUv.u, v: filmUv.v } : null,
        viewTransform: viewTransform.toArray(),
      });
    }
    const giEntry = giByMesh.get(mesh) || null;
    const meshKey = giEntry?.key || null;
    const path = deterministicObjectPath(mesh, viewGroup);
    const { material, slot } = resolveMaterial(mesh, firstHit);
    if (!material) return reject(probe, "hit has no resolved material", { frameIdentity, meshPath: path, giMeshKey: meshKey });
    const materialInfo = materialDescription(material, meshKey || path, slot);
    const pointMm = {
      x: firstHit.point.x * 1000,
      y: firstHit.point.y * 1000,
      z: firstHit.point.z * 1000,
    };
    const sourcePointM = [
      firstHit.point.x + preset.origin[0],
      firstHit.point.y + preset.origin[1],
      firstHit.point.z + preset.origin[2],
    ];
    const projection = projectWorldPointToFilmPlaneGroundGlass({
      worldPoint: pointMm,
      lensCenterWorld: optics.lensCenterWorld,
      filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
    });
    const projectedUv = { u: projection.uRaw, v: projection.vRaw };
    const displayTransform = resolveGroundGlassRttDisplayTransform(probe.previewMode || previewMode);
    const displayedUv = applyGroundGlassRttDisplayTransform(projectedUv, displayTransform);
    const hitPointM = firstHit.point;
    const distanceFromLensMm = hitPointM.distanceTo(lensRuntimeM) * 1000;
    const lensNormal = optics.lensPlane?.normal;
    const rearFrame = optics.rearStandardFrame;
    const expectedFootprint = lensNormal && rearFrame && optics.filmPlane && camera?.focalLengthMm && camera?.aperture
      ? computePhysicalBlurFootprint({
          objectPoint: pointMm,
          lensCenter: optics.lensCenterWorld,
          lensPlaneNormal: lensNormal,
          lensPlaneBasisX: rearFrame.rightWorld,
          lensPlaneBasisY: rearFrame.upWorld,
          filmPlane: optics.filmPlane,
          filmPlaneBasisX: rearFrame.rightWorld,
          filmPlaneBasisY: rearFrame.upWorld,
          focalLengthMm: camera.focalLengthMm,
          apertureFNumber: camera.aperture,
        })
      : null;
    const objectDistanceAlongLensNormalMm = lensNormal
      ? (pointMm.x - optics.lensCenterWorld.x) * lensNormal.x +
        (pointMm.y - optics.lensCenterWorld.y) * lensNormal.y +
        (pointMm.z - optics.lensCenterWorld.z) * lensNormal.z
      : null;
    const surfaceToleranceMm = Number.isFinite(probe.surfaceToleranceMm)
      ? Math.max(0, probe.surfaceToleranceMm)
      : DEFAULT_SURFACE_TOLERANCE_MM;
    const knownPointErrorMm = requestedWorldMm
      ? asVec3(pointMm).distanceTo(asVec3(requestedWorldMm))
      : null;
    const surfaceNormal = firstHit.face?.normal?.clone();
    if (surfaceNormal) surfaceNormal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
    const giAttributes = Object.fromEntries(["gi", "gd", "giB"].map((name) => {
      const attribute = mesh.geometry?.getAttribute?.(name);
      return [name, attribute ? { count: attribute.count, itemSize: attribute.itemSize } : null];
    }));
    const expectedGiAttributeCount = giEntry?.count ?? null;
    const hasMatchedBake = Boolean(
      giEntry &&
      material.defines?.USE_GI !== undefined &&
      giAttributes.gi?.itemSize === 3 &&
      giAttributes.gd?.itemSize === 3 &&
      giAttributes.gi?.count === expectedGiAttributeCount &&
      giAttributes.gd?.count === expectedGiAttributeCount &&
      (!giEntry.back || (giAttributes.giB?.count === expectedGiAttributeCount && giAttributes.giB?.itemSize === 3)),
    );
    const unsupported = unsupportedMaterialReason(material);
    const projectedUvError = canonicalUv && projection.visible
      ? Math.hypot(projectedUv.u - canonicalUv.u, projectedUv.v - canonicalUv.v)
      : null;
    let rejection = null;
    if (!projection.visible) rejection = "ray hit does not project onto the physical film";
    else if (canonicalUv && projectedUvError > PROJECTION_EPSILON) rejection = "hit reprojection does not match requested film UV";
    else if (requestedWorldMm && knownPointErrorMm > surfaceToleranceMm) rejection = "known source point is occluded or is not on the hit surface";
    else if (!hasMatchedBake) rejection = "hit does not have a count-matched baked-GI mesh/material identity";
    else if (unsupported) rejection = unsupported;

    return {
      id: probe.id,
      valid: rejection === null,
      rejection,
      frameIdentity,
      previewMode: probe.previewMode || previewMode,
      probeCoordinateSource: filmUv?.source || "canonical-film-uv",
      requestedDisplayUv: probe.displayUv || null,
      canonicalFilmUv: filmUv ? { u: filmUv.u, v: filmUv.v } : null,
      projectedRawFilmUv: projectedUv,
      projectedDisplayUv: displayedUv,
      projectedUvError,
      sourceM: sourcePointM,
      runtimeWorldM: firstHit.point.toArray(),
      worldMm: pointMm,
      distanceFromLensMm,
      objectDistanceAlongLensNormalMm,
      expectedFootprint,
      signedFocusPlaneDistanceMm: getFocusPlaneDistanceMm(pointMm, optics.focusPlane),
      focusDistanceMm: Number.isFinite(camera?.focusDistanceMm) ? camera.focusDistanceMm : null,
      apertureFNumber: Number.isFinite(camera?.aperture) ? camera.aperture : null,
      surfaceNormalWorld: surfaceNormal?.toArray() || null,
      mesh: {
        name: mesh.name || null,
        type: mesh.type,
        path,
        giMeshKey: meshKey,
        giCount: giEntry?.count ?? null,
        giInstanced: giEntry?.inst ?? false,
        instanceId: Number.isInteger(firstHit.instanceId) ? firstHit.instanceId : null,
        geometryVertexCount: mesh.geometry?.attributes?.position?.count ?? null,
        giAttributes,
        hasMatchedBake,
      },
      material: materialInfo,
      knownSourcePoint: requestedWorldMm ? {
        worldMm: requestedWorldMm,
        surfaceErrorMm: knownPointErrorMm,
        allowedSurfaceErrorMm: surfaceToleranceMm,
      } : null,
      rayDistanceM: firstHit.distance,
      nearestHit: true,
      raycastScope: sceneRoot.isScene ? "mounted-render-scene" : "mounted-room-view-only",
      viewTransform: viewTransform.toArray(),
    };
  });
}


/**
 * Measure a small patch in an already captured Ground Glass canvas. This is
 * display-referred RGB8 evidence only; it does not estimate linear radiance or
 * prove that every pixel in the fixed patch belongs to the raycast surface.
 */
export function measureRoomSurfacePatchRgba(data, width, height, displayUv, {
  radiusPx = 6,
  frameIdentity = null,
} = {}) {
  const fail = (reason) => ({ valid: false, rejection: reason, frameIdentity });
  if (!data || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) {
    return fail("RGBA buffer dimensions do not match");
  }
  if (!displayUv || !Number.isFinite(displayUv.u) || !Number.isFinite(displayUv.v) || displayUv.u < 0 || displayUv.u > 1 || displayUv.v < 0 || displayUv.v > 1) {
    return fail("displayUv must be finite and within [0,1]");
  }
  if (!Number.isInteger(radiusPx) || radiusPx < 1) return fail("radiusPx must be a positive integer");
  const centerX = Math.round(displayUv.u * (width - 1));
  const centerY = Math.round(displayUv.v * (height - 1));
  const x = centerX - radiusPx;
  const y = centerY - radiusPx;
  const patchWidth = radiusPx * 2 + 1;
  const patchHeight = patchWidth;
  if (x < 0 || y < 0 || x + patchWidth > width || y + patchHeight > height) return fail("surface patch crosses the captured canvas edge");

  const count = patchWidth * patchHeight;
  const profile = new Float64Array(count);
  const rgb = [0, 0, 0];
  let darkPixels = 0;
  let highlightPixels = 0;
  let nonOpaquePixels = 0;
  for (let py = 0; py < patchHeight; py++) {
    for (let px = 0; px < patchWidth; px++) {
      const index = ((y + py) * width + x + px) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const sample = py * patchWidth + px;
      profile[sample] = luma;
      rgb[0] += red / count;
      rgb[1] += green / count;
      rgb[2] += blue / count;
      if (luma <= 5) darkPixels++;
      if (luma >= 250) highlightPixels++;
      if (data[index + 3] < 250) nonOpaquePixels++;
    }
  }
  const meanLuma8 = profile.reduce((sum, value) => sum + value, 0) / count;
  const variance = profile.reduce((sum, value) => sum + (value - meanLuma8) ** 2, 0) / count;
  let gradientSum = 0;
  let gradientPairs = 0;
  for (let py = 0; py < patchHeight; py++) {
    for (let px = 0; px < patchWidth; px++) {
      const index = py * patchWidth + px;
      if (px + 1 < patchWidth) {
        gradientSum += Math.abs(profile[index] - profile[index + 1]);
        gradientPairs++;
      }
      if (py + 1 < patchHeight) {
        gradientSum += Math.abs(profile[index] - profile[index + patchWidth]);
        gradientPairs++;
      }
    }
  }
  return {
    valid: true,
    frameIdentity,
    space: "display-referred RGB8",
    displayUv,
    roi: { x, y, width: patchWidth, height: patchHeight },
    meanRgb8: rgb.map((value) => Number(value.toFixed(3))),
    meanLuma8: Number(meanLuma8.toFixed(3)),
    lumaStdDev8: Number(Math.sqrt(variance).toFixed(3)),
    meanAbsoluteNeighborGradient8: Number((gradientSum / Math.max(1, gradientPairs)).toFixed(3)),
    darkPixelFraction: darkPixels / count,
    highlightPixelFraction: highlightPixels / count,
    nonOpaquePixelFraction: nonOpaquePixels / count,
    caveats: [
      "display-referred RGB8 values are not linear scene radiance",
      "fixed patch may include adjacent surfaces, blur, glare, or occlusion",
      "gradient statistic describes local texture/edge energy, not sharpness by itself",
    ],
  };
}
