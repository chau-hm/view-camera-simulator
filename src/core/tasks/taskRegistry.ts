import type { TaskDefinition } from "../../types/task";

export const taskRegistry: Record<string, TaskDefinition> = {
  "task-rise-basics": {
    id: "task-rise-basics",
    sceneId: "architecture-rise",
    title: "Lift composition with rise",
    mode: "guided",
    enabledControls: ["rise", "focusDistance", "aperture", "geometryView"],
    constraints: {
      movement: "rise-only",
      notes: ["Use rise without tilt or swing to frame the building top."],
    },
    criteria: [
      { id: "focus-main", label: "Primary focus target is sharp", target: "focus", threshold: 0.85 },
      { id: "composition-cover", label: "Composition targets are covered", target: "composition", threshold: 0.85 },
    ],
    feedbackRules: {
      passPrimary: "Good work. You matched the task constraints.",
      failPrimary: "Adjust movement and focus to align the focus plane with subject geometry.",
      failSecondary: ["Try increasing rise while keeping tilt and swing at 0°."],
    },
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
    enabledControls: ["tilt", "focusDistance", "aperture", "geometryView"],
    constraints: {
      movement: "tilt-only",
      notes: ["Use front tilt to align the focus plane with the table surface."],
    },
    criteria: [
      { id: "focus-main", label: "Primary focus target is sharp", target: "focus", threshold: 0.85 },
      { id: "composition-cover", label: "Composition targets are covered", target: "composition", threshold: 0.85 },
    ],
    feedbackRules: {
      passPrimary: "Good work. You matched the task constraints.",
      failPrimary: "Adjust movement and focus to align the focus plane with subject geometry.",
      failSecondary: ["Increase tilt gradually and re-check both near and far table subjects."],
    },
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
    enabledControls: ["swing", "focusDistance", "aperture", "geometryView"],
    constraints: {
      movement: "swing-only",
      notes: ["Use front swing to align focus along the diagonal shelf."],
    },
    criteria: [
      { id: "focus-main", label: "Primary focus target is sharp", target: "focus", threshold: 0.85 },
      { id: "composition-cover", label: "Composition targets are covered", target: "composition", threshold: 0.85 },
    ],
    feedbackRules: {
      passPrimary: "Good work. You matched the task constraints.",
      failPrimary: "Adjust movement and focus to align the focus plane with subject geometry.",
      failSecondary: ["Adjust swing direction until both shelf targets hold acceptable sharpness."],
    },
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
