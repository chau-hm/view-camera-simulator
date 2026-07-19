import type { TaskDefinition } from "../types/task";

export const DEFAULT_SHOW_OPTICAL_GEOMETRY = true;

export const resolveInitialOpticalGeometryVisibility = (
  task?: Pick<TaskDefinition, "initialViewState">,
): boolean => task?.initialViewState?.showOpticalGeometry ?? DEFAULT_SHOW_OPTICAL_GEOMETRY;

