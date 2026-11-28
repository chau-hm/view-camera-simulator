import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
// @ts-expect-error Test-owned Node modules do not expose browser declarations.
import { evaluateD6Pair } from "../../../scripts/ground-glass-a1/assess-d6.mjs";
// @ts-expect-error Test-owned Node modules do not expose browser declarations.
import { makePixelProvenance } from "../../../scripts/ground-glass-a1/pixel-provenance.mjs";

const root=resolve("docs/architecture/environment-readiness/a1-evidence/current");
function pair() {
  const sessions=JSON.parse(gunzipSync(readFileSync(resolve(root,"d6/captures.json.gz"))).toString("utf8"));
  return sessions[0].map((entry:{record:unknown;readbacks:Record<string,string>})=>({record:entry.record,...Object.fromEntries(Object.entries(entry.readbacks).map(([name,path])=>[name,gunzipSync(readFileSync(resolve(root,path)))]))}));
}
describe("A1 neutral application reference",()=>{
  it("accepts actual matched seed observations and rejects a captured-source detail-loss control",()=>{
    const [a,b]=pair(),result=evaluateD6Pair(a,b);
    expect(result.accepted).toBe(true);
    expect(result.baseline.mutationViolations).toBeGreaterThan(0);
    expect(result.variation.mutationViolations).toBeGreaterThan(0);
    expect(result.baseline.maxExpectedRadiusPx).toBeLessThan(.125);
  });
  it("rejects stale samples, changed optics and invalid protected geometry",()=>{
    const [a,b]=pair();b.raw32=a.raw32;expect(()=>evaluateD6Pair(a,b)).toThrow(/provenance/);
    const [c,d]=pair();d.record.cameraState.focusDistanceMm=9400;expect(()=>evaluateD6Pair(c,d)).toThrow(/optical state/);
    const [e,f]=pair();f.record.d6Hits[0].name="unrelated";expect(()=>evaluateD6Pair(e,f)).toThrow(/first hit/);
  });
  it("rejects a detail-destroying processed ROI even after recomputing its sample provenance",()=>{
    const [a,b]=pair();b.final=Buffer.from(b.final);
    for(let y=309;y<322;y++)for(let x=317;x<330;x++)for(let c=0;c<3;c++)b.final[4*(y*655+x)+c]=127;
    const derived=makePixelProvenance(b.final,655,524,b.record.completion.frameId);
    b.final32=derived.sample;b.record.pixelProvenance.final=derived.evidence;
    expect(()=>evaluateD6Pair(a,b)).toThrow(/optical response/);
  });
});
