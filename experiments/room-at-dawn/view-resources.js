import * as THREE from "three";

/** A view owns its material variants and GI uniform wrappers. Geometry and texture
 * objects remain borrowed from the source owner; callers must remove the graph
 * before disposing the variants. */
export function createRoomView(source, origin, sourceGiUniforms, { bytePreExposure = null } = {}) {
  // One owned value drives both this view's scene translation and its GI
  // source-space reconstruction. Never borrow the preset's mutable array.
  const roomOrigin = new THREE.Vector3(...origin);
  const roomOriginUniform = { value: roomOrigin };
  const uniforms = Object.fromEntries(
    Object.entries(sourceGiUniforms).map(([name, uniform]) => [
      name,
      {
        value:
          uniform.value && typeof uniform.value.clone === "function"
            ? uniform.value.clone()
            : uniform.value,
      },
    ]),
  );
  const uniformMap = new Map(
    Object.entries(sourceGiUniforms).map(([name, uniform]) => [uniform, uniforms[name]]),
  );
  const variants = new Map();
  const group = new THREE.Group();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const material of variants.values()) material.dispose();
  };
  try {
    for (const child of source.children) group.add(child.clone(true));
    group.position.copy(roomOrigin).negate();
    group.traverse((object) => {
      if (!object.material) return;
      const adapt = (material) => {
        if (variants.has(material)) return variants.get(material);
        const variant = material.clone();
        // MeshStandardMaterial.copy resets custom defines in Three r187.
        if (material.defines) variant.defines = { ...material.defines };
        variants.set(material, variant);
        // ShaderMaterial.clone() clones its uniforms; restore borrowed textures and
        // map upstream GI uniform identities to view-local wrappers instead.
        if (material.uniforms) {
          variant.uniforms = Object.fromEntries(
            Object.entries(material.uniforms).map(([key, uniform]) => [
              key,
              uniformMap.get(uniform) || { ...uniform, value: uniform.value },
            ]),
          );
        }
        const compile = material.onBeforeCompile;
        variant.onBeforeCompile = function (shader, renderer) {
          compile.call(material, shader, renderer);
          if (material.defines?.USE_GI !== undefined) {
            Object.assign(shader.uniforms, uniforms);
            const worldPosition = "vGiW = gw.xyz;";
            if (!shader.vertexShader.includes(worldPosition))
              throw new Error("Upstream GI shader world-position hook missing");
            shader.uniforms.roomOrigin = roomOriginUniform;
            shader.vertexShader =
              "uniform vec3 roomOrigin;\n" +
              shader.vertexShader.replace(worldPosition, "vGiW = gw.xyz + roomOrigin;");
            if (bytePreExposure !== null) {
              const token = "#include <opaque_fragment>";
              if (!shader.fragmentShader.includes(token))
                throw new Error("Upstream PBR output hook missing");
              shader.fragmentShader = shader.fragmentShader.replace(
                token,
                `outgoingLight *= ${Number(bytePreExposure).toFixed(1)};\n${token}`,
              );
            }
          }
        };
        variant.customProgramCacheKey = () =>
          `${material.customProgramCacheKey()}|room-translation|room-view|${bytePreExposure === null ? "linear" : `byte-${bytePreExposure}`}`;
        return variant;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(adapt)
        : adapt(object.material);
    });
    return { group, uniforms, roomOrigin, roomOriginUniform, materialCount: variants.size, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
