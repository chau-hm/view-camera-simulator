/* Shared by the browser capture harness and unit tests. */
(function install(root) {
  function inspectObserver(optics, observer) {
    if (!optics || !observer)
      return { status: "waiting", reason: "Observer or request unavailable" };
    const expected = optics.observerRequest;
    if (!expected || !expected.requestId)
      return { status: "waiting", reason: "Observer request unavailable" };
    if (observer.status === "failed" && !observer.requestId)
      return { status: "failed", reason: observer.error || "Observer render failed" };
    if (observer.requestId !== expected.requestId)
      return { status: "waiting", reason: "Observer frame belongs to a prior request" };
    if (observer.status === "failed")
      return { status: "failed", reason: observer.error || "Observer render failed" };
    if (observer.status !== "completed" || !observer.generationId || !observer.frameId)
      return { status: "waiting", reason: "Observer frame has not completed" };
    if (
      observer.presetKey !== expected.presetKey ||
      observer.displayExposure !== expected.displayExposure ||
      observer.hdrDiagnostic !== expected.hdr ||
      observer.reflectionsEnabled !== expected.reflectionsEnabled
    )
      return { status: "waiting", reason: "Observer settings do not match the requested state" };
    if (
      observer.toneMapping !== 2 ||
      observer.toneMappingExposure !== expected.displayExposure ||
      observer.outputColorSpace !== "srgb"
    )
      return {
        status: "failed",
        reason:
          "Observer renderer display configuration does not match requested exposure or sRGB output",
      };
    if (expected.lensCenterWorld) {
      const position = observer.cameraPosition;
      const lens = expected.lensCenterWorld;
      if (
        !Array.isArray(position) ||
        [lens.x, lens.y, lens.z].some((v, i) => Math.abs(position[i] - v * 0.001) > 1e-8)
      )
        return {
          status: "failed",
          reason: "Observer camera does not match the canonical lens position",
        };
    }
    if (observer.environmentInstalled !== expected.reflectionsEnabled)
      return {
        status: "failed",
        reason: "Observer reflection environment does not match requested state",
      };
    return {
      status: "ready",
      requestId: observer.requestId,
      generationId: observer.generationId,
      frameId: observer.frameId,
    };
  }
  root.__roomInspectObserver = inspectObserver;
  if (typeof module !== "undefined" && module.exports) module.exports = { inspectObserver };
})(globalThis);
