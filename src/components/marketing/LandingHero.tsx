import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ViewCameraHeroIllustration } from "./ViewCameraHeroIllustration";

export const LandingHero = () => {
  const { t } = useTranslation();

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <ViewCameraHeroIllustration />

      <div className="landing-hero__content">
        <p className="landing-hero__eyebrow">{t("home.hero.eyebrow")}</p>
        <h1 id="landing-hero-title" className="landing-hero__title">
          <span className="landing-hero__title-line">{t("home.hero.titleLine1")}</span>
          {" "}
          <span className="landing-hero__title-line">{t("home.hero.titleLine2")}</span>
        </h1>
        <p className="landing-hero__description">{t("home.hero.description")}</p>
        <Link className="btn btn--primary landing-hero__cta" data-testid="landing-hero-cta" to="/scenes">
          <span className="landing-hero__cta-label landing-hero__cta-label--desktop">
            {t("home.hero.startExploring")}
          </span>
          <span className="landing-hero__cta-label landing-hero__cta-label--mobile">
            {t("home.hero.exploreScenes")}
          </span>
        </Link>
      </div>
    </section>
  );
};

export default LandingHero;
