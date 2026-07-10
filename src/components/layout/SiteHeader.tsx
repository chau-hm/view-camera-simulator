import { NavLink } from "react-router-dom";
import { AppBrand } from "./AppBrand";

export const SiteHeader = () => {
  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <AppBrand />

        <nav className="site-nav" aria-label="Primary navigation">
          <NavLink to="/" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")} end>
            Home
          </NavLink>

          <NavLink to="/scenes" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}>
            Scenes
          </NavLink>

          <a className="site-nav__link" href="https://github.com/chau-hm/view-camera-simulator" rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
};
