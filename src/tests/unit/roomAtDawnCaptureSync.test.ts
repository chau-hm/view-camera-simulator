import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { inspect } = createRequire(import.meta.url)(
  "../../../experiments/room-at-dawn/capture-sync.cjs",
);
const request = { requestId: "request-1", channelId: "default", sceneId: "architecture-rise" };
const generation = { generationId: "generation-1", channelId: "default" };
const ready = () => ({
  ready: true,
  error: "",
  camera: { frontRiseMm: 0 },
  request,
  generation,
  subjectIdentity: "room-at-dawn:wide",
  frame: {
    status: "completed",
    generation,
    request,
    frameId: "frame-1",
    requiredOperations: "all-completed",
  },
  observation: {
    scope: "request",
    generation,
    requestIdentity: request,
    info: {
      renderSanityStateKey: "state-1",
      renderSanitySubjectIdentity: "room-at-dawn:wide",
      cameraConfigurationOk: true,
    },
  },
});

describe("room evidence frame synchronization", () => {
  it("accepts a completed frame and observation for the requested state", () => {
    expect(inspect(ready(), { "camera.frontRiseMm": 0 }).status).toBe("ready");
  });
  it("rejects an older frame or diagnostic attributed to a different request", () => {
    const stale = ready();
    stale.frame = { ...stale.frame, request: { ...request, requestId: "old" } };
    expect(inspect(stale, {}).status).toBe("waiting");
    const staleObservation = ready();
    staleObservation.observation = {
      ...staleObservation.observation,
      requestIdentity: { ...request, requestId: "old" },
    };
    expect(inspect(staleObservation, {}).status).toBe("waiting");
  });
  it("does not accept a previous preset or incomplete frame", () => {
    const wrongSubject = ready();
    wrongSubject.observation.info.renderSanitySubjectIdentity = "room-at-dawn:desk";
    expect(inspect(wrongSubject, {}).status).toBe("waiting");
    const pending = ready();
    pending.frame = { ...pending.frame, status: "pending" };
    expect(inspect(pending, {}).status).toBe("waiting");
  });
  it("reports renderer and frame failures instead of accepting a dark fallback", () => {
    expect(inspect({ ...ready(), renderError: "unsupported framebuffer" }, {}).status).toBe(
      "failed",
    );
    const failed = ready();
    failed.frame = {
      ...failed.frame,
      status: "failed",
      failureReason: "shader failure",
    } as typeof failed.frame;
    expect(inspect(failed, {}).status).toBe("failed");
  });
});
