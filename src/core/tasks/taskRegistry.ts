import type { TaskDefinition } from "../../types/task";

export const taskRegistry: Record<string, TaskDefinition> = {
  "task-rise-basics": {
    id: "task-rise-basics",
    sceneId: "architecture-rise",
    title: "Lift composition with rise",
    mode: "guided",
    movementConstraint: "rise-only",
    initialCameraState: {
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: 2000,
      aperture: 11,
      geometryView: "side",
      groundGlassAssistEnabled: false,
      focusAssistEnabled: false,
      gridEnabled: true,
    },
  },
  "task-tilt-basics": {
    id: "task-tilt-basics",
    sceneId: "table-tilt",
    title: "Align tabletop focus with tilt",
    mode: "guided",
    movementConstraint: "tilt-only",
    initialCameraState: {
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: 2000,
      aperture: 11,
      geometryView: "side",
      groundGlassAssistEnabled: false,
      focusAssistEnabled: false,
      gridEnabled: true,
    },
  },
  "task-swing-basics": {
    id: "task-swing-basics",
    sceneId: "shelf-swing",
    title: "Align diagonal focus with swing",
    mode: "guided",
    movementConstraint: "swing-only",
    initialCameraState: {
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: 2000,
      aperture: 11,
      geometryView: "top",
      groundGlassAssistEnabled: false,
      focusAssistEnabled: false,
      gridEnabled: true,
    },
  },
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];
