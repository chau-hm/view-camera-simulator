import { Link } from "react-router-dom";
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
};

export const SceneCard = ({
  sceneId,
  title,
  description,
  topics,
  availability,
  thumbnailAsset,
  guidedTaskId,
}: SceneCardProps) => (
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
        {topics.map((t) => (
          <span key={t} className="topic-pill">
            {t}
          </span>
        ))}
      </div>
      <div className="scene-card__actions">
        {availability === "available" ? (
          <>
            <Link className="btn btn--primary" to={`/simulator/free/${sceneId}`}>
              Open Scene
            </Link>
            {guidedTaskId ? (
              <Link
                className="btn btn--secondary"
                to={`/simulator/guided/${sceneId}/${guidedTaskId}`}
              >
                Start Guided Task
              </Link>
            ) : null}
          </>
        ) : (
          <span
            className="btn btn--secondary scene-card__status"
            data-scene-availability="in-development"
            role="status"
          >
            In development
          </span>
        )}
      </div>
    </div>
  </article>
);

export default SceneCard;
