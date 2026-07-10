import { Link, NavLink } from "react-router-dom";

export const SiteHeader = () => {
  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <div className="site-brand">
          <Link className="site-brand__link" to="/" aria-label="View Camera Simulator home">
            <span className="material-symbols-outlined site-brand__icon" aria-hidden="true">photo_camera</span>
            <span className="site-brand__title">View Camera Simulator</span>
          </Link>
        </div>

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
