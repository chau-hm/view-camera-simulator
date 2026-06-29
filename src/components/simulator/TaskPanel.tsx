import type { TaskDefinition } from "../../types/task";
import { UI_COPY } from "../../ui/copy";

type TaskPanelProps = {
  task: TaskDefinition | null;
};

export const TaskPanel = ({ task }: TaskPanelProps) => (
  <section>
    <h2>{UI_COPY.simulator.taskTitle}</h2>
    {task ? (
      <>
        <p>{task.title}</p>
        <p>{task.constraints.notes[0]}</p>
      </>
    ) : (
      <p>{UI_COPY.simulator.freePracticeMode}</p>
    )}
  </section>
);
