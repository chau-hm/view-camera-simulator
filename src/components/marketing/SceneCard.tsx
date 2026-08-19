import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SceneAvailability } from "../../app/publicScenes";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

type SceneCardProps = {
  sceneId: string;
  title: string;
  description: string;
  topics: readonly string[];
  availability: SceneAvailability;
  thumbnailAsset: string;
  guidedTaskId?: string;
  guidedLesson?: boolean;
};

export const SceneCard = ({
  sceneId,
  title,
  description,
  topics,
  availability,
  thumbnailAsset,
  guidedTaskId,
  guidedLesson = false,
}: SceneCardProps) => {
  const { t } = useTranslation();

  return (
    <article className="scene-feature-card">
      <div className="scene-thumb" aria-hidden="true">
        <picture>
          <img
            src={publicAssetUrl(thumbnailAsset)}
            alt=""
            width="360"
            height="240"
            decoding="async"
          />
        </picture>
      </div>

      <div className="scene-meta">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="topic-pills" aria-hidden>
          {topics.map((topic) => (
            <span key={topic} className="topic-pill">
              {topic}
            </span>
          ))}
        </div>
        <div className="scene-card__actions">
          {availability === "available" ? (
            <>
              <Link className="btn btn--primary" to={`/simulator/free/${sceneId}`}>
                {t("common.sceneCard.openScene")}
              </Link>
              {guidedTaskId ? (
                <Link
                  className="btn btn--secondary"
                  to={
                    guidedLesson
                      ? `/simulator/free/${sceneId}?lesson=1`
                      : `/simulator/guided/${sceneId}/${guidedTaskId}`
                  }
                >
                  {t(guidedLesson ? "common.sceneCard.guidedLesson" : "common.sceneCard.startGuidedTask")}
                </Link>
              ) : null}
            </>
          ) : (
            <span
              className="btn btn--secondary scene-card__status"
              data-scene-availability="in-development"
              role="status"
            >
              {t("common.sceneCard.inDevelopment")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default SceneCard;
