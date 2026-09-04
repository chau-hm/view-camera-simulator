type LandingConceptCardProps = {
  imageSrc: string;
  title: string;
  description: string;
};

export const LandingConceptCard = ({ imageSrc, title, description }: LandingConceptCardProps) => (
  <article className="landing-concept-card">
    <div className="landing-concept-card__artwork">
      <img
        src={imageSrc}
        alt=""
        width="1448"
        height="1086"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="landing-concept-card__content">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </article>
);

export default LandingConceptCard;
