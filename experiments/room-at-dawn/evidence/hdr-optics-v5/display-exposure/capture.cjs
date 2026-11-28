const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const out = path.resolve(process.argv[2] || '/private/tmp/room-hdr-probe');
const url = process.env.ROOM_OPTICS_URL || 'http://127.0.0.1:5213/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1';
const timeout = 240000;
const absTolerance = 0.002, relativeTolerance = 0.0015;
fs.mkdirSync(out, {recursive: true});
(async () => {
 const browser = await chromium.launch({headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page = await browser.newPage({viewport:{width:1200,height:950}}); page.setDefaultTimeout(timeout);
 const errors=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('console', m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript({path:path.resolve(__dirname,'../../../capture-sync.cjs')});
 const cases=[];
 const commit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const dirtySource = !!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
 try {
  await page.goto(url); await page.waitForFunction(()=>window.__roomOptics?.ready || window.__roomOptics?.error,null,{timeout});
  await page.getByLabel('Reflections').uncheck();
  await page.getByRole('button',{name:'Unmount Observer'}).click();
  await page.getByLabel('Subject').selectOption('hdr-probe');
  async function record(name, field, depth) {
   await page.getByLabel('HDR input').selectOption(field);
   await page.getByLabel('HDR field depth').selectOption(String(depth));
   await page.waitForFunction(({field,depth})=>{
    const s=window.__roomOptics, p=window.__roomHdrProbe;
    if(!s || s.hdrField!==field || s.hdrDepth!==depth || s.subjectMode!=='hdr-probe')return false;
    if (p?.request?.requestId!==s.request?.requestId || p?.generation?.generationId!==s.generation?.generationId)return false;
    if (p.status==='failed')return true;
    const f=s.frame; return p.status==='sampled' && f?.status==='completed' && f.frameId===p.frameId && window.__roomInspectCapture(s,{}).status==='ready';
   },{field,depth},{timeout});
   const state=await page.evaluate(()=>({probe:window.__roomHdrProbe, frame:window.__roomOptics.frame, camera:window.__roomOptics.camera, quality:window.__roomOptics.renderQuality}));
   if(state.probe.status!=='sampled')throw Error(`${name}: ${JSON.stringify(state.probe)}`);
   const c=page.locator('[data-rtt-resource-channel="default"] canvas');
   const png=await c.screenshot({path:path.join(out,`${name}.png`),timeout});
   const after=await page.evaluate(()=>({p:window.__roomHdrProbe,f:window.__roomOptics.frame}));
   if(after.p.frameId!==state.probe.frameId || after.f.request.requestId!==state.frame.request.requestId)throw Error(`${name}: frame changed while capturing`);
   const pixel=await page.evaluate(async b64=>{const b=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const img=await createImageBitmap(new Blob([b],{type:'image/png'}));const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return {width:c.width,height:c.height,rgba:Array.from(x.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data)}},png.toString('base64'));
   const p=state.probe, compare=(observed,expected)=>observed.map((v,i)=>({expected:expected[i],measured:v,absoluteError:Math.abs(v-expected[i]),relativeError:expected[i]===0?null:Math.abs(v-expected[i])/Math.abs(expected[i]),pass:Math.abs(v-expected[i])<=Math.max(absTolerance,relativeTolerance*Math.abs(expected[i]))}));
   const scene=compare(p.stages.scene.rgba.slice(0,3),p.input);
   const far=compare(p.stages.far.rgba.slice(0,3),p.input);
   const composite=compare(p.stages.composite.rgba.slice(0,3),p.expectedComposite);
   const expectedDisplay=p.stages.composite.rgba.slice(0,3).map(v=>{const x=Math.max(0,v*p.displayExposure), l=x/(1+x);return Math.round(255*(l<=0.0031308?12.92*l:1.055*Math.pow(l,1/2.4)-0.055))});
   const display=pixel.rgba.slice(0,3).map((v,i)=>({expected:expectedDisplay[i],measured:v,error:Math.abs(v-expectedDisplay[i]),pass:Math.abs(v-expectedDisplay[i])<=2}));
   const result={name,commit,dirtySource,...state,screenshotFrame:after.f,pixel,tolerances:{absolute:absTolerance,relative:relativeTolerance,displayRgb8:2},checks:{scene,far,composite,display},nearNote:'Near-layer alpha/coverage is recorded separately; zero is not evidence of near HDR preservation.'};
   fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(result,null,2)+'\n'); cases.push({name,scene,far,composite,display,near:p.stages.near.rgba}); console.log(name,JSON.stringify(cases.at(-1)));
  }
  if(process.env.ROOM_HDR_EXPOSURE_ONLY === '1') {
   for(const exposure of ['0.5','1','4']) {
    await page.getByLabel('Display exposure').fill(exposure);
    await record(`exposure-${exposure}`,'mixed',2.5);
   }
  } else if(process.env.ROOM_HDR_APERTURE_ONLY === '1') {
   for(const aperture of ['5.6','11','22']) {
    await page.getByLabel('Aperture').selectOption(aperture);
    await record(`aperture-${aperture}`,'mixed',2.5);
   }
  } else {
   for(const v of ['0.1','0.5','1','2','4','8','mixed'])await record(`focused-${v}`,v,2.5);
   await record('near-mixed','mixed',0.8);
  }
  const gpu = await page.locator('[data-rtt-resource-channel="default"] canvas').evaluate(canvas => { const gl=canvas.getContext('webgl2'); if(!gl)return null; const ext=gl.getExtension('WEBGL_debug_renderer_info'); return {version:gl.getParameter(gl.VERSION),renderer:ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}; });
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({commit,dirtySource,url,browser:browser.version(),gpu,cases,errors,tolerances:{absolute:absTolerance,relative:relativeTolerance,displayRgb8:2}},null,2)+'\n');
  if(errors.length)throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  if(cases.some(c=>[...c.scene,...c.far,...c.composite,...c.display].some(x=>!x.pass)))throw Error('One or more calibrated checks failed; see individual records');
  if(process.env.ROOM_HDR_APERTURE_ONLY !== '1' && process.env.ROOM_HDR_EXPOSURE_ONLY !== '1' && (!cases.find(c=>c.name==='near-mixed')?.near.slice(0,3).some(v=>v>1) || cases.find(c=>c.name==='near-mixed').near[3]<=0))throw Error('Near gather did not produce measurable HDR coverage');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
