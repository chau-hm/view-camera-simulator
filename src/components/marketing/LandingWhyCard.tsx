type LandingWhyCardProps = {
  imageSrc: string;
  title: string;
  description: string;
};

export const LandingWhyCard = ({ imageSrc, title, description }: LandingWhyCardProps) => (
  <article className="landing-why-card" data-landing-reveal="card">
    <div className="landing-why-card__artwork">
      <img src={imageSrc} alt="" width="1448" height="1086" loading="lazy" decoding="async" />
    </div>
    <div className="landing-why-card__content">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  </article>
);

export default LandingWhyCard;
