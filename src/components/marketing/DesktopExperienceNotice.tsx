import React from "react";
import { useTranslation } from "react-i18next";
import { useSimulatorSuitability } from "../../hooks/useSimulatorSuitability";

export const DesktopExperienceNotice: React.FC = () => {
  const { t } = useTranslation();
  const { shouldWarn, isNarrowViewport, viewportWidth } = useSimulatorSuitability();

  if (!shouldWarn) return null;

  return (
    <aside className="desktop-experience-notice" role="note" aria-label={t("common.site.desktopExperienceTitle")}>
      <span className="desktop-experience-notice__icon material-symbols-outlined" aria-hidden="true">
        desktop_windows
      </span>

      <div className="desktop-experience-notice__content">
        <div className="desktop-experience-notice__title">{t("common.site.desktopExperienceTitle")}</div>
        <p className="desktop-experience-notice__text">
          {t("common.site.desktopExperienceBody")}
          {isNarrowViewport && viewportWidth !== null ? (
            <><br />{t("common.site.desktopExperienceNarrowLine")}</>
          ) : null}
        </p>
      </div>
    </aside>
  );
};

export default DesktopExperienceNotice;
