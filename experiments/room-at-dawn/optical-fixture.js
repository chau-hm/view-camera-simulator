import * as THREE from "three";

// Separate optical diagnostic, in runtime-world metres (+Z toward the subject).
// Targets are deliberately isolated in image space; these are not room meshes.
export const OPTICAL_FIXTURE_TARGETS = Object.freeze([
  Object.freeze({ id: "near-edge", centerM: [-0.35, 0.20, 1.10], sizeM: [0.24, 0.24] }),
  Object.freeze({ id: "middle-edge", centerM: [0, -0.32, 2.0], sizeM: [0.44, 0.44] }),
  Object.freeze({ id: "far-edge", centerM: [1.10, 0.72, 4.0], sizeM: [0.88, 0.88] }),
]);

// Linear values chosen away from black/white clipping; the vertical edge
// provides a known feature without adding anything to the room or GI bake.
function createEdgeTexture() {
  const width = 128;
  const data = new Uint8Array(width * 4);
  for (let x = 0; x < width; x++) {
    const value = x < width / 2 ? 51 : 204;
    data.set([value, value, value, 255], x * 4);
  }
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Each mount owns its own geometry, material and texture. */
export function createOpticalFixtureProfile({ onMount, onDispose } = {}) {
  return {
    renderSanityIdentity: "room-optical-fixture",
    configureRttShadowParticipation: () => {},
    resolveRenderBounds: () => ({ min: { x: -600, y: -600, z: 900 }, max: { x: 1600, y: 1200, z: 4500 } }),
    mountSubject(scene) {
      const group = new THREE.Group();
      group.name = "room-optical-fixture";
      const texture = createEdgeTexture();
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
      const meshes = [];
      try {
        for (const target of OPTICAL_FIXTURE_TARGETS) {
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...target.sizeM), material);
          mesh.name = target.id;
          mesh.position.set(...target.centerM);
          mesh.userData.opticalFixtureTargetId = target.id;
          group.add(mesh);
          meshes.push(mesh);
        }
        scene.add(group);
        onMount?.(group);
      } catch (error) {
        scene.remove(group);
        for (const mesh of meshes) mesh.geometry.dispose();
        material.dispose();
        texture.dispose();
        throw error;
      }
      let disposed = false;
      return {
        group,
        dispose() {
          if (disposed) return;
          disposed = true;
          scene.remove(group);
          for (const mesh of meshes) mesh.geometry.dispose();
          material.dispose();
          texture.dispose();
          onDispose?.(group);
        },
      };
    },
  };
}
