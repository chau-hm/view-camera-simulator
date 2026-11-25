import type { SceneCapacitySnapshot, SceneGraphCapacityMetrics } from "../../render/sceneCapacityProfiling";

type DreamLoopCaptureSnapshot = Pick<SceneCapacitySnapshot, "sceneId" | "viewportSubject">;

const isPositiveFiniteMetric = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const hasRenderableSubjectMetrics = (
  metrics: SceneGraphCapacityMetrics | null,
): metrics is SceneGraphCapacityMetrics =>
  metrics !== null &&
  isPositiveFiniteMetric(metrics.objectCount) &&
  isPositiveFiniteMetric(metrics.meshCount) &&
  isPositiveFiniteMetric(metrics.effectiveTriangleCount) &&
  isPositiveFiniteMetric(metrics.renderableMeshCount) &&
  isPositiveFiniteMetric(metrics.renderableEffectiveTriangleCount);

export const isDreamLoopSubjectCaptureReady = (
  snapshot: DreamLoopCaptureSnapshot | null,
  expectedSceneId: string,
): snapshot is DreamLoopCaptureSnapshot & { viewportSubject: SceneGraphCapacityMetrics } =>
  snapshot !== null &&
  snapshot.sceneId === expectedSceneId &&
  hasRenderableSubjectMetrics(snapshot.viewportSubject);
