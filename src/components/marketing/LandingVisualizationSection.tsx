import { useTranslation } from "react-i18next";
import { publicAssetUrl } from "../../utils/publicAssetUrl";
import { LandingConceptCard } from "./LandingConceptCard";

const visualizationCards = [
  {
    image: publicAssetUrl("assets/landing/visualize-3d-scene.webp"),
    titleKey: "home.visualize.items.scene3d.title",
    descriptionKey: "home.visualize.items.scene3d.description",
  },
  {
    image: publicAssetUrl("assets/landing/visualize-ground-glass.webp"),
    titleKey: "home.visualize.items.groundGlass.title",
    descriptionKey: "home.visualize.items.groundGlass.description",
  },
  {
    image: publicAssetUrl("assets/landing/visualize-geometry.webp"),
    titleKey: "home.visualize.items.geometry.title",
    descriptionKey: "home.visualize.items.geometry.description",
  },
] as const;

export const LandingVisualizationSection = () => {
  const { t } = useTranslation();

  return (
    <section
      className="landing-learning-section landing-visualization-section"
      aria-labelledby="landing-visualization-title"
      data-testid="landing-visualization-section"
    >
      <header className="landing-learning-section__header">
        <p className="landing-learning-section__eyebrow">{t("home.visualize.eyebrow")}</p>
        <h2 id="landing-visualization-title">{t("home.visualize.title")}</h2>
        <p className="landing-learning-section__description">{t("home.visualize.description")}</p>
      </header>

      <div className="landing-concept-grid landing-concept-grid--visualization">
        {visualizationCards.map((card) => (
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

export default LandingVisualizationSection;
