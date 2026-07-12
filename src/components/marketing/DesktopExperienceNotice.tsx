import React from "react";
import { UI_COPY } from "../../ui/copy";
import { useSimulatorSuitability } from "../../hooks/useSimulatorSuitability";

export const DesktopExperienceNotice: React.FC = () => {
  const { shouldWarn, isNarrowViewport, viewportWidth } = useSimulatorSuitability();

  if (!shouldWarn) return null;

  return (
    <aside className="desktop-experience-notice" role="note" aria-label="Desktop browser recommendation">
      <span className="desktop-experience-notice__icon material-symbols-outlined" aria-hidden="true">
        desktop_windows
      </span>

      <div className="desktop-experience-notice__content">
        <div className="desktop-experience-notice__title">{UI_COPY.simulator.desktopExperienceTitle}</div>
        <p className="desktop-experience-notice__text">
          {UI_COPY.simulator.desktopExperienceBody}
          {isNarrowViewport && viewportWidth !== null ? (
            <><br />{UI_COPY.simulator.desktopExperienceNarrowline}</>
          ) : null}
        </p>
      </div>
    </aside>
  );
};

export default DesktopExperienceNotice;
