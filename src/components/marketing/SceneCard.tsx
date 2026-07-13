import { Link } from "react-router-dom";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

type SceneCardProps = {
  sceneId: string;
  title: string;
  description: string;
  topics: readonly string[];
};

export const SceneCard = ({ sceneId, title, description, topics }: SceneCardProps) => (
  <article className="scene-feature-card">
    <div className="scene-thumb" aria-hidden="true">
      <picture>
        <img
          src={
            sceneId === "architecture-rise"
              ? publicAssetUrl("assets/architecture-rise.png")
              : publicAssetUrl("assets/two-targets-illustration.png")
          }
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
          <span key={t} className="topic-pill">{t}</span>
        ))}
      </div>
      <div className="scene-card__actions">
        <Link className="btn btn--primary" to={`/simulator/free/${sceneId}`}>Open Scene</Link>
      </div>
    </div>
  </article>
);

export default SceneCard;
