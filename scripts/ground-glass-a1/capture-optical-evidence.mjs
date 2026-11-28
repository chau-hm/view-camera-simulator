import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

// Test-only observation: retain actual GPU bytes before the fixture discards them.
const [rootArg, outputArg] = process.argv.slice(2);
if (!rootArg || !outputArg) throw new Error("Usage: node capture-optical-evidence.mjs <source-root> <output-directory>");
const root = resolve(rootArg), output = resolve(outputArg);
const require = createRequire(resolve(root, "package.json"));
const { chromium } = require("@playwright/test");
const { createServer } = await import(resolve(root, "node_modules/vite/dist/node/index.js"));
const fixture = resolve(root, "src/tests/e2e/fixtures/ground-glass-dof-edge-harness.ts");
const anchor = "  return {\n    focusDistanceMm,\n    fNumber,\n    candidateEdgeRedIncrease:";
const inject = `  if (runFaultCases) {\n    const encodeA1 = data => { let s = ""; for (let i = 0; i < data.length; i += 32768) s += String.fromCharCode(...data.subarray(i, i + 32768)); return btoa(s); };\n    globalThis.__a1OpticalBytes = {source: encodeA1(sourcePixels), outputs: Object.fromEntries(variants.map(v => [v, encodeA1(outputPixels[v])])), coc: Object.fromEntries(variants.map(v => [v, encodeA1(cocPixelsByVariant[v])]))};\n  }\n`;
const server = await createServer({root,server:{host:"127.0.0.1",port:4398,strictPort:true,watch:null},plugins:[{name:"a1-optical-test-only-readback",enforce:"pre",transform(code,id){if(id!==fixture)return null;if(code.split(anchor).length!==2)throw new Error("Optical capture anchor drift");return {code:code.replace(anchor,inject+anchor),map:null};}}]});
let browser;
try {
  await mkdir(output,{recursive:true}); await server.listen(); browser=await chromium.launch();
  const page=await browser.newPage(); const errors=[];page.on("pageerror", e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:4398/src/tests/e2e/fixtures/ground-glass-dof-edge.html");
  await page.waitForFunction(()=>document.body.dataset.proofReady==="true",null,{timeout:30000});
  const result=await page.evaluate(()=>({proof:globalThis.__groundGlassDofEdgeProof,bytes:globalThis.__a1OpticalBytes}));
  if(errors.length || !result.bytes || result.proof?.backend!=="webgl2") throw new Error("Invalid optical fixture capture: "+errors.join(","));
  const digest = x=>createHash("sha256").update(x).digest("hex");
  const files={};
  for(const [name,encoded] of Object.entries({source:result.bytes.source,...Object.fromEntries(Object.entries(result.bytes.outputs).map(([k,v])=>["output-"+k,v])),...Object.fromEntries(Object.entries(result.bytes.coc).map(([k,v])=>["coc-"+k,v]))})){
    const bytes=Buffer.from(encoded,"base64");if(bytes.length!==512*384*4)throw new Error("Invalid GPU buffer: "+name);
    const compressed=gzipSync(bytes,{level:9,mtime:0});const file=name+".rgba.gz";await writeFile(resolve(output,file),compressed);files[file]={bytesSha256:digest(bytes),gzipSha256:digest(compressed)};
  }
  const captureCommit=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const trackedRelevantChanges=execFileSync("git",["-C",root,"status","--porcelain","--untracked-files=no","--","src/tests/e2e/fixtures/ground-glass-dof-edge-harness.ts","src/render/groundGlassDofShaderSources.ts","src/render/groundGlassDofShaders.ts","src/render/groundGlassShaderBindings.ts"],{encoding:"utf8"}).trim();
  if(trackedRelevantChanges)throw new Error("Optical fixture source changed during capture");
  const proof={...result.proof,files,captureCommit,trackedRelevantSourceClean:true,fixtureSha256:digest(await readFile(fixture)),producerSha256:digest(await readFile(new URL(import.meta.url)))};
  await writeFile(resolve(output,"optical.json"),JSON.stringify(proof,null,2)+"\n");
  console.log("Captured real GPU fixture:",proof.backend,proof.renderer,Object.keys(files).length,"readbacks");
} finally {await browser?.close();await server.close();}
