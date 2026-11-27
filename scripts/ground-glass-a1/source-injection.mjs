import { createHash } from "node:crypto";

export const REVIEWED_RENDERER_SHA256 = "9ef5066b6a62731884a16253572a61a884739c1ee7cdea0fbdbb723be9b510bf";

export function requireReviewedRenderer(source) {
  if (createHash("sha256").update(source).digest("hex") !== REVIEWED_RENDERER_SHA256) {
    throw new Error("GroundGlassRTT.tsx differs from the reviewed capture target; requalify the tap");
  }
}

export function injectUnique(code, slot, replacement) {
  if (code.split(slot).length !== 2) throw new Error("Expected a unique source slot: " + slot);
  return code.replace(slot, replacement);
}

export function instrumentRenderer(code, tap) {
  const inject = injectUnique;
      code = inject(code,"    const profiler = groundGlassProfilerRef.current;","    const auditRequest = globalThis.__a0Request;\n    const auditPasses = [];\n    const auditExpectedSubjectGeneration = sceneSubjectGenerationRef.current;\n    let auditSourceCpuMs = null;\n    const profiler = groundGlassProfilerRef.current;");

      code = inject(code,`    measurePass("sceneRender", () => {`,`    const auditSourceStarted = auditRequest ? performance.now() : 0;
    measurePass("sceneRender", () => {`);
      code = inject(code,"    // 2) Full-resolution signed CoC, near/far aperture gathers, then composite.",
        '    if (auditRequest) { auditPasses.push("sceneRender"); auditSourceCpuMs = performance.now() - auditSourceStarted; }\n    // 2) Full-resolution signed CoC, near/far aperture gathers, then composite.');
      for (const pass of ["cocFootprint","farGather","nearGather","composite"]) {
        const line = 'measurePass("' + pass + '", () => {';
        code=inject(code,line,line+'\n          if (auditRequest) auditPasses.push("'+pass+'");');
      }
      code = inject(code, "      displayOutputCompleted = true;", '      displayOutputCompleted = true;\n      if (auditRequest) auditPasses.push("display");');
      code = inject(code, `        onFrameResultRef.current?.({
          status: "completed",
          generation: frameGeneration,
          request: frameRequest,
          frameId: \`\${frameGeneration.generationId}:frame:\${frameSequenceRef.current}\`,
          requiredOperations: "all-completed",
        });`, `        const auditCompletion = {
          status: "completed",
          generation: frameGeneration,
          request: frameRequest,
          frameId: \`\${frameGeneration.generationId}:frame:\${frameSequenceRef.current}\`,
          requiredOperations: "all-completed",
        };
        onFrameResultRef.current?.(auditCompletion);
        if (auditRequest && globalThis.__a0Pending) {
          globalThis.__a0Result = {...globalThis.__a0Pending, completion: auditCompletion,
            frameId: auditCompletion.frameId};
          globalThis.__a0Pending = null;
        }`);
      code = inject(code,"      // Final blit always samples the owned composited target.",
        tap + "\n      // Final blit always samples the owned composited target.");
  return code;
}
