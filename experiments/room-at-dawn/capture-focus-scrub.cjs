/* Request-aware Focus scrub diagnostics. Screenshots and rAF observations do not
 * establish what was physically presented by the display compositor. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { summarizeFrameOrder } = require('./focus-scrub-analysis.cjs');
const out = path.resolve(process.argv[2] || '/private/tmp/room-focus-scrub');
const url = process.env.ROOM_OPTICS_URL || 'http://127.0.0.1:5214/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1';
const timeout = 240000;
const values = (process.env.SCRUB_STEPS || '1200,1600,2000,2400,3000').split(',').map(Number);
if (values.length < 2 || values.some(v => !Number.isInteger(v) || v < 100 || v > 8000 || v % 10 !== 0) || values.some((v,i) => i && v <= values[i-1])) throw Error('SCRUB_STEPS must be ascending reachable focus values (10 mm steps, 100–8000 mm)');
const modes = (process.env.SCRUB_MODES || 'processed,raw').split(',');
if (!modes.length || modes.some(x => !['processed','raw'].includes(x))) throw Error('SCRUB_MODES must contain processed and/or raw');
const variant = process.env.SCRUB_VARIANT || 'neutral';
if (!['neutral','shift-swing'].includes(variant)) throw Error('SCRUB_VARIANT must be neutral or shift-swing');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const git = args=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const source={commit:git(['rev-parse','HEAD']),dirtySource:!!git(['status','--porcelain'])};
 const browser=await chromium.launch({headless:true,args:process.env.ROOM_OPTICS_HARDWARE==='1'?(process.platform==='darwin'?['--enable-gpu','--use-angle=metal']:['--enable-gpu']):['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:950}});page.setDefaultTimeout(timeout);
 await page.addInitScript({path:path.join(__dirname,'capture-sync.cjs')});
 const errors=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
 const canvas=page.locator('[data-rtt-resource-channel="default"] canvas');
 async function wait(expected, priorFrame){
  try {await page.waitForFunction(({expected,priorFrame})=>{const s=window.__roomOptics,r=window.__roomInspectCapture(s,expected);return r.status==='failed'||(r.status==='ready'&&(!priorFrame||r.frameId!==priorFrame));},{expected,priorFrame},{timeout});}
  catch(e){const s=await page.evaluate(expected=>({inspection:window.__roomInspectCapture?.(window.__roomOptics,expected),frame:window.__roomOptics?.frame,request:window.__roomOptics?.request}),expected).catch(()=>null);throw Error(`Timed out waiting for current completed frame: ${JSON.stringify(s)}; ${e.message}`)}
  const snap=await page.evaluate(expected=>({result:window.__roomInspectCapture(window.__roomOptics,expected),state:window.__roomOptics,gi:window.__giReport,timestampMs:performance.now()}),expected);
  if(snap.result.status!=='ready') throw Error(`RTT failed: ${JSON.stringify(snap.result)}`);
  return snap;
 }
 async function delta(a,b){return page.evaluate(async ({a,b})=>{async function decode(x){const bytes=Uint8Array.from(atob(x),c=>c.charCodeAt(0));const img=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);img.close();return {w:c.width,h:c.height,data:g.getImageData(0,0,c.width,c.height).data}}const x=await decode(a),y=await decode(b);if(x.w!==y.w||x.h!==y.h)throw Error('dimensions mismatch');let sum=0,max=0,changed=0,above3=0;const histogram=new Uint32Array(766);for(let i=0;i<x.data.length;i+=4){let d=0;for(let k=0;k<3;k++)d+=Math.abs(x.data[i+k]-y.data[i+k]);sum+=d;max=Math.max(max,d/3);if(d>6)changed++;if(d>9)above3++;histogram[d]++}let count=0,p99=0;for(let i=0;i<histogram.length;i++){count+=histogram[i];if(count>=0.99*x.w*x.h){p99=i/3;break}}const mean=sum/(x.w*x.h*3);return {meanAbsoluteRgb8:mean,p99MeanChannelDifference:p99,fractionAbove3:above3/(x.w*x.h),repeatabilityPass:mean<=1&&p99<=3,maximumMeanChannelDifference:max,changedPixelFraction:changed/(x.w*x.h),width:x.w,height:x.h,meaning:'same-state repeat only, display-referred; not CoC or focus-breathing correctness'}},{a:a.toString('base64'),b:b.toString('base64')})}
 try{
  await page.goto(url);await page.waitForFunction(()=>window.__roomOptics?.ready||window.__roomOptics?.error,null,{timeout});
  await page.getByLabel('Composition').selectOption('depth');await page.getByLabel('Color path').selectOption('hdr');
  await page.getByLabel('Reflections').check();await page.getByLabel('Display exposure').fill('18.1');await page.getByLabel('Aperture').selectOption('5.6');
  if(variant==='shift-swing'){await page.getByLabel('Shift (mm)').fill('32');await page.getByLabel('Swing (degrees)').fill('-2.1')}
  const movementExpected=variant==='shift-swing'?{'camera.frontShiftMm':32,'camera.frontSwingDeg':-2.1}:{'camera.frontShiftMm':0,'camera.frontSwingDeg':0};
  await page.getByRole('button',{name:'Unmount Observer'}).click();
  const initial=await wait({presetKey:'depth',hdr:true,reflectionsEnabled:true,displayExposure:18.1,rawDebug:false,'camera.aperture':5.6,...movementExpected},null);
  const gpu=await canvas.evaluate(el=>{const gl=el.getContext('webgl2')||el.getContext('webgl');const e=gl?.getExtension('WEBGL_debug_renderer_info');return {width:el.width,height:el.height,cssWidth:el.clientWidth,cssHeight:el.clientHeight,version:gl?.getParameter(gl.VERSION),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER)}});
  const records=[];
  for(const mode of modes){
   const raw=mode==='raw';const current=await page.evaluate(()=>window.__roomOptics.rawDebug);
   if(current!==raw) await page.getByRole('button',{name:raw?'Raw RTT debug':'Processed'}).click();
   for(const [direction,steps] of [['forward',values],['reverse',[...values].reverse()]]){
    for(let i=0;i<steps.length;i++){
     const focus=steps[i];await page.getByLabel('Focus (mm)').fill(String(focus));
     const expected={presetKey:'depth',rawDebug:raw,'camera.focusDistanceMm':focus,'camera.aperture':5.6,displayExposure:18.1,hdr:true,reflectionsEnabled:true,...movementExpected};
     const before=await wait(expected,null);const name=`${mode}-${direction}-${String(i).padStart(2,'0')}-${focus}`;
     const png=await canvas.screenshot({path:path.join(out,`${name}.png`),timeout});const after=await wait(expected,null);
     if(before.result.requestId!==after.result.requestId||before.result.generationId!==after.result.generationId)throw Error(`${name}: state changed while capturing`);
     const record={name,mode,direction,requestedFocusMm:focus,before,after,captureTimestamp:new Date().toISOString(),png:`${name}.png`,source,gpu};
     fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(record,null,2)+'\n');records.push({name,mode,direction,focus,request:after.result.requestId,generation:after.result.generationId,frame:after.result.frameId,png:`${name}.png`});
     console.log(name,after.result.frameId);
     // Same-state repeat: render a later completed frame, without changing optics.
     if(direction==='forward' && i===Math.floor(steps.length/2)){
      const later=await wait(expected,after.result.frameId);const repeatName=`${mode}-repeat-${focus}`;
      const second=await canvas.screenshot({path:path.join(out,`${repeatName}.png`),timeout});const repeatAfter=await wait(expected,null);
      if(later.result.requestId!==repeatAfter.result.requestId||later.result.generationId!==repeatAfter.result.generationId)throw Error(`${repeatName}: state changed while capturing`);
      const comparison=await delta(png,second);fs.writeFileSync(path.join(out,`${repeatName}.json`),JSON.stringify({focus,source,before:after.result,later:later.result,after:repeatAfter.result,comparison},null,2)+'\n');records.push({name:repeatName,mode,direction:'repeat',focus,request:repeatAfter.result.requestId,generation:repeatAfter.result.generationId,frame:repeatAfter.result.frameId,comparison,png:`${repeatName}.png`});
     }
    }
   }
  }
  // Observe actual input events and rAF-visible RTT completion snapshots during a
  // physical slider drag. rAF/frame telemetry is not proof of compositor presentation.
  const nowRaw=await page.evaluate(()=>window.__roomOptics.rawDebug);if(nowRaw)await page.getByRole('button',{name:'Processed'}).click();
  const slider=page.getByLabel('Focus (mm)');await slider.fill(String(values[0]));await wait({'camera.focusDistanceMm':values[0],rawDebug:false},null);
  await page.evaluate(()=>{const input=document.querySelector('input[aria-label="Focus (mm)"]');const trace=window.__focusScrubTrace={events:[],samples:[],running:true};input.addEventListener('input',e=>trace.events.push({time:performance.now(),value:Number(e.target.value),trusted:e.isTrusted}));let last='';function tick(){if(!trace.running)return;const s=window.__roomOptics,f=s?.frame;const key=`${s?.request?.requestId}/${f?.frameId}`;if(s&&key!==last){last=key;trace.samples.push({time:performance.now(),committedFocusMm:s.camera?.focusDistanceMm,request:s.request,generation:s.generation,frame:f&&{frameId:f.frameId,status:f.status,request:f.request,generation:f.generation},inspection:window.__roomInspectCapture(s,{})})}requestAnimationFrame(tick)}requestAnimationFrame(tick)});
  const box=await slider.boundingBox();if(!box)throw Error('Focus slider has no visible bounds');const left=box.x+8,right=box.x+box.width-8,y=box.y+box.height/2;const pos=v=>left+(right-left)*(v-100)/(8000-100);
  await page.mouse.move(pos(values[0]),y);await page.mouse.down();for(const value of values.slice(1))await page.mouse.move(pos(value),y,{steps:3});await page.mouse.up();
  const lastInput=await slider.inputValue();await wait({'camera.focusDistanceMm':Number(lastInput),rawDebug:false},null);
  const trace=await page.evaluate(()=>{window.__focusScrubTrace.running=false;return window.__focusScrubTrace});
  const order = summarizeFrameOrder(trace.samples);
  fs.writeFileSync(path.join(out,'interactive.json'),JSON.stringify({source,variant,gpu,lastInput:Number(lastInput),trace,order,limitation:'rAF telemetry samples input, committed state and reported completion; it does not directly observe compositor presentation or prove absence of dropped frames. A completed frame may lag the committed state without being a presentation-order regression.'},null,2)+'\n');
  // Same-focus forward/reverse comparisons do not include geometric breathing.
  const comparisons=[];for(const mode of modes)for(const focus of values){const a=records.find(r=>r.mode===mode&&r.direction==='forward'&&r.focus===focus),b=records.find(r=>r.mode===mode&&r.direction==='reverse'&&r.focus===focus);if(a&&b)comparisons.push({mode,focus,forward:a.name,reverse:b.name,...await delta(fs.readFileSync(path.join(out,a.png)),fs.readFileSync(path.join(out,b.png)))})}
  const manifest={...source,url,browser:browser.version(),gpu,variant,values,modes,aperture:5.6,displayExposure:18.1,hdr:true,reflections:true,initial:initial.result,records,comparisons,errors,interpretation:'Same-state repeat/forward-reverse mean RGB8 difference <=1 and P99 per-pixel mean-channel difference <=3 is a conservative display-repeatability criterion; it does not establish blur accuracy, visibility or focus-breathing correctness. Cross-focus pixel differences are not interpreted as instability. rAF completion telemetry is not direct compositor-presented-frame evidence.'};
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');if(errors.length)throw Error(`Browser errors: ${JSON.stringify(errors)}`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
