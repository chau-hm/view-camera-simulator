import { useTranslation } from "react-i18next";
import { publicAssetUrl } from "../../utils/publicAssetUrl";
import { LandingConceptCard } from "./LandingConceptCard";

const fundamentalsCards = [
  {
    image: publicAssetUrl("assets/landing/fundamentals-perspective-control.webp"),
    titleKey: "home.fundamentals.items.perspective.title",
    descriptionKey: "home.fundamentals.items.perspective.description",
  },
  {
    image: publicAssetUrl("assets/landing/fundamentals-focus-plane.webp"),
    titleKey: "home.fundamentals.items.focusPlane.title",
    descriptionKey: "home.fundamentals.items.focusPlane.description",
  },
  {
    image: publicAssetUrl("assets/landing/fundamentals-ground-glass.webp"),
    titleKey: "home.fundamentals.items.groundGlass.title",
    descriptionKey: "home.fundamentals.items.groundGlass.description",
  },
  {
    image: publicAssetUrl("assets/landing/fundamentals-optical-geometry.webp"),
    titleKey: "home.fundamentals.items.opticalGeometry.title",
    descriptionKey: "home.fundamentals.items.opticalGeometry.description",
  },
] as const;

export const LandingFundamentalsSection = () => {
  const { t } = useTranslation();

  return (
    <section
      className="landing-learning-section landing-fundamentals-section"
      aria-labelledby="landing-fundamentals-title"
      data-testid="landing-fundamentals-section"
    >
      <header className="landing-learning-section__header">
        <p className="landing-learning-section__eyebrow">{t("home.fundamentals.eyebrow")}</p>
        <h2 id="landing-fundamentals-title">{t("home.fundamentals.title")}</h2>
        <p className="landing-learning-section__description">{t("home.fundamentals.description")}</p>
      </header>

      <div className="landing-concept-grid landing-concept-grid--fundamentals">
        {fundamentalsCards.map((card) => (
          <LandingConceptCard
            key={card.titleKey}
            imageSrc={card.image}
            title={t(card.titleKey)}
            description={t(card.descriptionKey)}
          />
        ))}
      </div>
    </section>
  );
};

export default LandingFundamentalsSection;
