import * as THREE from "three";

/** Separate constant-linear-radiance RTT subject. Metres, +Z forward. The huge
 * matte plane fills the camera's field without touching GI-matched room meshes.
 * Every mount owns its own geometry/material and must be disposed. */
export function createHdrConstantFieldProfile({ rgb = [0.1, 2, 8], depthMetres = 2, extentMetres = 100 } = {}) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 4095) ||
      !Number.isFinite(depthMetres) || depthMetres <= 0 || !Number.isFinite(extentMetres) || extentMetres <= 0)
    throw new Error("HDR constant field requires finite nonnegative RGB and positive metre dimensions");
  const color = [...rgb];
  return {
    renderSanityIdentity: `hdr-constant:${color.join(",")}:${depthMetres}`,
    configureRttShadowParticipation() {},
    resolveRenderBounds() {
      const half = extentMetres * 500;
      const z = depthMetres * 1000;
      return { min: { x: -half, y: -half, z: z - 1 }, max: { x: half, y: half, z: z + 1 } };
    },
    mountSubject(scene) {
      const geometry = new THREE.PlaneGeometry(extentMetres, extentMetres);
      const material = new THREE.ShaderMaterial({
        uniforms: { radiance: { value: new THREE.Vector3(...color) } },
        vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 radiance; void main() { gl_FragColor = vec4(radiance, 1.0); }",
        side: THREE.DoubleSide,
        toneMapped: false,
        blending: THREE.NoBlending,
      });
      const group = new THREE.Group();
      const plane = new THREE.Mesh(geometry, material);
      plane.position.z = depthMetres;
      group.add(plane);
      scene.add(group);
      let disposed = false;
      return { group, dispose() {
        if (disposed) return;
        disposed = true;
        scene.remove(group);
        geometry.dispose();
        material.dispose();
      } };
    },
  };
}
