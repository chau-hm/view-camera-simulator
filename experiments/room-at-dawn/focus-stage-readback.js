import * as THREE from "three";

// Development-only numerical transport. Each source component is encoded as
// three bytes in an owned RGBA8 target; PNG/screenshots are never used as
// radiance samples. Signed values use a 24-bit biased fixed-point code.
export const FOCUS_STAGE_SIGNED_SCALE = 4096;
export const FOCUS_STAGE_SIGNED_BIAS = 2048;
export const FOCUS_STAGE_SIGNED_MIN = -FOCUS_STAGE_SIGNED_BIAS;
export const FOCUS_STAGE_SIGNED_MAX_EXCLUSIVE = FOCUS_STAGE_SIGNED_BIAS;
export const FOCUS_STAGE_SIGNED_PRECISION = 1 / FOCUS_STAGE_SIGNED_SCALE;
export const FOCUS_STAGE_NORMALIZED_MAX_CODE = 0xffffff;
export const FOCUS_STAGE_NORMALIZED_PRECISION = 1 / FOCUS_STAGE_NORMALIZED_MAX_CODE;

// Keep the endpoint handling explicit: float32 cannot represent 2^24 - 0.5,
// so adding 0.5 to the largest depth code would round to 2^24 before floor.
export const FOCUS_STAGE_READBACK_FRAGMENT_SHADER = `precision highp float;
  uniform sampler2D source;
  uniform vec2 texel;
  uniform float depthSource;
  void main() {
    vec4 sampleValue = texture2D(source, texel);
    if (depthSource > 0.5) sampleValue = vec4(sampleValue.r, 0.0, 0.0, 1.0);
    float channel = gl_FragCoord.x < 1.0 ? sampleValue.r :
      gl_FragCoord.x < 2.0 ? sampleValue.g :
      gl_FragCoord.x < 3.0 ? sampleValue.b : sampleValue.a;
    float code;
    if (depthSource > 0.5) {
      if (!(channel >= 0.0 && channel <= 1.0)) { gl_FragColor = vec4(0.0); return; }
      code = channel == 1.0 ? 16777215.0 : floor(channel * 16777215.0 + 0.5);
    } else {
      if (!(channel >= -2048.0 && channel < 2048.0)) { gl_FragColor = vec4(0.0); return; }
      float scaled = (channel + 2048.0) * 4096.0;
      code = scaled >= 16777215.0 ? 16777215.0 : floor(scaled + 0.5);
    }
    if (!(code >= 0.0 && code <= 16777215.0)) { gl_FragColor = vec4(0.0); return; }
    float hi = floor(code / 65536.0);
    float mid = floor(mod(code, 65536.0) / 256.0);
    float lo = mod(code, 256.0);
    gl_FragColor = vec4(hi, mid, lo, 255.0) / 255.0;
  }`;

function validateEncodedBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
    throw new Error("Focus stage probe requires four RGBA8 encoded components");
  }
  for (let component = 0; component < 4; component += 1) {
    if (bytes[component * 4 + 3] !== 255) {
      throw new Error(`Focus stage probe component ${component} is invalid or out of range`);
    }
  }
}

export function decodeFocusStageSignedPixels(bytes) {
  validateEncodedBytes(bytes);
  return Array.from({ length: 4 }, (_, component) => {
    const offset = component * 4;
    const code = bytes[offset] * 65536 + bytes[offset + 1] * 256 + bytes[offset + 2];
    const value = code / FOCUS_STAGE_SIGNED_SCALE - FOCUS_STAGE_SIGNED_BIAS;
    if (!Number.isFinite(value) || value < FOCUS_STAGE_SIGNED_MIN || value >= FOCUS_STAGE_SIGNED_MAX_EXCLUSIVE) {
      throw new Error(`Focus stage probe component ${component} decoded outside its signed range`);
    }
    return value;
  });
}

export function decodeFocusStageNormalizedPixels(bytes) {
  validateEncodedBytes(bytes);
  const code = bytes[0] * 65536 + bytes[1] * 256 + bytes[2];
  const value = code / FOCUS_STAGE_NORMALIZED_MAX_CODE;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Focus stage probe normalized value is outside [0, 1]");
  }
  return value;
}

const signedEncoding = Object.freeze({
  name: "biased-fixed-point-24",
  min: FOCUS_STAGE_SIGNED_MIN,
  maxExclusive: FOCUS_STAGE_SIGNED_MAX_EXCLUSIVE,
  precision: FOCUS_STAGE_SIGNED_PRECISION,
  unit: "source-value",
});
const normalizedEncoding = Object.freeze({
  name: "normalized-fixed-point-24",
  min: 0,
  max: 1,
  precision: FOCUS_STAGE_NORMALIZED_PRECISION,
  unit: "normalized-depth",
});

function targetDimensions(target) {
  const width = Number(target?.width);
  const height = Number(target?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Focus stage probe requires positive integer source dimensions");
  }
  return { width, height };
}

function validateCoordinate(x, y, width, height) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
    throw new Error("Focus stage probe texel is out of bounds");
  }
}

/** Owns only its encoder target/material/geometry. Source targets are borrowed. */
export function createFocusStageReadback(renderer) {
  if (!renderer?.isWebGLRenderer) throw new Error("Focus stage probe requires a WebGL renderer");
  const context = renderer.getContext();
  if (!context || typeof context.isContextLost !== "function") {
    throw new Error("Focus stage probe requires a readable WebGL context");
  }

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
    uniforms: {
      source: { value: null },
      texel: { value: new THREE.Vector2() },
      depthSource: { value: 0 },
    },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: FOCUS_STAGE_READBACK_FRAGMENT_SHADER,
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

  const readBytes = (texture, width, height, x, y, depthSource) => {
    if (disposed) throw new Error("Focus stage probe has been disposed");
    validateCoordinate(x, y, width, height);
    if (context.isContextLost()) throw new Error("Focus stage probe WebGL context is lost");
    const pending = context.getError();
    if (pending !== context.NO_ERROR) {
      throw new Error(`Focus stage probe encountered pre-existing WebGL error 0x${pending.toString(16)}`);
    }

    const previous = {
      target: renderer.getRenderTarget(),
      face: renderer.getActiveCubeFace(),
      mip: renderer.getActiveMipmapLevel(),
      viewport: renderer.getViewport(new THREE.Vector4()),
      scissor: renderer.getScissor(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest(),
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear,
      xr: renderer.xr.enabled,
    };

    try {
      material.uniforms.source.value = texture;
      material.uniforms.texel.value.set((x + 0.5) / width, (y + 0.5) / height);
      material.uniforms.depthSource.value = depthSource ? 1 : 0;
      renderer.xr.enabled = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, 4, 1);
      renderer.setScissorTest(false);
      const status = context.checkFramebufferStatus(context.FRAMEBUFFER);
      if (status !== context.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Focus stage encoder framebuffer incomplete: 0x${status.toString(16)}`);
      }
      renderer.render(scene, camera);
      const bytes = new Uint8Array(16);
      renderer.readRenderTargetPixels(target, 0, 0, 4, 1, bytes);
      const error = context.getError();
      if (error !== context.NO_ERROR) throw new Error(`Focus stage readback WebGL error 0x${error.toString(16)}`);
      return bytes;
    } finally {
      material.uniforms.source.value = null;
      material.uniforms.depthSource.value = 0;
      renderer.setRenderTarget(previous.target, previous.face, previous.mip);
      renderer.setViewport(previous.viewport);
      renderer.setScissor(previous.scissor);
      renderer.setScissorTest(previous.scissorTest);
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.autoClear = previous.autoClear;
      renderer.xr.enabled = previous.xr;
    }
  };

  return Object.freeze({
    readColor(sourceTarget, x, y) {
      if (!sourceTarget?.isWebGLRenderTarget || sourceTarget.samples !== 0) {
        throw new Error("Focus stage color probe requires an unsampled WebGL render target");
      }
      const { width, height } = targetDimensions(sourceTarget);
      const texture = sourceTarget.texture;
      if (texture.format !== THREE.RGBAFormat ||
          ![THREE.HalfFloatType, THREE.UnsignedByteType].includes(texture.type) ||
          ![THREE.NoColorSpace, THREE.LinearSRGBColorSpace].includes(texture.colorSpace)) {
        throw new Error("Focus stage color probe requires linear RGBA HalfFloat or UnsignedByte storage");
      }
      const rgba = decodeFocusStageSignedPixels(readBytes(texture, width, height, x, y, false));
      return Object.freeze({
        rgba,
        encoding: signedEncoding,
        coordinate: Object.freeze({ x, y }),
        source: Object.freeze({ format: texture.format, type: texture.type, colorSpace: texture.colorSpace }),
      });
    },
    readDepth(depthTexture, x, y) {
      if (!depthTexture?.isDepthTexture || depthTexture.format !== THREE.DepthFormat ||
          ![THREE.UnsignedShortType, THREE.UnsignedIntType].includes(depthTexture.type)) {
        throw new Error("Focus stage depth probe requires an UnsignedShort or UnsignedInt DepthTexture");
      }
      const image = depthTexture.image;
      const width = Number(image?.width);
      const height = Number(image?.height);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error("Focus stage depth probe requires positive integer texture dimensions");
      }
      const bytes = readBytes(depthTexture, width, height, x, y, true);
      const depth = decodeFocusStageNormalizedPixels(bytes);
      return Object.freeze({
        depth,
        encoding: normalizedEncoding,
        coordinate: Object.freeze({ x, y }),
        source: Object.freeze({ format: depthTexture.format, type: depthTexture.type }),
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target.dispose();
      material.dispose();
      geometry.dispose();
      scene.clear();
    },
  });
}
