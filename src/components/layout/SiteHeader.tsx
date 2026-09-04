import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";

export const SiteHeader = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    navRef.current?.querySelector<HTMLElement>("a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="site-header" role="banner">
      <div className="site-header__inner">
        <AppBrand homeLabel={t("common.brand.homeLabel")} />

        <button
          ref={menuButtonRef}
          type="button"
          className="site-header__menu-button"
          aria-expanded={isMenuOpen}
          aria-controls="site-primary-navigation"
          aria-label={t(isMenuOpen ? "common.nav.closeMenu" : "common.nav.openMenu")}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className="site-header__menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <nav
          ref={navRef}
          id="site-primary-navigation"
          className={`site-nav ${isMenuOpen ? "site-nav--open" : "site-nav--closed"}`}
          aria-label={t("common.nav.primaryNavigation")}
          onClick={() => setIsMenuOpen(false)}
        >
          <NavLink to="/" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")} end>
            {t("common.nav.home")}
          </NavLink>

          <NavLink to="/scenes" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}>
            {t("common.nav.scenes")}
          </NavLink>

          <NavLink to="/faq" className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}>
            {t("common.nav.faq")}
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
