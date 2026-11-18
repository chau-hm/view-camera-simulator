import * as THREE from "three";

export const ARCHITECTURE_RISE_TEST_REFLECTION_TARGET_NAME =
  "architecture-rise-test-reflection-target";

const TARGET_PLANE_Z = 6;
const TARGET_WIDTH = 1.2;
const TARGET_HEIGHT = 1.2;

const createTargetPattern = (): THREE.DataTexture => {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const grid = x % 16 < 2 || y % 16 < 2;
      const value = grid ? 22 : checker ? 238 : 34;
      const offset = (y * size + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Adds a fixture-owned, deterministic surface for the reflected-world focus
 * harnesses. The pane hit and reflection direction come from mounted scene
 * geometry; this target replaces an incidental dependency on one particular
 * production street prop.
 */
export const addArchitectureRiseTestReflectionTarget = (
  root: THREE.Group,
  pane: THREE.Mesh,
  lensOrigin: THREE.Vector3,
): THREE.Mesh => {
  root.updateMatrixWorld(true);
  pane.updateWorldMatrix(true, false);

  const bounds = new THREE.Box3().setFromObject(pane);
  const samplePoint = new THREE.Vector3(
    bounds.min.x + 0.3 * (bounds.max.x - bounds.min.x),
    bounds.min.y + 0.3 * (bounds.max.y - bounds.min.y),
    bounds.min.z,
  );
  const paneRay = new THREE.Raycaster(
    lensOrigin,
    samplePoint.clone().sub(lensOrigin).normalize(),
  );
  const paneHit = paneRay.intersectObject(pane, false)[0];
  if (!paneHit?.face) throw new Error("Test reflection target requires a real mounted glazing hit");

  const normal = paneHit.face.normal.clone().applyMatrix3(
    new THREE.Matrix3().getNormalMatrix(pane.matrixWorld),
  ).normalize();
  const reflected = paneHit.point.clone().sub(lensOrigin).normalize().reflect(normal).normalize();
  if (reflected.z >= -1e-6 || TARGET_PLANE_Z >= paneHit.point.z) {
    throw new Error("Test reflection target requires a front-facing pane reflection toward decreasing Z");
  }

  const distance = (TARGET_PLANE_Z - paneHit.point.z) / reflected.z;
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new Error("Test reflection target is not in front of the reflected pane ray");
  }

  const target = new THREE.Mesh(
    new THREE.BoxGeometry(TARGET_WIDTH, TARGET_HEIGHT, 0.02),
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      map: createTargetPattern(),
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  target.name = ARCHITECTURE_RISE_TEST_REFLECTION_TARGET_NAME;
  target.userData.testFixtureOnly = true;
  target.position.copy(paneHit.point).addScaledVector(reflected, distance);
  root.add(target);
  root.updateMatrixWorld(true);
  return target;
};
