import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateA1IntegratedEvidence } from "../../../scripts/validate-a1-retained-evidence.mjs";

const source=resolve("docs/architecture/environment-readiness/a1-evidence/current");
const temporary:string[]=[];
const fixture=()=>{const root=mkdtempSync(join(tmpdir(),"a1-integrated-"));temporary.push(root);cpSync(source,root,{recursive:true});return root;};
const json=(root:string,name:string)=>JSON.parse(readFileSync(join(root,name),"utf8"));
const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
const update=(root:string,name:string,value:unknown,record:ReturnType<typeof json>)=>{const data=Buffer.from(JSON.stringify(value));writeFileSync(join(root,name),data);record.files[name]=digest(data);};
afterEach(()=>temporary.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));

describe("A1 integrated partial retained evidence",()=>{
  it("rederives D1–D5 and refuses to call the incomplete D6 full qualification",async()=>{
    const result=await validateA1IntegratedEvidence(source,json(source,"record-f1.json"));
    expect(result).toMatchObject({integrity:"PASS",qualification:"PARTIAL",contracts:{D1:"QUALIFIED",D2:"QUALIFIED",D3:"QUALIFIED",D4:"QUALIFIED",D5:"QUALIFIED",D6:"PARTIAL"}});
    const record=json(source,"record-f1.json");record.decision="QUALIFIED";
    await expect(validateA1IntegratedEvidence(source,record)).rejects.toThrow();
  });
  it("rejects missing, malformed and changed evidence",async()=>{
    const root=fixture(),record=json(root,"record-f1.json");rmSync(join(root,"frames.json"));await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow();
    writeFileSync(join(root,"frames.json"),"{}");await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/digest/);
    record.files["frames.json"]=digest(Buffer.from("{}"));await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow();
  });
  it("rejects substituted capture or producer identities",async()=>{
    const record=json(source,"record-f1.json");record.captureCommit="0".repeat(40);await expect(validateA1IntegratedEvidence(source,record)).rejects.toThrow(/provenance/);
    record.captureCommit="bf923e4144b1baac9a53d529fc372655f3e66280";record.sourcePins["scripts/ground-glass-a1/capture.mjs"]="0".repeat(64);await expect(validateA1IntegratedEvidence(source,record)).rejects.toThrow(/identity/);
  });
  it("rejects stale sampled pixels with otherwise current completion and a recomputed record digest",async()=>{
    const root=fixture(),record=json(root,"record-f1.json"),sessions=json(root,"frames.json");
    sessions[0]["control-next-request"].readbacks.final.sample=sessions[0]["control-previous-request"].readbacks.final.sample;
    update(root,"frames.json",sessions,record);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/pixel provenance/);
  });
  it("rejects contradictory optical summaries even with a recomputed digest",async()=>{
    const root=fixture(),record=json(root,"record-f1.json"),optical=json(root,"optical.json");
    optical.opticalMeasurements.candidate=optical.opticalMeasurements.excessiveBlur;
    update(root,"optical.json",optical,record);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/contradicts pixels/);
  });
  it("rejects the actual excessive-footprint output offered as a candidate",async()=>{
    const root=fixture(),record=json(root,"record-f1.json"),optical=json(root,"optical.json");
    for (const kind of ["output","coc"]) {
      const sourceFile=`${kind}-excessiveBlur.rgba.gz`,candidateFile=`${kind}-candidate.rgba.gz`;
      const bytes=readFileSync(join(root,"optical",sourceFile));
      writeFileSync(join(root,"optical",candidateFile),bytes);
      record.files[`optical/${candidateFile}`]=digest(bytes);
      optical.files[candidateFile]=optical.files[sourceFile];
    }
    optical.opticalMeasurements.candidate=optical.opticalMeasurements.excessiveBlur;
    update(root,"optical.json",optical,record);
    await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/optical acceptance controls/);
  });
  it("rejects wrong orientation despite matching readback hashes and current identity",async()=>{
    const root=fixture(),record=json(root,"record-f1.json"),sessions=json(root,"frames.json"),raw=sessions[0]["control-physical-orientation"],upright=sessions[0]["control-next-request"];
    raw.readbacks.final=upright.readbacks.final;raw.observation.pixelProvenance.final={...upright.observation.pixelProvenance.final,frameId:raw.observation.frameId};
    update(root,"frames.json",sessions,record);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/orientation/);
  });
  it("rejects duplicated observations and invalid typed preparation",async()=>{
    const root=fixture(),record=json(root,"record-f1.json"),sessions=json(root,"frames.json");sessions[1]=sessions[0];
    update(root,"frames.json",sessions,record);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/duplicate/);
    const fresh=json(source,"frames.json");fresh[0]["stress-1"].observation.preparation.optics.focalLengthMm=null;
    update(root,"frames.json",fresh,record);await expect(validateA1IntegratedEvidence(root,record)).rejects.toThrow(/frame contract/);
  });
});
