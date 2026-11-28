import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { validateA1IntegratedEvidence } from "../../../scripts/validate-a1-retained-evidence.mjs";
// @ts-expect-error Test-owned Node module.
import { makePixelProvenance } from "../../../scripts/ground-glass-a1/pixel-provenance.mjs";

const source=resolve("docs/architecture/environment-readiness/a1-evidence/current"), temporary:string[]=[];
const fixture=()=>{const root=mkdtempSync(join(tmpdir(),"a1-full-"));temporary.push(root);cpSync(source,root,{recursive:true});return root;};
const json=(root:string,name:string)=>JSON.parse(readFileSync(join(root,name),"utf8"));
const digest=(data:Buffer)=>createHash("sha256").update(data).digest("hex");
const pairs=(root:string)=>JSON.parse(gunzipSync(readFileSync(join(root,"d6/captures.json.gz"))).toString("utf8"));
const writePairs=(root:string,record:ReturnType<typeof json>,value:unknown)=>{const data=gzipSync(Buffer.from(JSON.stringify(value)),{level:9});writeFileSync(join(root,"d6/captures.json.gz"),data);record.files["d6/captures.json.gz"]=digest(data);};
const putBlob=(root:string,record:ReturnType<typeof json>,data:Buffer)=>{const name=`d6/blobs/${digest(data)}.bin.gz`,compressed=gzipSync(data,{level:9});writeFileSync(join(root,name),compressed);record.files[name]=digest(compressed);return name;};
afterEach(()=>temporary.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));

describe("A1 integrated complete retained evidence",()=>{
  it("derives a complete decision from real D1–D6 evidence",async()=>{
    await expect(validateA1IntegratedEvidence(source)).resolves.toMatchObject({integrity:"PASS",qualification:"QUALIFIED",contracts:{D1:"QUALIFIED",D2:"QUALIFIED",D3:"QUALIFIED",D4:"QUALIFIED",D5:"QUALIFIED",D6:"QUALIFIED"}});
  });
  it("rejects missing evidence, inconsistent status, and wrong D6 producer identity",async()=>{
    const record=json(source,"record.json");delete record.files["d6/captures.json.gz"];await expect(validateA1IntegratedEvidence(source,record)).rejects.toThrow(/missing D6/);
    const partial=json(source,"record.json");partial.contracts.D6="PARTIAL";await expect(validateA1IntegratedEvidence(source,partial)).rejects.toThrow(/decision/);
    const producer=json(source,"record.json");producer.d6SourcePins["scripts/ground-glass-a1/capture-d6.mjs"]="0".repeat(64);await expect(validateA1IntegratedEvidence(source,producer)).rejects.toThrow(/source identity/);
  });
  it("rejects altered retained data even if its outer digest is recomputed",async()=>{
    const root=fixture(),record=json(root,"record.json"),data=pairs(root);delete data[0][1].record.d6Hits;
    writePairs(root,record,data);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/first-hit/);
  });
  it("rejects mismatched optics and duplicate sessions",async()=>{
    const root=fixture(),record=json(root,"record.json"),data=pairs(root);data[0][1].record.cameraState.focusDistanceMm=9400;
    writePairs(root,record,data);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/optical state/);
    const dup=pairs(source);dup[1]=dup[0];writePairs(root,record,dup);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/duplicate D6/);
  });
  it("rejects a real varied zero-blur GPU output presented as the normal candidate",async()=>{
    const root=fixture(),record=json(root,"record.json"),optical=json(root,"optical-varied.json");
    const bytes=readFileSync(join(root,"optical-varied/output-zeroBlur.rgba.gz"));
    writeFileSync(join(root,"optical-varied/output-candidate.rgba.gz"),bytes);
    record.files["optical-varied/output-candidate.rgba.gz"]=digest(bytes);
    optical.files["output-candidate.rgba.gz"]=optical.files["output-zeroBlur.rgba.gz"];
    optical.opticalMeasurements.candidate=optical.opticalMeasurements.zeroBlur;
    const proof=Buffer.from(JSON.stringify(optical));writeFileSync(join(root,"optical-varied.json"),proof);record.files["optical-varied.json"]=digest(proof);
    await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/optical acceptance controls/);
  });
  it("rejects a stale D6 sample with otherwise current transaction identity",async()=>{
    const root=fixture(),record=json(root,"record.json"),data=pairs(root);data[0][1].readbacks.final32=data[0][0].readbacks.final32;
    writePairs(root,record,data);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/provenance/);
  });
  it("rejects detail loss even when modified pixels and sample digests are consistent",async()=>{
    const root=fixture(),record=json(root,"record.json"),data=pairs(root),entry=data[0][1];
    const final=gunzipSync(readFileSync(join(root,entry.readbacks.final)));
    for(let y=309;y<322;y++)for(let x=317;x<330;x++)for(let c=0;c<3;c++)final[4*(y*655+x)+c]=127;
    const derived=makePixelProvenance(final,655,524,entry.record.completion.frameId);
    entry.readbacks.final=putBlob(root,record,final);entry.readbacks.final32=putBlob(root,record,derived.sample);entry.record.pixelProvenance.final=derived.evidence;
    writePairs(root,record,data);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/optical response/);
  });
});
