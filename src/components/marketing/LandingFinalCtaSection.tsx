import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

const finalCtaImage = publicAssetUrl("assets/landing/final-cta.webp");

export const LandingFinalCtaSection = () => {
  const { t } = useTranslation();

  return (
    <section
      className="landing-final-cta-section"
      aria-labelledby="landing-final-cta-title"
      data-testid="landing-final-cta-section"
    >
      <div className="landing-final-cta-section__artwork" aria-hidden="true">
        <img
          src={finalCtaImage}
          alt=""
          width="1962"
          height="802"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="landing-final-cta-section__content">
        <div className="landing-final-cta-section__copy">
          <h2 id="landing-final-cta-title">{t("home.finalCta.title")}</h2>
          <p>{t("home.finalCta.description")}</p>
          <Link className="btn btn--primary landing-final-cta-section__cta" to="/scenes">
            {t("home.finalCta.action")}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default LandingFinalCtaSection;
