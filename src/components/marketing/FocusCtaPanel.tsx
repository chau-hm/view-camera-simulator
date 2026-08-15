import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const FocusCtaPanel = () => {
  const { t } = useTranslation();

  return (
    <section className="focus-cta" aria-labelledby="focus-cta-heading">
      <div className="focus-cta__content">
        <div className="eyebrow">{t("home.focusCta.eyebrow")}</div>
        <h2 id="focus-cta-heading">{t("home.focusCta.title")}</h2>
        <p>{t("home.focusCta.body")}</p>
        <div className="focus-cta__actions">
          <Link className="btn btn--primary" to="/simulator/free/focus-fundamentals-two-targets">
            {t("home.focusCta.action")}
          </Link>
        </div>
      </div>

      <div className="focus-cta__art" aria-hidden="true">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
          <defs>
            <radialGradient id="fg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#efeaff" stopOpacity="0.7" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#fg)" />
          <g transform="translate(50,50)" fill="none" stroke="#cfc8ff" strokeWidth="2">
            <circle r="34" />
            <circle r="22" />
            <circle r="10" />
          </g>
        </svg>
      </div>
    </section>
  );
};

export default FocusCtaPanel;
