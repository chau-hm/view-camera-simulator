import { useTranslation } from "react-i18next";
import { publicAssetUrl } from "../../utils/publicAssetUrl";
import { LandingWhyCard } from "./LandingWhyCard";

const whyCards = [
  {
    image: publicAssetUrl("assets/landing/why-control-before-shot.webp"),
    titleKey: "home.why.items.control.title",
    descriptionKey: "home.why.items.control.description",
  },
  {
    image: publicAssetUrl("assets/landing/why-camera-movements.webp"),
    titleKey: "home.why.items.movements.title",
    descriptionKey: "home.why.items.movements.description",
  },
  {
    image: publicAssetUrl("assets/landing/why-large-format-learning.webp"),
    titleKey: "home.why.items.learning.title",
    descriptionKey: "home.why.items.learning.description",
  },
] as const;

export const LandingWhyItMattersSection = () => {
  const { t } = useTranslation();

  return (
    <section
      id="why"
      className="landing-why-section"
      aria-labelledby="landing-why-title"
      data-testid="landing-why-section"
    >
      <header className="landing-why-section__header" data-landing-reveal="header">
        <p className="landing-why-section__eyebrow">{t("home.why.eyebrow")}</p>
        <h2 id="landing-why-title">
          <span className="landing-why-section__title-line">{t("home.why.title.line1")}</span>
          <span className="landing-why-section__title-line">{t("home.why.title.line2")}</span>
        </h2>
      </header>

      <div className="landing-why-grid">
        {whyCards.map((card) => (
          <LandingWhyCard
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

export default LandingWhyItMattersSection;
