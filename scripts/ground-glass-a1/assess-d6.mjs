import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import { evaluatePixelProvenance } from "./pixel-provenance.mjs";
import { evaluateGroundGlassA1Frame } from "../../src/tests/e2e/helpers/groundGlassA1Frame.ts";

const fail = message => { throw new Error(message); };
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const imageDistance = d => 150*d/(d-150);
const coc = d => 150/11*(imageDistance(9500)/imageDistance(d)-1);
const luma = (data,i) => .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
const sd = values => { const mean=values.reduce((a,b)=>a+b,0)/values.length;return Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length); };
const allowedRoi=new Set(["architecture-foreground-building","architecture-foreground-front-window-stone","architecture-foreground-front-window-edges"]);

export function loadD6Capture(root) {
  const read=name=>readFileSync(resolve(root,name));
  const record=JSON.parse(read("record.json").toString("utf8"));
  const bytes={};for(const name of ["raw","final","raw32","final32","coc","depth"])bytes[name]=gunzipSync(read(name+".bin.gz"));
  return {record,...bytes};
}

export function evaluateD6Capture(capture) {
  const o=capture.record, c=o?.completion, p=o?.preparation, ui=o?.acceptedUi, d=o?.diagnostics;
  if(!o || !c || !p || !ui || !d || o.sceneId === "invalid" || o.request?.sceneId!=="architecture-foreground" || !["284719","1"].includes(o.seed) || o.variationIdentity?.sceneId!=="architecture-foreground" || String(o.variationIdentity?.seed)!==o.seed || o.variationIdentity?.schemaVersion!==1 || c.status!=="completed" || ui["data-frame-request-id"]!==o.request.requestId || ui["data-last-completed-request-id"]!==o.request.requestId || ui["data-renderer-generation"]!==c.generation?.generationId || o.expectedSubjectGeneration!==o.subjectGeneration || o.trackedSourceClean!==true || !o.adapter) fail("invalid current application identity");
  if(o.width!==655 || o.height!==524 || o.finalWidth!==655 || o.finalHeight!==524 || o.previewMode!=="upright" || o.rawDebug!==false || o.renderQuality!=="standard" || !same(o.displayTransform,{flipDisplayX:false,flipDisplayY:false}) || ui["data-policy-selected-backend"]!=="webgl" || o.cocPixelType!=="Uint16Array" || o.cocWidth!==655 || o.cocHeight!==524 || d.gatherScale!==1 || d.sampleCount!==32 || d.maximumCoCRadiusPx!==48 || !d.depthTextureAvailable) fail("invalid application rendering contract");
  const camera=o.cameraState;
  if(!camera || camera.activeSceneId!=="architecture-foreground" || camera.focalLengthMm!==150 || camera.aperture!==11 || camera.focusDistanceMm!==9500 || [camera.frontRiseMm,camera.frontShiftMm,camera.frontTiltDeg,camera.frontSwingDeg,camera.rearRiseMm,camera.rearShiftMm,camera.rearTiltDeg,camera.rearSwingDeg,camera.cameraBodyPitchDeg].some(v=>v!==0) || !camera.groundGlassAssistEnabled) fail("invalid D6 optical state");
  if(p.film?.widthMm!==127 || p.film?.heightMm!==101.6 || p.render?.widthPx!==655 || p.render?.heightPx!==524 || Math.abs(p.optics?.imageDistanceMm-imageDistance(9500))>1e-6) fail("invalid film or focus geometry");
  for(const target of ["raw","final"])if(o.pixelProvenance?.[target]?.sourceWidth!==655 || o.pixelProvenance?.[target]?.sourceHeight!==524 || evaluatePixelProvenance(capture[target],capture[target+"32"],o.pixelProvenance?.[target],c.frameId).length)fail("D6 pixel provenance mismatch");
  for(const target of ["coc","depth"])if(createHash("sha256").update(capture[target]).digest("hex")!==o.auxiliaryDigests?.[target])fail("D6 auxiliary readback mismatch");
  const frame={request:{...o.request,rendererGeneration:ui["data-renderer-generation"],subjectGeneration:o.expectedSubjectGeneration},completed:{...c.request,rendererGeneration:c.generation.generationId,subjectGeneration:o.subjectGeneration,frameId:c.frameId,requiredOperations:c.requiredOperations},capture:{requestId:o.request.requestId,rendererGeneration:c.generation.generationId,subjectGeneration:o.subjectGeneration,frameId:c.frameId,width:32,height:32,format:"rgba8",pixels:capture.final32},preparation:{requestId:o.request.requestId,rendererGeneration:c.generation.generationId,subjectGeneration:o.subjectGeneration,frameId:c.frameId,focalLengthMm:p.optics.focalLengthMm,apertureFNumber:p.optics.apertureFNumber,imageDistanceMm:p.optics.imageDistanceMm,filmWidthMm:p.film.widthMm,filmHeightMm:p.film.heightMm,renderWidthPx:p.render.widthPx,renderHeightPx:p.render.heightPx},executedPasses:o.passes};
  if(evaluateGroundGlassA1Frame(frame,"processed").length)fail("invalid D6 frame or execution");
  if(!Array.isArray(o.d6Hits) || o.d6Hits.length!==169 || !Array.isArray(o.d6Halo) || o.d6Halo.length!==109*109 || capture.coc.length!==655*524*8)fail("missing protected first-hit or CoC evidence");
  const roleMaterial={"architecture-foreground-building":"architecture-foreground-plaster","architecture-foreground-front-window-stone":"architecture-foreground-limestone-trim","architecture-foreground-front-window-edges":"architecture-foreground-limestone-edges"};
  for(let i=0;i<169;i++){const hit=o.d6Hits[i],x=317+i%13,y=309+Math.floor(i/13);if(hit?.x!==x||hit?.y!==y||!allowedRoi.has(hit.name)||hit.material?.name!==roleMaterial[hit.name]||hit.material?.type!=="MeshStandardMaterial"||!/^[a-f0-9]{6}$/.test(hit.material?.color??"")||!Number.isFinite(hit.material?.roughness)||!Number.isFinite(hit.depthM)||hit.depthM<9.4||hit.depthM>9.7)fail("invalid protected ROI first hit");}
  const near=o.nearM,far=o.farM;if(!(near>0 && far>9.7))fail("invalid clip range");
  const depthCode=d=>far/(far-near)-far*near/((far-near)*d);
  const depthAt=z=>far*near/(far-z*(far-near));
  let maxExpectedRadius=0,maxObservedRadius=0,maxCocError=0;
  for(let y=261;y<370;y++)for(let x=269;x<378;x++){
    const hit=o.d6Halo[(y-261)*109+x-269];if(!hit || !Number.isFinite(hit[0]) || hit[0]<9.4 || hit[0]>9.7 || typeof hit[1]!=="string")fail("unbounded halo visibility");
    const depth=hit[0],z=depthCode(depth),half=0.5/65535,low=depthAt(z-half),high=depthAt(z+half);
    const expected=coc(depth*1000),bound=Math.max(Math.abs(coc(low*1000)-expected),Math.abs(coc(high*1000)-expected));
    const index=8*(y*655+x),actual=THREE.DataUtils.fromHalfFloat(capture.coc.readUInt16LE(index)),major=THREE.DataUtils.fromHalfFloat(capture.coc.readUInt16LE(index+2)),minor=THREE.DataUtils.fromHalfFloat(capture.coc.readUInt16LE(index+4));
    const error=Math.abs(actual-expected),tolerance=bound+Math.max(Math.abs(expected)*2**-10,2**-24)+1e-6;
    if(![actual,major,minor].every(Number.isFinite)||major<0||minor<0||error>tolerance)fail("halo CoC inconsistent with independent thin-lens bound");
    maxCocError=Math.max(maxCocError,error);maxExpectedRadius=Math.max(maxExpectedRadius,(Math.abs(expected)+bound)*.5*655/127);maxObservedRadius=Math.max(maxObservedRadius,major*655/127,minor*655/127);
  }
  if(maxExpectedRadius>=.125 || maxObservedRadius>=.125)fail("halo footprint is not subpixel");
  const v=imageDistance(9500),globalGain=(150/v)**2;
  if(Math.abs(d.groundGlassIlluminanceGain-globalGain)>1e-8 || d.groundGlassNaturalIlluminationKind!=="parallel-cos4" || d.groundGlassCoverageKind!=="parallel-circle" || d.groundGlassCoverageRadiusMm<100)fail("invalid illumination or coverage evidence");
  const sourceL=[],normalizedL=[];let maxResidual=0,mutationViolations=0,minGain=Infinity;
  for(let y=309;y<322;y++)for(let x=317;x<330;x++){
    const fx=((x+.5)/655-.5)*127,fy=(.5-(y+.5)/524)*101.6;
    if(Math.hypot(fx,fy)>=d.groundGlassCoverageRadiusMm-1)fail("ROI crosses image-circle boundary");
    const gain=globalGain*(v*v/(v*v+fx*fx+fy*fy))**2;minGain=Math.min(minGain,gain);const i=4*(y*655+x);
    if(capture.raw[i+3]!==255 || capture.final[i+3]!==255)fail("transparent D6 ROI");
    for(let channel=0;channel<3;channel++){
      const residual=Math.abs(capture.final[i+channel]-capture.raw[i+channel]*gain);maxResidual=Math.max(maxResidual,residual);
      let blurred=0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++)blurred+=capture.raw[4*((y+dy)*655+x+dx)+channel];
      if(Math.abs(blurred/121*gain-capture.raw[i+channel]*gain)>2)mutationViolations++;
    }
    sourceL.push(luma(capture.raw,i));normalizedL.push(luma(capture.final,i)/gain);
  }
  const sourceContrast=sd(sourceL),normalizedContrast=sd(normalizedL);
  if(sourceContrast<=4 || maxResidual>2 || !mutationViolations || Math.abs(normalizedContrast-sourceContrast)>2/minGain)fail("protected optical response or sensitivity failed");
  return {seed:o.seed,frameId:c.frameId,rendererGeneration:c.generation.generationId,sourceSha256:o.pixelProvenance.raw.sourceSha256,sourceContrast,normalizedContrast,normalizedRatio:normalizedContrast/sourceContrast,maxResidual,mutationViolations,maxExpectedRadiusPx:maxExpectedRadius,maxObservedRadiusPx:maxObservedRadius,maxCocErrorMm:maxCocError,rawVariance:d.rawColorVariance,finalVariance:d.finalColorVariance};
}

export function evaluateD6Pair(first,second) {
  const a=evaluateD6Capture(first),b=evaluateD6Capture(second),x=first.record,y=second.record;
  if(a.seed!=="284719" || b.seed!=="1" || a.sourceSha256===b.sourceSha256 || a.frameId===b.frameId || x.source!==y.source || x.adapter!==y.adapter || x.nearM!==y.nearM || x.farM!==y.farM || !same(x.projection,y.projection) || !same(x.cameraState,y.cameraState) || !same(x.d6Hits.map(h=>[h.x,h.y,h.name,h.depthM]),y.d6Hits.map(h=>[h.x,h.y,h.name,h.depthM])) || !same(x.d6Halo,y.d6Halo))fail("D6 variants do not share protected geometry and optical state");
  return {accepted:true,baseline:a,variation:b,evidenceType:"actual-application-with-comparator-mutation"};
}

if(process.argv[2] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(!process.argv[3])throw Error("Usage: assess-d6.mjs <baseline-directory> <variation-directory>");
  console.log(JSON.stringify(evaluateD6Pair(loadD6Capture(process.argv[2]),loadD6Capture(process.argv[3])),null,2));
}
