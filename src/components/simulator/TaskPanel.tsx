import type { TaskDefinition } from "../../types/task";
import { UI_COPY } from "../../ui/copy";

type TaskPanelProps = {
  task: TaskDefinition | null;
};

export const TaskPanel = ({ task }: TaskPanelProps) => (
  <section aria-label={UI_COPY.simulator.taskTitle}>
    <h2>{UI_COPY.simulator.taskTitle}</h2>
    {task ? (
      <>
        <p>{task.title}</p>
        <h3>{UI_COPY.simulator.taskObjectiveLabel}</h3>
        <p>{task.constraints.notes[0]}</p>
        <h3>{UI_COPY.simulator.taskConstraintsLabel}</h3>
        <ul>
          {task.constraints.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <h3>{UI_COPY.simulator.taskAllowedControlsLabel}</h3>
        <ul>
          {task.enabledControls.map((control) => (
            <li key={control}>{control}</li>
          ))}
        </ul>
      </>
    ) : (
      <p>{UI_COPY.simulator.freePracticeMode}</p>
    )}
  </section>
);
