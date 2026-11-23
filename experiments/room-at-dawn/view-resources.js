import * as THREE from "three";

/** A view owns its material variants and GI uniform wrappers. Geometry and texture
 * objects remain borrowed from the source owner; callers must remove the graph
 * before disposing the variants. */
export function createRoomView(source, origin, sourceGiUniforms, { bytePreExposure = null } = {}) {
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
    group.position.set(...origin.map((value) => -value));
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
          `${material.customProgramCacheKey()}|room-view|${bytePreExposure === null ? "linear" : `byte-${bytePreExposure}`}`;
        return variant;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(adapt)
        : adapt(object.material);
    });
    return { group, uniforms, materialCount: variants.size, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
