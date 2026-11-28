import * as THREE from "three";

// Encode one nonnegative linear component per pixel as a 24-bit fixed-point
// integer. This diagnostic RGBA8 target is an encoding transport, not the
// photographic scene target: it preserves values above 1 without tone mapping.
// Resolution: 1/4096, range: [0, 4095.9997]. Alpha zero means invalid.
export const HDR_PROBE_SCALE = 4096;
export const HDR_PROBE_MAX = 0xffffff / HDR_PROBE_SCALE;
export const HDR_PROBE_ABSOLUTE_TOLERANCE = 0.002;
export const HDR_PROBE_RELATIVE_TOLERANCE = 0.0015;

export function decodeHdrProbePixels(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16)
    throw new Error("HDR probe requires four RGBA8 encoded components");
  return Array.from({ length: 4 }, (_, channel) => {
    const index = channel * 4;
    if (bytes[index + 3] !== 255) throw new Error(`HDR probe component ${channel} invalid or out of range`);
    return (bytes[index] * 65536 + bytes[index + 1] * 256 + bytes[index + 2]) / HDR_PROBE_SCALE;
  });
}

/** Owns a temporary encoder target; all passed photographic targets are borrowed. */
export function createHdrReadback(renderer) {
  if (!renderer?.isWebGLRenderer) throw new Error("HDR probe requires a WebGL renderer");
  const context = renderer.getContext();
  const target = new THREE.WebGLRenderTarget(4, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { source: { value: null }, texel: { value: new THREE.Vector2() } },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `precision highp float;
      uniform sampler2D source;
      uniform vec2 texel;
      void main() {
        vec4 rgba = texture2D(source, texel);
        float v = gl_FragCoord.x < 1.0 ? rgba.r : gl_FragCoord.x < 2.0 ? rgba.g : gl_FragCoord.x < 3.0 ? rgba.b : rgba.a;
        if (!(v >= 0.0 && v <= 4095.9997)) { gl_FragColor = vec4(0.0); return; }
        float packed = floor(v * 4096.0 + 0.5);
        float hi = floor(packed / 65536.0);
        float mid = floor(mod(packed, 65536.0) / 256.0);
        float lo = mod(packed, 256.0);
        gl_FragColor = vec4(hi, mid, lo, 255.0) / 255.0;
      }`,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera();
  let disposed = false;
  return {
    read(input, x, y) {
      if (disposed) throw new Error("HDR probe has been disposed");
      if (!input?.isWebGLRenderTarget || input.texture.type !== THREE.HalfFloatType ||
          input.texture.format !== THREE.RGBAFormat || input.samples !== 0 ||
          ![THREE.NoColorSpace, THREE.LinearSRGBColorSpace].includes(input.texture.colorSpace))
        throw new Error("HDR probe requires an unsampled linear RGBA HalfFloat target");
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= input.width || y >= input.height)
        throw new Error("HDR probe texel is out of bounds");
      if (context.isContextLost()) throw new Error("HDR probe WebGL context is lost");
      const pending = context.getError();
      if (pending !== context.NO_ERROR) throw new Error(`HDR probe encountered pre-existing WebGL error 0x${pending.toString(16)}`);
      const previous = {
        target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), mip: renderer.getActiveMipmapLevel(),
        viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()),
        scissorTest: renderer.getScissorTest(), clearColor: renderer.getClearColor(new THREE.Color()),
        clearAlpha: renderer.getClearAlpha(), autoClear: renderer.autoClear, xr: renderer.xr.enabled,
      };
      try {
        material.uniforms.source.value = input.texture;
        material.uniforms.texel.value.set((x + 0.5) / input.width, (y + 0.5) / input.height);
        renderer.xr.enabled = false;
        renderer.autoClear = false;
        renderer.setRenderTarget(target);
        renderer.setViewport(0, 0, 4, 1);
        renderer.setScissorTest(false);
        const status = context.checkFramebufferStatus(context.FRAMEBUFFER);
        if (status !== context.FRAMEBUFFER_COMPLETE) throw new Error(`HDR probe encoder framebuffer incomplete: 0x${status.toString(16)}`);
        renderer.render(scene, camera);
        const bytes = new Uint8Array(16);
        renderer.readRenderTargetPixels(target, 0, 0, 4, 1, bytes);
        const error = context.getError();
        if (error !== context.NO_ERROR) throw new Error(`HDR probe readback WebGL error 0x${error.toString(16)}`);
        return decodeHdrProbePixels(bytes);
      } finally {
        material.uniforms.source.value = null;
        renderer.setRenderTarget(previous.target, previous.face, previous.mip);
        renderer.setViewport(previous.viewport);
        renderer.setScissor(previous.scissor);
        renderer.setScissorTest(previous.scissorTest);
        renderer.setClearColor(previous.clearColor, previous.clearAlpha);
        renderer.autoClear = previous.autoClear;
        renderer.xr.enabled = previous.xr;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
