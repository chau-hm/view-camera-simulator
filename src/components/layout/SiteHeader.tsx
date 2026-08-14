import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";

export const SiteHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <AppBrand homeLabel={t("common.brand.homeLabel")} />

        <nav className="site-nav" aria-label={t("common.nav.primaryNavigation")}>
          <NavLink to="/" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")} end>
            {t("common.nav.home")}
          </NavLink>

          <NavLink to="/scenes" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}>
            {t("common.nav.scenes")}
          </NavLink>

          <a className="site-nav__link" href="https://github.com/chau-hm/view-camera-simulator" rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </nav>

        <LanguageSelector />
      </div>
    </header>
  );
};
