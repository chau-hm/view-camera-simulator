import { Link } from "react-router-dom";
import { publicAssetUrl } from "../../utils/publicAssetUrl";

type AppBrandProps = {
  className?: string;
  homeLabel?: string;
};

export const AppBrand = ({ className = "", homeLabel = "View Camera Simulator home" }: AppBrandProps) => (
  <div className={`app-brand ${className}`.trim()}>
    <Link to="/" className="app-brand__link" aria-label={homeLabel}>
      <img
        className="app-brand__icon"
        src={publicAssetUrl("assets/view-camera-app-icon-32.png")}
        alt=""
        width="28"
        height="28"
        aria-hidden="true"
      />
      <span className="app-brand__title">View Camera Simulator</span>
    </Link>
  </div>
);
