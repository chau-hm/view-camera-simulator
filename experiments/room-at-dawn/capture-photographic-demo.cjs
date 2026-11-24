/* Capture actual completed High-quality room RTT frames for photographic scouting. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const out = path.resolve(process.argv[2] || '/private/tmp/room-photo-scout');
const cases = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
if (fs.existsSync(out)) throw new Error(`Choose a fresh evidence directory: ${out}`);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.addInitScript({ path: path.join(__dirname, 'capture-sync.cjs') });
  await page.addInitScript(() => { window.__focusStageControl = { enabled: true, captureCanvas: true, points: [{ id: 'center', uv: [0.5, 0.5] }, { id:'bed-near',worldM:[0,-0.5746245,1.2912222] }, { id:'bed-far',worldM:[0,-0.5570072,2.0026157] }] }; });
  const url = process.env.ROOM_OPTICS_URL || 'http://127.0.0.1:5215/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1&focusStage=1';
  const records = [];
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__roomOptics?.ready || window.__roomOptics?.error, null, {timeout:240000});
    await page.getByLabel('Render quality').selectOption('high');
    for (const c of cases) {
      await page.getByLabel('Composition').selectOption(c.preset);
      if (await page.getByLabel('Lens').count()) await page.getByLabel('Lens').selectOption(String(c.lens));
      await page.getByLabel('Aperture').selectOption(String(c.aperture || 5.6));
      await page.getByLabel('Display exposure').fill(String(c.exposure || 19));
      await page.getByLabel('Focus (mm)').fill(String(c.focus));
      await page.getByLabel('Tilt (degrees)').fill(String(c.tilt || 0));
      await page.getByLabel('Swing (degrees)').fill(String(c.swing || 0));
      const expected = { subjectMode:'room', presetKey:c.preset, renderQuality:'high', hdr:true, rawDebug:false,
        'camera.focalLengthMm':c.lens, 'camera.focusDistanceMm':c.focus, 'camera.aperture':c.aperture || 5.6,
        'camera.frontTiltDeg':c.tilt || 0, 'camera.frontSwingDeg':c.swing || 0, displayExposure:c.exposure || 19 };
      await page.waitForFunction(required => {
        const s=window.__roomOptics, ready=window.__roomInspectCapture?.(s,required);
        if(ready?.status === 'failed') throw new Error(ready.reason);
        if(ready?.status !== 'ready') return false;
        return window.__focusStageSamples?.some(x => x.request?.requestId === ready.requestId && x.generation?.generationId === ready.generationId && x.completion?.status === 'completed' && x.completion.frameId === x.frameId && x.canvasDataUrl);
      }, expected, {timeout:240000});
      const snapshot = await page.evaluate(({required, knownPoints}) => {
        const s=window.__roomOptics, ready=window.__roomInspectCapture(s,required);
        const p=[...window.__focusStageSamples].reverse().find(x => x.request?.requestId===ready.requestId && x.generation?.generationId===ready.generationId && x.completion?.status==='completed' && x.frameId===x.completion.frameId && x.canvasDataUrl);
        const identity={requestId:p.request.requestId,generationId:p.generation.generationId,frameId:p.frameId};
        const probes=[...([0.1,0.25,0.4,0.6,0.75].flatMap(v=>[0.25,0.5,0.75].map(u=>({id:`u${u}-v${v}`,displayUv:{u,v}})))), ...(knownPoints || [])];
        const canvas=document.querySelector('[data-rtt-resource-channel="default"] canvas');
        const gl=canvas?.getContext('webgl2');
        const ext=gl?.getExtension('WEBGL_debug_renderer_info');
        const gpu=gl ? { version:gl.getParameter(gl.VERSION), renderer:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, width:canvas.width, height:canvas.height } : null;
        const giStatus=[...document.querySelectorAll('[role="status"]')].map(node=>node.textContent).find(text=>text?.startsWith('Ready: GI')) || null;
        if (giStatus !== 'Ready: GI 302/302; WebGL RTT') throw new Error(`Unexpected bake status: ${giStatus}`);
        return {image:p.canvasDataUrl, identity, stagePoints:p.points, camera:s.camera, optics:s.optics, preset:s.preset, quality:s.renderQuality, giStatus, gpu,
          hdr:s.hdr, exposure:s.displayExposure, reflections:s.reflectionsEnabled, info:s.observation.info,
          surfaces:window.__roomSurfaceInspect(probes,identity,s.previewMode)};
      },{required: expected, knownPoints: c.probes});
      fs.writeFileSync(path.join(out,`${c.id}.png`),Buffer.from(snapshot.image.split(',')[1],'base64'));
      delete snapshot.image; records.push({id:c.id,...snapshot});
      console.log(c.id,JSON.stringify(snapshot.identity));
    }
    fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),browser:browser.version(),url,records,errors},null,2));
    if(errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
