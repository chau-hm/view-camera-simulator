import { useAppStore } from "../../state/appStore";
import type { SubjectCount } from "../../scenes/understandingCameraMovementsGeometry";

const SUBJECT_COUNTS: readonly SubjectCount[] = [1, 2, 3];

/** Compact, native keyboard-accessible subject presentation selector. */
export const SubjectCountControl = () => {
  const subjectCount = useAppStore((state) => state.scene.subjectCount);
  const setSubjectCount = useAppStore((state) => state.setSubjectCount);

  return (
    <fieldset className="subject-count-control">
      <legend className="sim-section-label">Subjects</legend>
      <div className="choice-list choice-list--inline" role="radiogroup" aria-label="Subjects">
        {SUBJECT_COUNTS.map((count) => (
          <label key={count} className="choice-item">
            <input
              type="radio"
              name="subject-count"
              value={count}
              checked={subjectCount === count}
              onChange={() => setSubjectCount(count)}
              aria-label={`${count} subject${count === 1 ? "" : "s"}`}
            />
            <span>{count}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
