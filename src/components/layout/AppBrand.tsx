import { Link } from "react-router-dom";

type AppBrandProps = {
  className?: string;
  useRouterLink?: boolean; // when false, render a plain anchor for test environments
};

export const AppBrand = ({ className = "", useRouterLink = true }: AppBrandProps) => (
  <div className={`app-brand ${className}`.trim()}>
    {useRouterLink ? (
      <Link to="/" className="app-brand__link" aria-label="View Camera Simulator home">
        <span className="material-symbols-outlined app-brand__icon" aria-hidden="true">photo_camera</span>
        <span className="app-brand__title">View Camera Simulator</span>
      </Link>
    ) : (
      <a href="/" className="app-brand__link" aria-label="View Camera Simulator home">
        <span className="material-symbols-outlined app-brand__icon" aria-hidden="true">photo_camera</span>
        <span className="app-brand__title">View Camera Simulator</span>
      </a>
    )}
  </div>
);
