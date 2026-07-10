import { Link } from "react-router-dom";

type AppBrandProps = {
  className?: string;
};

export const AppBrand = ({ className = "" }: AppBrandProps) => (
  <div className={`app-brand ${className}`.trim()}>
    <Link to="/" className="app-brand__link" aria-label="View Camera Simulator home">
      <span className="material-symbols-outlined app-brand__icon" aria-hidden="true">photo_camera</span>
      <span className="app-brand__title">View Camera Simulator</span>
    </Link>
  </div>
);
