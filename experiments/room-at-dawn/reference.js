import * as THREE from 'three';
import { buildScene } from './vendor/src/scene/index.js';
import { GI, captureEnv } from './vendor/src/core/gi.js';
import { setMaxAniso } from './vendor/src/core/tex.js';
import { Pipeline } from './vendor/src/render/pipeline.js';
import { CAMS } from './vendor/src/render/cams.js';
import { applyLook } from './vendor/src/render/look.js';
import bakeUrl from './vendor/bake/gi.bin?url';
import { inspectBake } from './bake-check.js';

const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#view'), antialias: false, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
setMaxAniso(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
const camera = new THREE.PerspectiveCamera(50, 16 / 9, .05, 400);


async function boot() {
  const { scene, ctx } = await buildScene(p => { status.textContent = `Building ${p}…`; });
  const response = await fetch(bakeUrl);
  if (!response.ok) throw Error(`GI fetch failed: ${response.status}`);
  const report = inspectBake(scene, await response.arrayBuffer());
  const pipe = new Pipeline(renderer, scene, camera);
  applyLook(pipe);
  const probe = new THREE.Vector3(2.35, 1.3, 2.0);
  GI.uniforms.giExt.value = pipe.look.ext;
  for (let i = 0; i < 2; i++) { const env = captureEnv(renderer, scene, probe, ctx.roomBox.min, ctx.roomBox.max, 256); if (ctx.glass) ctx.glass.uniforms.envMap.value = env; }
  GI.uniforms.giExt.value = 1;
  function render(name) {
    const c = CAMS[name]; camera.position.fromArray(c.pos); camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3().fromArray(c.target)); camera.fov = c.fov;
    const w = 960, h = 540; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); pipe.setSize(w, h, { msaa: 0 });
    pipe.render(); renderer.getContext().finish();
    status.textContent = `WebGL reference: ${name}\nGI ${report.matched}/${report.expected} matched; missing ${report.missing.length}, mismatch ${report.mismatch.length}, stale ${report.stale.length}\nGround Glass and optical controls: not implemented.`;
  }
  document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => render(b.dataset.camera)));
  render('wide'); window.__referenceReady = true; window.__renderReference = render;
}
boot().catch(error => { window.__referenceError = String(error.stack || error); status.textContent = window.__referenceError; console.error(error); });
