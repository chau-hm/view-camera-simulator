import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type FaqItemProps = {
  question: string;
  children: ReactNode;
};

const FaqItem = ({ question, children }: FaqItemProps) => (
  <details className="landing-faq-item">
    <summary>{question}</summary>
    <div className="landing-faq-item__answer">{children}</div>
  </details>
);

export const FaqSection = () => {
  const { t } = useTranslation();

  return (
    <section
      id="faq"
      className="landing-faq-section"
      aria-labelledby="landing-faq-heading"
      data-testid="landing-faq"
    >
      <div className="landing-faq-section__inner">
        <h2 id="landing-faq-heading">{t("home.faq.title")}</h2>

        <div className="landing-faq-list">
          <FaqItem question={t("home.faq.items.audience.question")}>
            <p>{t("home.faq.items.audience.intro")}</p>
            <ul>
              <li>{t("home.faq.items.audience.photographersNew")}</li>
              <li>{t("home.faq.items.audience.experiencedPhotographers")}</li>
              <li>{t("home.faq.items.audience.studentsAndEducators")}</li>
              <li>{t("home.faq.items.audience.geometryInterested")}</li>
            </ul>
            <p>{t("home.faq.items.audience.closing")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.ownership.question")}>
            <p>{t("home.faq.items.ownership.intro")}</p>
            <p>{t("home.faq.items.ownership.geometry")}</p>
            <p>{t("home.faq.items.ownership.otherCameras")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.learning.question")}>
            <p>{t("home.faq.items.learning.intro")}</p>
            <ul>
              <li>{t("home.faq.items.learning.cameraPosition")}</li>
              <li>{t("home.faq.items.learning.perspective")}</li>
              <li>{t("home.faq.items.learning.standardMovements")}</li>
              <li>{t("home.faq.items.learning.lensAndImagePlanes")}</li>
              <li>{t("home.faq.items.learning.focusAndDepthOfField")}</li>
              <li>{t("home.faq.items.learning.resultingGroundGlass")}</li>
            </ul>
            <p>{t("home.faq.items.learning.closing")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.model.question")}>
            <p>{t("home.faq.items.model.opening")}</p>
            <p>{t("home.faq.items.model.body")}</p>
            <p>{t("home.faq.items.model.movements")}</p>
            <p>{t("home.faq.items.model.dimensions")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.movementAvailability.question")}>
            <p>{t("home.faq.items.movementAvailability.opening")}</p>
            <p>{t("home.faq.items.movementAvailability.body")}</p>
            <p>{t("home.faq.items.movementAvailability.closing")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.realism.question")}>
            <p>{t("home.faq.items.realism.body")}</p>
            <p>{t("home.faq.items.realism.feedback")}</p>
          </FaqItem>

          <FaqItem question={t("home.faq.items.practice.question")}>
            <p>{t("home.faq.items.practice.opening")}</p>
            <p>{t("home.faq.items.practice.body")}</p>
            <p>{t("home.faq.items.practice.closing")}</p>
          </FaqItem>
        </div>
      </div>
    </section>
  );
};
