/* This file is loaded both as a Node module and as a Playwright init script. */
(function install(root) {
  function identityMatches(a, b, fields) {
    return (
      !!a &&
      !!b &&
      fields.every(
        (field) => a[field] === b[field] && typeof a[field] === "string" && a[field].length > 0,
      )
    );
  }
  function atPath(object, path) {
    return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), object);
  }
  /** Strictly match a committed input, an actual completed frame and same-request render sanity observation. */
  function inspect(state, expected) {
    if (!state) return { status: "waiting", reason: "experiment state is unavailable" };
    if (state.error) return { status: "failed", reason: `scene initialization: ${state.error}` };
    if (state.renderError)
      return { status: "failed", reason: `renderer initialization: ${state.renderError}` };
    if (!state.ready) return { status: "waiting", reason: "scene resources are not ready" };
    for (const [path, value] of Object.entries(expected)) {
      if (atPath(state, path) !== value)
        return {
          status: "waiting",
          reason: `input ${path} is ${JSON.stringify(atPath(state, path))}; expected ${JSON.stringify(value)}`,
        };
    }
    const { request, generation, frame, observation } = state;
    const requestFields = ["requestId", "channelId", "sceneId"];
    const generationFields = ["generationId", "channelId"];
    if (
      !identityMatches(request, request, requestFields) ||
      !identityMatches(generation, generation, generationFields) ||
      request.channelId !== generation.channelId
    )
      return {
        status: "waiting",
        reason: "request or renderer generation identity is unavailable",
      };
    if (
      !frame ||
      !identityMatches(frame.request, request, requestFields) ||
      !identityMatches(frame.generation, generation, generationFields)
    )
      return {
        status: "waiting",
        reason: "no frame for the current request and renderer generation",
      };
    if (frame.status === "failed")
      return {
        status: "failed",
        reason: `frame ${frame.failedStage ?? "unknown stage"}: ${frame.failureReason}`,
      };
    if (
      frame.status !== "completed" ||
      frame.requiredOperations !== "all-completed" ||
      !frame.frameId
    )
      return {
        status: "waiting",
        reason: "current frame has not completed every required operation",
      };
    if (
      !observation ||
      observation.scope !== "request" ||
      !identityMatches(observation.requestIdentity, request, requestFields) ||
      !identityMatches(observation.generation, generation, generationFields)
    )
      return {
        status: "waiting",
        reason: "no diagnostics for the current request and renderer generation",
      };
    const info = observation.info;
    if (
      !info ||
      !info.renderSanityStateKey ||
      !state.subjectIdentity ||
      info.renderSanitySubjectIdentity !== state.subjectIdentity
    )
      return { status: "waiting", reason: "current request has no room render-sanity sample" };
    if (info.renderSanityError || info.frameExecutionError || info.cameraConfigurationOk === false)
      return {
        status: "failed",
        reason:
          info.renderSanityError ||
          info.frameExecutionError ||
          info.cameraConfigurationError ||
          "camera configuration failed",
      };
    return {
      status: "ready",
      frameId: frame.frameId,
      requestId: request.requestId,
      generationId: generation.generationId,
    };
  }
  root.__roomInspectCapture = inspect;
  if (typeof module !== "undefined" && module.exports) module.exports = { inspect };
})(globalThis);
