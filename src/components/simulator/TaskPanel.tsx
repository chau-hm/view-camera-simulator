import type { TaskDefinition } from "../../types/task";

type TaskPanelProps = {
  task: TaskDefinition | null;
};

export const TaskPanel = ({ task }: TaskPanelProps) => (
  <section>
    <h2>Task</h2>
    {task ? <p>{task.title}</p> : <p>Free practice mode</p>}
  </section>
);
