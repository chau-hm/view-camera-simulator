import { makePixelProvenance } from "./pixel-provenance.mjs";
import { instrumentRenderer, requireReviewedRenderer } from "./source-injection.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const [sourceRoot, outputRoot, seed] = process.argv.slice(2);
if (!sourceRoot || !outputRoot || !["284719", "1"].includes(seed)) throw new Error("Usage: capture-d6.mjs <source-root> <output> <284719|1>");
requireReviewedRenderer(await readFile(resolve(sourceRoot,"src/render/GroundGlassRTT.tsx")));
let tap=await readFile(new URL("./rtt-tap.txt",import.meta.url),"utf8");
const injectUnique=(source,anchor,replacement)=>{if(source.split(anchor).length!==2)throw Error("D6 tap anchor drift");return source.replace(anchor,replacement);};
tap=injectUnique(tap,"        const grid = [];","        const grid = []; const d6Hits = []; const d6Halo = [];");
tap=injectUnique(tap,"          for (let row = 0; row < 64; row++) {",`          for(let y=309;y<322;y++) for(let x=317;x<330;x++) {
            ray.setFromCamera(new THREE.Vector2(2*(x+0.5)/sourceRenderTarget.width-1,2*(y+0.5)/sourceRenderTarget.height-1),cam);
            const hits=ray.intersectObject(registered,true).filter(visible);
            const hit=hits.find(h=>{const z=-h.point.clone().applyMatrix4(cam.matrixWorldInverse).z;return z>=cam.near && z<=cam.far;});
            if(!hit){d6Hits.push({x,y});continue;}
            const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
            d6Hits.push({x,y,name:hit.object.name,depthM:-hit.point.clone().applyMatrix4(cam.matrixWorldInverse).z,material:{name:material?.name,type:material?.type,color:material?.color?.getHexString(),roughness:material?.roughness}});
          }
          for(let y=261;y<370;y++) for(let x=269;x<378;x++) {
            ray.setFromCamera(new THREE.Vector2(2*(x+0.5)/sourceRenderTarget.width-1,2*(y+0.5)/sourceRenderTarget.height-1),cam);
            const hits=ray.intersectObject(registered,true).filter(visible);
            const hit=hits.find(h=>{const z=-h.point.clone().applyMatrix4(cam.matrixWorldInverse).z;return z>=cam.near && z<=cam.far;});
            d6Halo.push(hit ? [-hit.point.clone().applyMatrix4(cam.matrixWorldInverse).z,hit.object.name] : null);
          }
          for (let row = 0; row < 64; row++) {`);
tap=injectUnique(tap,"cocWidth:cocRT.width, cocHeight:cocRT.height, patches, grid,","cocWidth:cocRT.width, cocHeight:cocRT.height, patches, grid, d6Hits, d6Halo, variationIdentity:variationDescriptor?.identity,");
const server=await createServer({root:sourceRoot,server:{host:"127.0.0.1",port:4399,strictPort:true,watch:null},plugins:[{name:"a1-d6-test-only",enforce:"pre",transform(code,id){if(id!==resolve(sourceRoot,"src/render/GroundGlassRTT.tsx"))return null;return {code:instrumentRenderer(code,tap),map:null};}}]});
let browser;
try {
  await mkdir(outputRoot,{recursive:true});await server.listen();browser=await chromium.launch({args:["--use-angle=metal","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,locale:"en-US"});page.setDefaultTimeout(35000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto(`http://127.0.0.1:4399/simulator/free/architecture-foreground?rttDiagnostics=1&dofProfiling=1&seed=${seed}&sv=1`);
  const rtt=page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  await page.getByLabel(/Render quality/i).selectOption("standard");await page.getByRole("radio",{name:"Upright Assist",exact:true}).check();
  async function setStep(name,value){const el=page.getByRole("slider",{name,exact:true});await el.evaluate((f,v)=>{const n=(v-Number(f.min))/Number(f.step);if(v<Number(f.min)||v>Number(f.max)||Math.abs(n-Math.round(n))>1e-7)throw Error("Unreachable setting");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(f,String(v));f.dispatchEvent(new Event("input",{bubbles:true}));},value);await expect(el).toHaveValue(String(value));}
  await setStep("Rise",0);await setStep("Tilt",0);await setStep("Focus distance",9500);await page.getByRole("radio",{name:"f/11",exact:true}).check();
  await expect(rtt).toHaveAttribute("data-frame-result-status","completed");await expect.poll(()=>rtt.evaluate(el=>el.dataset.frameRequestId===el.dataset.lastCompletedRequestId),{timeout:20000}).toBe(true);
  const ui=await rtt.evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith("data-")).map(a=>[a.name,a.value])));
  const cameraState=await page.evaluate(async()=>{const {useAppStore}=await import("/src/state/appStore.ts");return useAppStore.getState().camera;});
  await page.evaluate(()=>{globalThis.__a0Result=null;globalThis.__a0Request={tag:"d6",grid:true};});
  await page.waitForFunction(()=>Boolean(globalThis.__a0Result),null,{timeout:35000});
  const result=await page.evaluate(()=>{const value=globalThis.__a0Result;globalThis.__a0Request=null;return value;});
  const {raw,final,coc,depth,...data}=result;
  const rawBytes=Buffer.from(raw,"base64"),finalBytes=Buffer.from(final,"base64");
  const rawSample=makePixelProvenance(rawBytes,data.width,data.height,data.completion.frameId),finalSample=makePixelProvenance(finalBytes,data.finalWidth,data.finalHeight,data.completion.frameId);
  const acceptedUi=await rtt.evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith("data-")).map(a=>[a.name,a.value])));
  if(ui["data-frame-request-id"]!==data.request.requestId || acceptedUi["data-frame-request-id"]!==data.request.requestId || acceptedUi["data-last-completed-request-id"]!==data.request.requestId || acceptedUi["data-renderer-generation"]!==data.completion.generation.generationId || data.expectedSubjectGeneration!==data.subjectGeneration || errors.length) throw Error("D6 current-frame or runtime mismatch: "+errors.join(","));
  const auxiliary={depth:Buffer.from(depth,"base64"),coc:Buffer.from(coc,"base64")};
  const auxiliaryDigests=Object.fromEntries(Object.entries(auxiliary).map(([name,bytes])=>[name,createHash("sha256").update(bytes).digest("hex")]));
  for(const [name,bytes] of Object.entries({raw:rawBytes,final:finalBytes,raw32:rawSample.sample,final32:finalSample.sample,...auxiliary}))await writeFile(resolve(outputRoot,name+".bin.gz"),gzipSync(bytes,{level:9,mtime:0}));
  const producerDigests={};for(const name of ["capture-d6.mjs","source-injection.mjs","rtt-tap.txt","pixel-provenance.mjs"])producerDigests[name]=createHash("sha256").update(await readFile(new URL("./"+name,import.meta.url))).digest("hex");
  await writeFile(resolve(outputRoot,"record.json"),JSON.stringify({...data,seed,ui,acceptedUi,cameraState,auxiliaryDigests,pixelProvenance:{raw:rawSample.evidence,final:finalSample.evidence},producerDigests,source:execFileSync("git",["-C",sourceRoot,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),trackedSourceClean:!execFileSync("git",["-C",sourceRoot,"status","--porcelain","--untracked-files=normal"],{encoding:"utf8"}).trim(),browser:browser.version()},null,2)+"\n");
  console.log("Captured D6",seed,data.frameId,data.adapter,data.width,data.height);
} finally {await browser?.close();await server.close();}
