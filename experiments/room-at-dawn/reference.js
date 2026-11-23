import * as THREE from 'three';
import { buildScene } from './vendor/src/scene/index.js';
import { GI, giMeshes, applyBake, captureEnv } from './vendor/src/core/gi.js';
import { setMaxAniso } from './vendor/src/core/tex.js';
import { Pipeline } from './vendor/src/render/pipeline.js';
import { CAMS } from './vendor/src/render/cams.js';
import { applyLook } from './vendor/src/render/look.js';
import bakeUrl from './vendor/bake/gi.bin?url';

const status = document.querySelector('#status');
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#view'), antialias: false, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
setMaxAniso(Math.min(16, renderer.capabilities.getMaxAnisotropy()));
const camera = new THREE.PerspectiveCamera(50, 16 / 9, .05, 400);

function inspectBake(scene, buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8 || view.getUint32(0, true) !== 0x47494231) throw Error('Invalid GI magic');
  const len = view.getUint32(4, true);
  if (8 + len > buffer.byteLength) throw Error('Truncated GI manifest');
  const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, len)));
  if (manifest.version !== 1 || !Array.isArray(manifest.meshes)) throw Error('Unsupported GI manifest');
  const start = Math.ceil((8 + len) / 4) * 4;
  const entries = giMeshes(scene), byKey = new Map(manifest.meshes.map(m => [m.key, m]));
  const keys = new Set(entries.map(e => e.key));
  const missing = entries.filter(e => !byKey.has(e.key)).map(e => e.key);
  const mismatch = entries.filter(e => { const m = byKey.get(e.key); return m && (m.count !== e.count || m.back !== e.back); }).map(e => e.key);
  const stale = manifest.meshes.filter(m => !keys.has(m.key)).map(m => m.key);
  const invalid = manifest.meshes.filter(m => !Number.isInteger(m.off) || !Number.isInteger(m.count) || m.off < 0 || m.count < 0 || start + 2 * (m.off + m.count * (m.back ? 9 : 6)) > buffer.byteLength).map(m => m.key);
  const report = { expected: entries.length, baked: manifest.meshes.length, matched: entries.length - missing.length - mismatch.length, missing, mismatch, stale, invalid, duplicateKeys: manifest.meshes.length - byKey.size };
  window.__giReport = report;
  if (missing.length || mismatch.length || stale.length || invalid.length || report.duplicateKeys) throw Error(`GI incompatible: ${JSON.stringify(report)}`);
  const applied = applyBake(scene, buffer);
  if (!applied.ok || applied.stale || applied.applied !== entries.length) throw Error(`GI apply failed: ${JSON.stringify(applied)}`);
  return report;
}

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
