import { makePixelProvenance } from "./pixel-provenance.mjs";
import { instrumentRenderer, requireReviewedRenderer } from "./source-injection.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync, gzipSync } from "node:zlib";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const [sourceRoot, outputRoot, variant, mode] = process.argv.slice(2);
if (!sourceRoot || !outputRoot || variant !== "final-historical" || mode !== "matched") {
  throw new Error("Usage: node scripts/ground-glass-a1/capture.mjs <source-root> <output-root> final-historical matched");
}
const sourceBytes = await readFile(resolve(sourceRoot, "src/render/GroundGlassRTT.tsx"));
requireReviewedRenderer(sourceBytes);
const output = resolve(outputRoot, variant);
const launchArgs = ["--use-angle=metal","--enable-unsafe-swiftshader"];
const port = Number(process.env.A0_PORT ?? 4377);
const base = "http://127.0.0.1:" + port;
const tap = await readFile(new URL("./rtt-tap.txt", import.meta.url),"utf8");
const producerDigests = {};
for (const file of ["capture.mjs", "assess.mjs", "source-injection.mjs", "rtt-tap.txt", "pixel-provenance.mjs"]) {
  producerDigests[file] = createHash("sha256").update(await readFile(new URL("./" + file, import.meta.url))).digest("hex");
}
const trackedChanges = execFileSync("git", ["-C", sourceRoot, "status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" });
const server = await createServer({
  root:sourceRoot, server:{host:"127.0.0.1",port,strictPort:true,watch:null}, plugins:[{
    name:"a1-test-only-frame-observation",
    enforce:"pre",
    transform(code, id) {
      if (id !== resolve(sourceRoot,"src/render/GroundGlassRTT.tsx")) return null;
      code = instrumentRenderer(code, tap);
      return {code,map:null};
    },
  }],
});

function crc(data) {
  let value=0xffffffff;
  for(const byte of data){
    value^=byte;
    for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  }
  return (value^0xffffffff)>>>0;
}
function png(width,height,rgba){
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  const rowSize=width*4;
  const rows=Buffer.alloc((rowSize+1)*height);
  for(let y=0;y<height;y++)rgba.copy(rows,y*(rowSize+1)+1,(height-1-y)*rowSize,(height-y)*rowSize);
  function chunk(type,data){
    const tagged=Buffer.concat([Buffer.from(type),data]);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
    const check=Buffer.alloc(4);check.writeUInt32BE(crc(tagged));
    return Buffer.concat([len,tagged,check]);
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),chunk("IDAT",deflateSync(rows)),chunk("IEND",Buffer.alloc(0))]);
}
let browser;
try {
  await mkdir(output,{recursive:true});
  await server.listen();
  browser=await chromium.launch({args:launchArgs});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,locale:"en-US"});
  page.setDefaultTimeout(35_000);
  const errors=[];
  page.on("pageerror",error=>{console.error("PAGE ERROR",error.message);errors.push({type:"pageerror",message:error.message});});
  page.on("console",message=>{if(["error","warning"].includes(message.type())){console.error("BROWSER", message.type(), message.text());errors.push({type:message.type(),message:message.text()});}});
  const variantFar = mode === "extent-extended" ? 17.4 : null;
  await page.addInitScript(far=>{globalThis.__a0Far=far;},variantFar);
  const seed = process.env.A0_SEED ?? "284719";
  const url="/simulator/free/architecture-foreground?rttDiagnostics=1&dofProfiling=1" + (seed !== undefined ? "&seed="+seed+"&sv=1" : "");
  await page.goto(base+url);
  const rtt=page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const radio=name=>page.getByRole("radio",{name,exact:true});
  const bypass=page.getByLabel("Raw RTT — bypass DOF",{exact:true});
  await page.getByLabel(/Render quality/i).selectOption("standard");
  await expect(rtt).toHaveAttribute("data-frame-result-status","completed");
  const slider=name=>page.getByRole("slider",{name,exact:true});
  async function setStep(name,target){
    const entry=slider(name);
    await entry.evaluate((f,value)=>{
      if(Number(f.value)===value)return;
      const steps=(value-Number(f.min))/Number(f.step);
      if(value<Number(f.min)||value>Number(f.max)||Math.abs(steps-Math.round(steps))>1e-7)throw Error("Unreachable public setting "+value);
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;
      setter.call(f,String(value));
      f.dispatchEvent(new Event("input",{bubbles:true}));
    }, target);
    await expect(entry).toHaveValue(String(target));
  }
  async function settle(){
    await expect(rtt).toHaveAttribute("data-frame-result-status","completed");
    await expect(rtt).toHaveAttribute("data-rtt-camera-ok","true");
    await expect.poll(async()=>rtt.evaluate(el=>el.dataset.frameRequestId===el.dataset.lastCompletedRequestId),{timeout:20_000}).toBe(true);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  }
  async function probe(tag,grid=false){
    await settle();
    const ui = await rtt.evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith("data-")).map(a=>[a.name,a.value])));
    const cameraState = await page.evaluate(async()=>{
      const {useAppStore}=await import("/src/state/appStore.ts");
      return useAppStore.getState().camera;
    });
    await page.evaluate(({tag,grid})=>{globalThis.__a0Result=null;globalThis.__a0Request={tag,grid};},{tag,grid});
    await page.waitForFunction(()=>Boolean(globalThis.__a0Result),null,{timeout:35_000});
    const result=await page.evaluate(()=>{const result=globalThis.__a0Result;globalThis.__a0Request=null;return result;});
    if(result.request.requestId!==ui["data-frame-request-id"])throw Error("Tap did not match reviewed current request");
    const {raw,final,coc,depth,...data}=result;
    const sourcePixels = Buffer.from(raw, "base64");
    const finalPixels = Buffer.from(final, "base64");
    const rawSample = makePixelProvenance(sourcePixels, data.width, data.height, data.completion.frameId);
    const finalSample = makePixelProvenance(finalPixels, data.finalWidth, data.finalHeight, data.completion.frameId);
    const raw32 = rawSample.sample.toString("base64");
    const final32 = finalSample.sample.toString("base64");
    data.pixelProvenance = { raw: rawSample.evidence, final: finalSample.evidence };
    const path=name=>resolve(output,tag+"-"+name);
    for(const [label,encoded] of Object.entries({raw,final,raw32,final32})){
      if(!encoded)continue;
      const pixels=Buffer.from(encoded,"base64");
      const [width,height]=label.endsWith("32")?[32,32]:label === "final" ? [data.finalWidth,data.finalHeight] : [data.width,data.height];
      if(pixels.length!==4*width*height)throw Error("Unexpected RGBA target type for "+label);
      await writeFile(path(label+".png"),png(width,height,pixels));
      await writeFile(path(label+".rgba"),pixels);
    }
    if(depth)await writeFile(path("depth80x64.rgba"),Buffer.from(depth,"base64"));
    if(coc)await writeFile(path("coc.bin.gz"),gzipSync(Buffer.from(coc,"base64")));
    await settle();
    const acceptedUi = await rtt.evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith("data-")).map(a=>[a.name,a.value])));
    if (acceptedUi["data-frame-request-id"] !== data.request.requestId ||
        acceptedUi["data-last-completed-request-id"] !== data.request.requestId ||
        acceptedUi["data-renderer-generation"] !== data.completion.generation.generationId ||
        data.expectedSubjectGeneration !== data.subjectGeneration) {
      throw Error("Completion no longer matches the host's accepted current request and generations");
    }
    const profileText=await page.getByTestId("ground-glass-profiling-snapshot").textContent().catch(()=>null);
    await writeFile(resolve(output,tag+".json"),JSON.stringify({
      ...data,ui,acceptedUi,cameraState,url:page.url(),seed,browser:browser.version(),launchArgs,producerDigests,trackedSourceClean: !trackedChanges.trim(),source:execFileSync("git",["-C",sourceRoot,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),
      profile:profileText ? JSON.parse(profileText) : null,
    },null,2)+"\n");
    console.log(variant,tag,data.nearM,data.farM,data.diagnostics?.rawColorVariance,data.diagnostics?.finalColorVariance,data.passes.join(","));
  }
  await radio("Upright Assist").check();
  await setStep("Rise",20);
  await setStep("Tilt",6.6);
  await setStep("Focus distance",7750);
  await radio("f/11").check();
  for(let i=1;i<=1;i++)await probe("stress-"+i,process.env.A1_GRID === "1");
  if(mode.startsWith("extent")){
    await setStep("Tilt",2);
    await setStep("Focus distance",6830);
    await probe("calibrated-1",true);
    await radio("Raw Ground Glass").check();
    await probe("calibrated-flipped");
  }else if(variant==="final-historical"){
    await bypass.check();
    await probe("control-bypass");
    await bypass.uncheck();
    await setStep("Focus distance",7740);
    await probe("control-previous-request");
    await setStep("Focus distance",7750);
    await probe("control-next-request");
    await radio("Raw Ground Glass").check();
    await probe("control-physical-orientation");
  }
  await writeFile(resolve(output,"console.json"),JSON.stringify(errors,null,2)+"\n");
  if(errors.some(error=>error.type==="pageerror"||error.type==="error"))throw Error("Runtime errors: "+JSON.stringify(errors));
} finally {
  await browser?.close();
  await server.close();
}
