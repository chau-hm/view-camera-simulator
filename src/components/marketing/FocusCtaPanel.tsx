import { Link } from "react-router-dom";

export const FocusCtaPanel = () => (
  <section className="focus-cta" aria-labelledby="focus-cta-heading">
    <div className="focus-cta__content">
      <div className="eyebrow">Start with focus</div>
      <h2 id="focus-cta-heading">Understand focus first</h2>
      <p>
        Use two targets at different distances to see how focus distance and aperture affect the ground-glass image.
      </p>
      <div className="focus-cta__actions">
        <Link className="btn" to="/simulator/free/focus-fundamentals-two-targets">
          Open Focus Fundamentals
        </Link>
      </div>
    </div>

    <div className="focus-cta__art" aria-hidden="true">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
        <defs>
          <radialGradient id="fg" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#efeaff" stop-opacity="0.7" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="url(#fg)" />
        <g transform="translate(50,50)" fill="none" stroke="#cfc8ff" stroke-width="2">
          <circle r="34" />
          <circle r="22" />
          <circle r="10" />
        </g>
      </svg>
    </div>
  </section>
);

export default FocusCtaPanel;
