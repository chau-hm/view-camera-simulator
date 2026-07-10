import { Link } from "react-router-dom";

export const FocusCtaPanel = () => (
  <section className="focus-cta" aria-labelledby="focus-cta-heading">
    <div className="focus-cta__content">
      <div className="eyebrow">Start with focus</div>
      <h2 id="focus-cta-heading">Understand focus first</h2>
      <p>
        Use two targets at different distances to see how focus distance and aperture affect the ground-glass image.
      </p>
      <div>
        <Link className="btn btn--primary" to="/simulator/free/focus-fundamentals-two-targets">
          Open Focus Fundamentals
        </Link>
      </div>
    </div>
    <div aria-hidden className="focus-cta__art">
      <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
        <circle cx="70" cy="70" r="64" fill="#fff" stroke="#e8e7ff" />
        <circle cx="90" cy="70" r="8" fill="#5b4ee8" />
        <rect x="40" y="60" width="40" height="4" fill="#cfcfff" transform="rotate(-12 60 62)" />
      </svg>
    </div>
  </section>
);

export default FocusCtaPanel;
