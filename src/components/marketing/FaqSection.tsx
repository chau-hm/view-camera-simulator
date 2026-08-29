import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type FaqItemProps = {
  number: number;
  icon: string;
  question: string;
  children: ReactNode;
};

const FaqItem = ({ number, icon, question, children }: FaqItemProps) => (
  <details className="faq-item">
    <summary>
      <span className="faq-item__question">
        <span className="faq-item__icon material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
        <span className="faq-item__number" aria-hidden="true">
          {number}.
        </span>
        <span className="faq-item__question-text">{question}</span>
      </span>
      <span className="faq-item__indicator" aria-hidden="true" />
    </summary>
    <div className="faq-item__answer">{children}</div>
  </details>
);

export const FaqSection = () => {
  const { t } = useTranslation();

  return (
    <section
      id="faq"
      className="faq-section"
      aria-label={t("home.faq.title")}
      data-testid="faq-section"
    >
      <div className="faq-section__inner">
        <div className="faq-list">
          <FaqItem number={1} icon="person" question={t("home.faq.items.audience.question")}>
            <p>{t("home.faq.items.audience.intro")}</p>
            <ul>
              <li>{t("home.faq.items.audience.photographersNew")}</li>
              <li>{t("home.faq.items.audience.experiencedPhotographers")}</li>
              <li>{t("home.faq.items.audience.studentsAndEducators")}</li>
              <li>{t("home.faq.items.audience.geometryInterested")}</li>
            </ul>
            <p>{t("home.faq.items.audience.closing")}</p>
          </FaqItem>

          <FaqItem number={2} icon="photo_camera" question={t("home.faq.items.ownership.question")}>
            <p>{t("home.faq.items.ownership.intro")}</p>
            <p>{t("home.faq.items.ownership.geometry")}</p>
            <p>{t("home.faq.items.ownership.otherCameras")}</p>
          </FaqItem>

          <FaqItem number={3} icon="school" question={t("home.faq.items.learning.question")}>
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

          <FaqItem number={4} icon="architecture" question={t("home.faq.items.model.question")}>
            <p>{t("home.faq.items.model.opening")}</p>
            <p>{t("home.faq.items.model.body")}</p>
            <p>{t("home.faq.items.model.movements")}</p>
            <p>{t("home.faq.items.model.dimensions")}</p>
          </FaqItem>

          <FaqItem
            number={5}
            icon="open_with"
            question={t("home.faq.items.movementAvailability.question")}
          >
            <p>{t("home.faq.items.movementAvailability.opening")}</p>
            <p>{t("home.faq.items.movementAvailability.body")}</p>
            <p>{t("home.faq.items.movementAvailability.closing")}</p>
          </FaqItem>

          <FaqItem number={6} icon="science" question={t("home.faq.items.realism.question")}>
            <p>{t("home.faq.items.realism.body")}</p>
            <p>{t("home.faq.items.realism.feedback")}</p>
          </FaqItem>

          <FaqItem number={7} icon="photo_camera" question={t("home.faq.items.practice.question")}>
            <p>{t("home.faq.items.practice.opening")}</p>
            <p>{t("home.faq.items.practice.body")}</p>
            <p>{t("home.faq.items.practice.closing")}</p>
          </FaqItem>
        </div>
      </div>
    </section>
  );
};
