import * as THREE from "three";

/**
 * Prepare one renderer-owned reflection probe. All positions are upstream metres,
 * except the runtime capture position (upstream probe minus roomOrigin). The
 * caller must have adapted vGiW to the upstream frame before mounting the scene.
 *
 * RTT and Observer cannot share this WebGL render-target texture. The original
 * glass ShaderMaterial is intentionally not assigned an environment: its
 * samplerCube/world-position contract needs a separate renderer-local shader
 * adaptation even though each view now owns its material variants.
 *
 * Three r187's PMREMGenerator accepts an output cube target. Supplying our own
 * with its required mip layout means a failed generation cannot strand an
 * otherwise inaccessible output target. This is intentionally scoped to the
 * pinned Three version and must be re-audited if it changes.
 */
export function captureRoomReflections({
  renderer,
  scene,
  giUniforms,
  roomBox,
  probe,
  roomOrigin,
  size = 256,
  captureExteriorScale = 0.21,
}) {
  if (!renderer?.isWebGLRenderer || !scene?.isScene) {
    throw new Error("Room reflection capture requires a WebGL renderer and scene");
  }
  if (!Number.isInteger(size) || size < 256 || (size & (size - 1)) !== 0) {
    throw new Error("Room reflection capture size must be a power of two at least 256");
  }
  if (!Number.isFinite(captureExteriorScale) || captureExteriorScale < 0) {
    throw new Error("Room reflection exterior scale must be finite and non-negative");
  }
  for (const value of [roomBox?.min, roomBox?.max, probe, roomOrigin]) {
    if (!value?.isVector3 || ![value.x, value.y, value.z].every(Number.isFinite)) {
      throw new Error("Room reflection capture requires finite THREE.Vector3 coordinates");
    }
  }
  if (
    !giUniforms?.giBoxMin?.value?.isVector3 ||
    !giUniforms?.giBoxMax?.value?.isVector3 ||
    !giUniforms?.giProbePos?.value?.isVector3 ||
    !giUniforms?.giExt
  ) {
    throw new Error("Room reflection capture requires the upstream GI uniforms");
  }

  const previousEnvironment = scene.environment;
  const previousBoxMin = giUniforms.giBoxMin.value.clone();
  const previousBoxMax = giUniforms.giBoxMax.value.clone();
  const previousProbe = giUniforms.giProbePos.value.clone();
  const previousExterior = giUniforms.giExt.value;
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMip = renderer.getActiveMipmapLevel();
  const previousViewport = renderer.getViewport(new THREE.Vector4());
  const previousScissor = renderer.getScissor(new THREE.Vector4());
  const previousScissorTest = renderer.getScissorTest();
  const previousClearColor = renderer.getClearColor(new THREE.Color());
  const previousClearAlpha = renderer.getClearAlpha();
  const previousXr = renderer.xr.enabled;
  const previousAutoClear = renderer.autoClear;
  const previousToneMapping = renderer.toneMapping;
  const previousExposure = renderer.toneMappingExposure;
  const context = renderer.getContext();

  let captureTarget = null;
  let firstTarget = null;
  let resultTarget = null;
  let generator = null;
  let installed = false;
  let disposed = false;

  const restoreGi = () => {
    giUniforms.giBoxMin.value.copy(previousBoxMin);
    giUniforms.giBoxMax.value.copy(previousBoxMax);
    giUniforms.giProbePos.value.copy(previousProbe);
    giUniforms.giExt.value = previousExterior;
  };
  const disposeTarget = (target) => {
    if (target) target.dispose();
  };
  const makePmremTarget = () => {
    const target = new THREE.WebGLCubeRenderTarget(size, {
      minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: false,
    });
    // PMREMGenerator r187's minimum LOD is 3 (8×8 pixels).
    for (let lod = 0; lod <= Math.log2(size) - 3; lod++) {
      target.texture.mipmaps.push({ width: size >> lod, height: size >> lod });
    }
    target.texture.name = "room-at-dawn-owned-pmrem";
    target.texture.isPMREMTexture = true;
    return target;
  };
  const requireComplete = (target, label, mip = 0) => {
    renderer.setRenderTarget(target, 0, mip);
    const status = context.checkFramebufferStatus(context.FRAMEBUFFER);
    if (status !== context.FRAMEBUFFER_COMPLETE) {
      throw new Error(`${label} framebuffer incomplete at mip ${mip}: 0x${status.toString(16)}`);
    }
  };

  let captureError = null;
  try {
    captureTarget = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    firstTarget = makePmremTarget();
    resultTarget = makePmremTarget();
    requireComplete(captureTarget, "Room reflection capture");
    for (const [target, label] of [
      [firstTarget, "First PMREM"],
      [resultTarget, "Final PMREM"],
    ]) {
      requireComplete(target, label);
      requireComplete(target, label, target.texture.mipmaps.length - 1);
    }

    generator = new THREE.PMREMGenerator(renderer);
    const camera = new THREE.CubeCamera(0.03, 200, captureTarget);
    camera.position.copy(probe).sub(roomOrigin);
    giUniforms.giBoxMin.value.copy(roomBox.min);
    giUniforms.giBoxMax.value.copy(roomBox.max);
    giUniforms.giProbePos.value.copy(probe);
    giUniforms.giExt.value = captureExteriorScale;
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;

    // Pass 1 has no environment; pass 2 reads the first PMREM while writing a
    // separate cube/PMREM target, avoiding texture feedback into its own input.
    scene.environment = null;
    camera.update(renderer, scene);
    generator.fromCubemap(captureTarget.texture, firstTarget);
    scene.environment = firstTarget.texture;
    camera.update(renderer, scene);
    generator.fromCubemap(captureTarget.texture, resultTarget);
    scene.environment = resultTarget.texture;
    installed = true;
  } catch (error) {
    captureError = error;
  }

  const cleanupFailures = [];
  const attempt = (operation) => {
    try {
      operation();
    } catch (error) {
      cleanupFailures.push(error);
    }
  };
  // CubeCamera's normal restoration does not cover exceptions inside render.
  // Attempt every restoration/disposal even if one step fails.
  attempt(() => renderer.setRenderTarget(previousTarget, previousFace, previousMip));
  attempt(() => renderer.setViewport(previousViewport));
  attempt(() => renderer.setScissor(previousScissor));
  attempt(() => renderer.setScissorTest(previousScissorTest));
  attempt(() => renderer.setClearColor(previousClearColor, previousClearAlpha));
  attempt(() => {
    renderer.xr.enabled = previousXr;
  });
  attempt(() => {
    renderer.autoClear = previousAutoClear;
  });
  attempt(() => {
    renderer.toneMapping = previousToneMapping;
  });
  attempt(() => {
    renderer.toneMappingExposure = previousExposure;
  });
  attempt(() => {
    giUniforms.giExt.value = previousExterior;
  });
  attempt(() => generator?.dispose());
  attempt(() => disposeTarget(captureTarget));
  attempt(() => disposeTarget(firstTarget));
  if (captureError || cleanupFailures.length || !installed) {
    attempt(() => {
      scene.environment = previousEnvironment;
    });
    attempt(restoreGi);
    attempt(() => disposeTarget(resultTarget));
    if (captureError && cleanupFailures.length === 0) throw captureError;
    throw new AggregateError(
      [captureError, ...cleanupFailures].filter(Boolean),
      "Room reflection capture failed or could not restore owned state",
    );
  }

  return () => {
    if (disposed) return;
    disposed = true;
    const failures = [];
    const attemptCleanup = (operation) => {
      try {
        operation();
      } catch (error) {
        failures.push(error);
      }
    };
    attemptCleanup(() => {
      if (scene.environment === resultTarget.texture) scene.environment = previousEnvironment;
    });
    attemptCleanup(restoreGi);
    attemptCleanup(() => disposeTarget(resultTarget));
    if (failures.length) throw new AggregateError(failures, "Room reflection cleanup failed");
  };
}
