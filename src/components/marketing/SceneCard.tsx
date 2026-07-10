import React from "react";
import { Link } from "react-router-dom";
import { TwoTargetsThumbnail } from "./TwoTargetsThumbnail";

type SceneCardProps = {
  sceneId: string;
  title: string;
  description: string;
  topics: string[];
  badge?: string | null;
};

export const SceneCard = ({ sceneId, title, description, topics, badge }: SceneCardProps) => (
  <article className="scene-feature-card">
    <TwoTargetsThumbnail />
    <div className="scene-meta">
      {badge ? <div className="scene-badge">{badge}</div> : null}
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
