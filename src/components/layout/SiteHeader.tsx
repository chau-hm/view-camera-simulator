export const SiteHeader = () => {
  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <div className="site-brand">
          <a className="site-brand__link" href="/" aria-label="View Camera Simulator home">
            <span className="material-symbols-outlined site-brand__icon" aria-hidden="true">photo_camera</span>
            <span className="site-brand__title">View Camera Simulator</span>
          </a>
        </div>

        <nav className="site-nav" aria-label="Primary navigation">
          <a className="site-nav__link" href="/">Home</a>
          <a className="site-nav__link" href="/scenes">Scenes</a>
          <a className="site-nav__link" href="https://github.com/chau-hm/view-camera-simulator" rel="noopener noreferrer" target="_blank">GitHub</a>
        </nav>
      </div>
    </header>
  );
};
