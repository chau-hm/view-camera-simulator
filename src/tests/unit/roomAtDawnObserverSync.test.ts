import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const { inspectObserver } = createRequire(import.meta.url)(
  "../../../experiments/room-at-dawn/observer-sync.cjs",
);
const request = {
  requestId: "r1",
  presetKey: "wide",
  hdr: true,
  displayExposure: 19,
  reflectionsEnabled: true,
};
const observer = {
  requestId: "r1",
  generationId: "g1",
  frameId: "g1:1",
  status: "completed",
  presetKey: "wide",
  hdrDiagnostic: true,
  displayExposure: 19,
  reflectionsEnabled: true,
  toneMapping: 2,
  toneMappingExposure: 19,
  outputColorSpace: "srgb",
  environmentInstalled: true,
};
describe("Observer frame evidence", () => {
  it("accepts only a completed frame for the current configuration", () => {
    expect(inspectObserver({ observerRequest: request }, observer).status).toBe("ready");
    expect(
      inspectObserver({ observerRequest: { ...request, requestId: "r2" } }, observer).status,
    ).toBe("waiting");
    expect(
      inspectObserver({ observerRequest: request }, { ...observer, presetKey: "desk" }).status,
    ).toBe("waiting");
  });
  it("reports failed reflection and incorrect renderer state", () => {
    expect(
      inspectObserver(
        { observerRequest: request },
        { ...observer, status: "failed", error: "probe" },
      ).status,
    ).toBe("failed");
    expect(
      inspectObserver({ observerRequest: request }, { ...observer, toneMappingExposure: 1 }).status,
    ).toBe("failed");
    expect(
      inspectObserver({ observerRequest: request }, { ...observer, environmentInstalled: false })
        .status,
    ).toBe("failed");
  });
});
