import type { RendererBackend } from "./rendererBackend";

export type ObserverBackendAvailability = Readonly<{
  webglAvailable: boolean;
}>;

export type ObserverBackendSelection =
  | Readonly<{ status: "selected"; backend: RendererBackend }>
  | Readonly<{
      status: "unavailable";
      backend: null;
      reason: "no-supported-backend";
    }>;

export type SelectedObserverBackend = Extract<
  ObserverBackendSelection,
  { status: "selected" }
>;

/** Pure policy: browser capability is an input, never mounted-renderer evidence. */
export const selectObserverBackend = (
  availability: ObserverBackendAvailability,
): ObserverBackendSelection =>
  availability.webglAvailable
    ? { status: "selected", backend: "webgl" }
    : {
        status: "unavailable",
        backend: null,
        reason: "no-supported-backend",
      };

export type ObserverCanvasInitialization = Readonly<{
  backend: RendererBackend;
  canvasProps: Readonly<{
    gl: Readonly<{ antialias: boolean }>;
  }>;
}>;

/** Small R3F initialization seam for the currently selected Observer backend. */
export const resolveObserverCanvasInitialization = (
  backend: SelectedObserverBackend["backend"],
  antialias: boolean,
): ObserverCanvasInitialization => {
  switch (backend) {
    case "webgl":
      return {
        backend,
        canvasProps: { gl: { antialias } },
      };
  }
};
