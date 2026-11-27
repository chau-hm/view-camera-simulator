/**
 * Test-side comparison of an observed frame transaction. Producers must gather
 * these fields from the renderer and its completion callback for the same
 * transaction; this function does not observe execution itself.
 */
export interface GroundGlassA1FrameEvidence {
  request: { requestId: string; sceneId: string; channelId: string };
  completed: {
    requestId: string;
    sceneId: string;
    channelId: string;
    rendererGeneration: string;
    subjectGeneration: number;
    frameId: string;
    requiredOperations: string;
  } | null;
  capture: {
    requestId: string;
    rendererGeneration: string;
    subjectGeneration: number;
    frameId: string;
    width: number;
    height: number;
    format: string;
    pixels: Uint8Array;
  };
  preparation: { requestId: string; values: readonly number[] } | null;
  executedPasses: readonly string[];
}

export function evaluateGroundGlassA1Frame(
  evidence: GroundGlassA1FrameEvidence,
  mode: "processed" | "bypass",
): string[] {
  const issues: string[] = [];
  const { request, completed, capture, preparation } = evidence;

  if (
    !request.requestId || !request.sceneId || !request.channelId || !completed ||
    completed.requestId !== request.requestId ||
    completed.sceneId !== request.sceneId ||
    completed.channelId !== request.channelId ||
    !completed.frameId || !completed.rendererGeneration ||
    completed.requiredOperations !== "all-completed" ||
    !Number.isInteger(completed.subjectGeneration) || completed.subjectGeneration < 1
  ) {
    issues.push("incomplete-current-frame");
  }
  if (
    !completed ||
    capture.requestId !== completed.requestId ||
    capture.rendererGeneration !== completed.rendererGeneration ||
    capture.subjectGeneration !== completed.subjectGeneration ||
    capture.frameId !== completed.frameId
  ) {
    issues.push("capture-transaction-mismatch");
  }
  if (
    !preparation || preparation.requestId !== request.requestId ||
    preparation.values.length === 0 || !preparation.values.every(Number.isFinite)
  ) {
    issues.push("invalid-current-preparation");
  }

  const { width, height, format, pixels } = capture;
  if (
    !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width < 1 || height < 1 || format !== "rgba8" ||
    pixels.length !== width * height * 4
  ) {
    issues.push("invalid-buffer");
  } else {
    // Occupancy here requires a spatially nonuniform RGB image. A uniform
    // expected-content fixture is rejected regardless of its alpha channel.
    let nonuniform = false;
    for (let i = 4; i < pixels.length; i += 4) {
      if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) {
        nonuniform = true;
        break;
      }
    }
    if (!nonuniform) issues.push("uniform-buffer");
  }

  const expected = mode === "processed"
    ? ["sceneRender", "cocFootprint", "farGather", "nearGather", "composite", "display"]
    : ["sceneRender", "composite", "display"];
  if (
    evidence.executedPasses.length !== expected.length ||
    expected.some((pass, index) => evidence.executedPasses[index] !== pass)
  ) {
    issues.push("unexpected-pass-execution");
  }
  return issues;
}
