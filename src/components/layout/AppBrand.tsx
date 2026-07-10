import { Link } from "react-router-dom";

type AppBrandProps = {
  className?: string;
};

export const AppBrand = ({ className = "" }: AppBrandProps) => (
  <div className={`app-brand ${className}`.trim()}>
    <Link to="/" className="app-brand__link" aria-label="View Camera Simulator home">
      <img
        className="app-brand__icon"
        src="/assets/view-camera-app-icon-32.png"
        alt=""
        width="28"
        height="28"
        aria-hidden="true"
      />
      <span className="app-brand__title">View Camera Simulator</span>
    </Link>
  </div>
);
