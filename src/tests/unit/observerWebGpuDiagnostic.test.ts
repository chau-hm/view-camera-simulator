import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getObserverWebGpuAdapterAvailability,
  probeObserverWebGpuAdapterAvailability,
} from "../../render/backend/observerWebGpuDiagnostic";

describe("Observer WebGPU adapter diagnostic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports an absent WebGPU API without attempting an adapter request", async () => {
    await expect(probeObserverWebGpuAdapterAvailability(undefined)).resolves.toBe("api-absent");
  });

  it("distinguishes an API that has no available adapter", async () => {
    const requestAdapter = vi.fn(async () => null);
    await expect(
      probeObserverWebGpuAdapterAvailability({ requestAdapter }),
    ).resolves.toBe("unavailable");
    expect(requestAdapter).toHaveBeenCalledOnce();
  });

  it("classifies a rejected adapter request separately from no adapter", async () => {
    const requestAdapter = vi.fn(async () => {
      throw new Error("adapter request rejected");
    });
    await expect(
      probeObserverWebGpuAdapterAvailability({ requestAdapter }),
    ).resolves.toBe("request-rejected");
  });

  it("classifies a synchronous adapter request error as rejected", async () => {
    const requestAdapter = vi.fn(() => {
      throw new Error("synchronous request failure");
    });
    await expect(
      probeObserverWebGpuAdapterAvailability({ requestAdapter }),
    ).resolves.toBe("request-rejected");
  });

  it("reports adapter availability without requesting or retaining a device", async () => {
    const adapter = { requestDevice: vi.fn() };
    const requestAdapter = vi.fn(async () => adapter);
    await expect(
      probeObserverWebGpuAdapterAvailability({ requestAdapter }),
    ).resolves.toBe("available");
    expect(requestAdapter).toHaveBeenCalledOnce();
    expect(adapter.requestDevice).not.toHaveBeenCalled();
  });

  it("bounds an adapter request that never settles", async () => {
    const requestAdapter = vi.fn(() => new Promise<null>(() => undefined));
    await expect(
      probeObserverWebGpuAdapterAvailability({ requestAdapter }, 1),
    ).resolves.toBe("timed-out");
  });

  it("caches the browser probe so component rerenders do not request adapters again", async () => {
    const requestAdapter = vi.fn(async () => ({}));
    vi.stubGlobal("navigator", { gpu: { requestAdapter } });

    await expect(getObserverWebGpuAdapterAvailability()).resolves.toBe("available");
    await expect(getObserverWebGpuAdapterAvailability()).resolves.toBe("available");
    expect(requestAdapter).toHaveBeenCalledOnce();
  });
});
