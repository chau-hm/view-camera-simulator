export type TaskDefinition = {
  id: string;
  sceneId: string;
  title: string;
  mode: "guided" | "free";
  movementConstraint?: "rise-only" | "tilt-only" | "swing-only";
};

export type TaskEvaluation = {
  taskId: string;
  passed: boolean;
  score: number;
  feedback: string[];
};
