import type { TaskDefinition } from "../../types/task";

export const taskRegistry: Record<string, TaskDefinition> = {
  "task-rise-basics": {
    id: "task-rise-basics",
    sceneId: "architecture-rise",
    title: "Lift composition with rise",
    mode: "guided",
    movementConstraint: "rise-only",
  },
  "task-tilt-basics": {
    id: "task-tilt-basics",
    sceneId: "table-tilt",
    title: "Align tabletop focus with tilt",
    mode: "guided",
    movementConstraint: "tilt-only",
  },
  "task-swing-basics": {
    id: "task-swing-basics",
    sceneId: "shelf-swing",
    title: "Align diagonal focus with swing",
    mode: "guided",
    movementConstraint: "swing-only",
  },
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];
