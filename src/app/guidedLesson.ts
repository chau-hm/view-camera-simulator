import type { SimulatorMode } from "../types/camera";
import type {
  PublicGuidedLessonTaskStageId,
  PublicSceneEntry,
} from "./publicScenes";

export const GUIDED_LESSON_QUERY_KEY = "lesson";
export const GUIDED_LESSON_QUERY_VALUE = "1";

export type GuidedLessonStageId =
  | "observe"
  | PublicGuidedLessonTaskStageId;

export type GuidedLessonStage = {
  id: GuidedLessonStageId;
  taskId?: string;
};

export type GuidedLessonContext = {
  lessonId: string;
  sceneId: string;
  stage: GuidedLessonStageId;
  stageIndex: number;
  stages: readonly GuidedLessonStage[];
  previousHref: string | null;
  nextHref: string | null;
};

export const isGuidedLessonQuery = (search: string): boolean =>
  new URLSearchParams(search).get(GUIDED_LESSON_QUERY_KEY) === GUIDED_LESSON_QUERY_VALUE;

export const getGuidedLessonStages = (
  entry: PublicSceneEntry,
): readonly GuidedLessonStage[] | null => {
  if (!entry.guidedLesson?.includeObserveStage || !entry.guidedTaskIds?.length) {
    return null;
  }

  const taskStageIds = entry.guidedLesson.taskStageIds;
  if (taskStageIds.length !== entry.guidedTaskIds.length) return null;

  const taskStages = entry.guidedTaskIds.map((taskId, index) => ({
    id: taskStageIds[index],
    taskId,
  }));

  return [
    { id: "observe" },
    ...(taskStages as GuidedLessonStage[]),
  ];
};

const getStageHref = (
  sceneId: string,
  stages: readonly GuidedLessonStage[],
  stageIndex: number,
): string | null => {
  const stage = stages[stageIndex];
  if (!stage) return null;
  if (stage.id === "observe") {
    return `/simulator/free/${sceneId}?${GUIDED_LESSON_QUERY_KEY}=${GUIDED_LESSON_QUERY_VALUE}`;
  }
  if (!stage.taskId) return null;
  return `/simulator/guided/${sceneId}/${stage.taskId}?${GUIDED_LESSON_QUERY_KEY}=${GUIDED_LESSON_QUERY_VALUE}`;
};

export const getGuidedLessonContext = ({
  entry,
  mode,
  sceneId,
  taskId,
  search,
}: {
  entry: PublicSceneEntry;
  mode: SimulatorMode;
  sceneId: string;
  taskId: string | null;
  search: string;
}): GuidedLessonContext | null => {
  if (!isGuidedLessonQuery(search) || entry.id !== sceneId) return null;

  const stages = getGuidedLessonStages(entry);
  if (!stages) return null;

  const stageIndex =
    mode === "free" && taskId === null
      ? 0
      : stages.findIndex((stage) => stage.taskId === taskId);
  if (stageIndex < 0) return null;

  return {
    lessonId: entry.guidedLesson?.id ?? entry.id,
    sceneId,
    stage: stages[stageIndex].id,
    stageIndex,
    stages,
    previousHref: getStageHref(sceneId, stages, stageIndex - 1),
    nextHref: getStageHref(sceneId, stages, stageIndex + 1),
  };
};
