import { useTranslation } from "react-i18next";
import type { CameraControlTeachingDefinition } from "../../app/cameraControlTeaching";
import { lessonZeroMessageKeys } from "../../i18n/lessonZeroMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { ApertureControl } from "../controls/ApertureControl";
import { FocusControl } from "../controls/FocusControl";
import { SingleMovementControl } from "../controls/SingleMovementControl";

type AnatomyControlTeachingPanelProps = {
  definition: CameraControlTeachingDefinition;
  complete: boolean;
};

/**
 * Lesson 0's compact control surface. The controls remain the same canonical
 * controls used elsewhere; this component only scopes their presentation to
 * the active anatomy teaching step.
 */
export const AnatomyControlTeachingPanel = ({
  definition,
  complete,
}: AnatomyControlTeachingPanelProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="anatomy-control-teaching"
      aria-label={t(simulatorMessageKeys.controls.cameraControls)}
      data-teaching-control={definition.id}
    >
      <h4>{t(simulatorMessageKeys.controls.cameraControls)}</h4>
      <p className="anatomy-control-teaching__prompt">
        {t(lessonZeroMessageKeys.common.tryControl)}
      </p>

      {definition.kind === "movement" ? (
        <SingleMovementControl movement={definition.movementField} />
      ) : definition.kind === "focus" ? (
        <FocusControl focusEnabled={true} lockReason="" showTitle={false} />
      ) : (
        <ApertureControl apertureEnabled={true} lockReason="" showTitle={false} />
      )}

      <p
        className={`anatomy-control-teaching__status${complete ? " anatomy-control-teaching__status--complete" : ""}`}
        role="status"
      >
        {t(
          complete
            ? lessonZeroMessageKeys.common.controlComplete
            : lessonZeroMessageKeys.common.controlPending,
        )}
      </p>
    </section>
  );
};

export default AnatomyControlTeachingPanel;
