export type RoomComparisonStateInput = Readonly<{
  camera: Record<string, unknown>;
  presetKey: string;
  subjectMode: string;
  renderQuality: string;
  rawDebug: boolean;
  previewMode: "raw" | "upright";
  hdr: boolean;
  displayExposure: number;
  reflectionsEnabled: boolean;
}>;

export type RoomComparisonSlot = "A" | "B";

export type RoomComparisonState = RoomComparisonStateInput & Readonly<{
  camera: Record<string, unknown>;
  fingerprint: string;
}>;

export type RoomComparisonIntent = Readonly<{
  slot: RoomComparisonSlot;
  state: RoomComparisonState;
  requestId: string | null;
  generationId: string | null;
}>;

export type RoomComparisonIntentGuard = Readonly<{
  slot?: RoomComparisonSlot;
  requestId?: string;
  generationId?: string;
}>;

export const roomComparisonIntentMatchesGuard = (
  intent: RoomComparisonIntent | null,
  guard: RoomComparisonIntentGuard = {},
): boolean => Boolean(intent &&
  (!guard.slot || intent.slot === guard.slot) &&
  (!guard.requestId || intent.requestId === guard.requestId) &&
  (!guard.generationId || intent.generationId === guard.generationId));

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createRoomComparisonState = (input: RoomComparisonStateInput): RoomComparisonState => {
  const state = {
    camera: cloneJson(input.camera),
    presetKey: input.presetKey,
    subjectMode: input.subjectMode,
    renderQuality: input.renderQuality,
    rawDebug: input.rawDebug,
    previewMode: input.previewMode,
    hdr: input.hdr,
    displayExposure: input.displayExposure,
    reflectionsEnabled: input.reflectionsEnabled,
  };
  return Object.freeze({ ...state, fingerprint: JSON.stringify(state) });
};

const flattenValues = (value: unknown, prefix = "", output: Record<string, unknown> = {}): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flattenValues(child, prefix ? `${prefix}.${key}` : key, output);
  } else {
    output[prefix] = value;
  }
  return output;
};

const COMPARISON_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  presetKey: "Composition",
  subjectMode: "Subject",
  renderQuality: "Render quality",
  rawDebug: "Raw RTT debug",
  previewMode: "Orientation",
  hdr: "Color path",
  displayExposure: "Display exposure",
  reflectionsEnabled: "Reflections",
  "camera.focalLengthMm": "Lens",
  "camera.focusDistanceMm": "Focus",
  "camera.aperture": "Aperture",
  "camera.frontRiseMm": "Front rise",
  "camera.frontShiftMm": "Front shift",
  "camera.frontTiltDeg": "Front tilt",
  "camera.frontSwingDeg": "Front swing",
  "camera.rearRiseMm": "Rear rise",
  "camera.rearShiftMm": "Rear shift",
  "camera.rearTiltDeg": "Rear tilt",
  "camera.rearSwingDeg": "Rear swing",
  "camera.cameraBodyPitchDeg": "Camera body pitch",
  "camera.mirrorShiftLessonState.rigLateralMm": "Camera lateral position",
});

export const listRoomComparisonStateChanges = (
  left: RoomComparisonState,
  right: RoomComparisonState,
): ReadonlyArray<Readonly<{ key: string; label: string; a: unknown; b: unknown }>> => {
  const leftValues = flattenValues({ ...left, camera: left.camera });
  const rightValues = flattenValues({ ...right, camera: right.camera });
  return Object.keys({ ...leftValues, ...rightValues })
    .filter((key) => key !== "fingerprint" && JSON.stringify(leftValues[key]) !== JSON.stringify(rightValues[key]))
    .sort()
    .map((key) => ({
      key,
      label: COMPARISON_FIELD_LABELS[key] || key,
      a: leftValues[key],
      b: rightValues[key],
    }));
};

export const createRoomComparisonIntent = (
  slot: RoomComparisonSlot,
  state: RoomComparisonState,
): RoomComparisonIntent => Object.freeze({ slot, state, requestId: null, generationId: null });

export const bindRoomComparisonIntent = (
  intent: RoomComparisonIntent,
  request: Readonly<{ requestId?: string }>,
  generation: Readonly<{ generationId?: string }>,
): RoomComparisonIntent => {
  if (!request.requestId || !generation.generationId) throw new Error("Comparison capture requires request and generation identities");
  return Object.freeze({ ...intent, requestId: request.requestId, generationId: generation.generationId });
};

type Identity = Readonly<{ requestId?: string; generationId?: string }>;
type FrameResult = Readonly<{
  status: "pending" | "completed" | "failed";
  request: Identity;
  generation: Identity;
  frameId?: string;
  requiredOperations?: string;
  failureReason?: string;
}>;

type CurrentState = Readonly<{
  request: Identity;
  generation: Identity;
  state: RoomComparisonState;
}>;

export type RoomComparisonFrameDecision =
  | Readonly<{ kind: "ignore"; reason: string }>
  | Readonly<{ kind: "reject"; reason: string }>
  | Readonly<{ kind: "capture"; reason: null; frameId: string }>;

// Production frame results keep request and renderer-generation identities in
// separate objects: `frame.request` carries requestId, while
// `frame.generation` carries generationId. Do not require either object to
// duplicate the other's identity field.
const sameRequest = (identity: Identity | undefined, pending: RoomComparisonIntent): boolean =>
  Boolean(pending.requestId && identity?.requestId === pending.requestId);

const sameGeneration = (identity: Identity | undefined, pending: RoomComparisonIntent): boolean =>
  Boolean(pending.generationId && identity?.generationId === pending.generationId);

/** Accept only a completed all-pass frame for the bound request and committed state. */
export const evaluateRoomComparisonFrame = (
  pending: RoomComparisonIntent | null,
  frame: FrameResult,
  current: CurrentState,
  published: CurrentState | null,
): RoomComparisonFrameDecision => {
  if (!pending?.requestId || !pending.generationId) return { kind: "ignore", reason: "No comparison capture is bound to this frame" };
  if (!sameRequest(frame.request, pending) || !sameGeneration(frame.generation, pending))
    return { kind: "ignore", reason: "Frame belongs to a different request or renderer generation" };
  if (frame.status === "pending") return { kind: "ignore", reason: "Frame is not complete" };
  if (frame.status === "failed") return { kind: "reject", reason: frame.failureReason || "Ground Glass frame failed" };
  if (frame.requiredOperations !== "all-completed" || !frame.frameId)
    return { kind: "reject", reason: "Ground Glass frame did not complete every required operation" };
  if (!sameRequest(current.request, pending) || !sameGeneration(current.generation, pending))
    return { kind: "reject", reason: "A newer request or renderer generation replaced the capture state" };
  if (current.state.fingerprint !== pending.state.fingerprint)
    return { kind: "reject", reason: "Camera or presentation settings changed before the frame completed" };
  if (!published || !sameRequest(published.request, pending) || !sameGeneration(published.generation, pending))
    return { kind: "ignore", reason: "The latest committed camera request is not published yet" };
  if (published.state.fingerprint !== pending.state.fingerprint)
    return { kind: "reject", reason: "Published camera or presentation settings do not match the requested capture" };
  return { kind: "capture", reason: null, frameId: frame.frameId };
};
