import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";

// Flat routes recreate the shared header, so carry only the next compact-link
// focus request across that one local component boundary.
let pendingCompactMenuFocusPath: string | null = null;

export const SiteHeader = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const closeCompactMenu = useCallback(
    (restoreFocus = false) => {
      setIsMenuOpen(false);
      if (restoreFocus) menuButtonRef.current?.focus();
    },
    [],
  );

  const handleCompactMenuLinkClick = useCallback(
    (destinationPath: string | null) => {
      if (!isMenuOpen) return;

      if (destinationPath) {
        pendingCompactMenuFocusPath = destinationPath;
        closeCompactMenu();
        return;
      }

      closeCompactMenu(true);
    },
    [closeCompactMenu, isMenuOpen],
  );

  useEffect(() => {
    if (!isMenuOpen) {
      if (pendingCompactMenuFocusPath === pathname) {
        pendingCompactMenuFocusPath = null;
        menuButtonRef.current?.focus();
      }
      return undefined;
    }

    navRef.current?.querySelector<HTMLElement>("a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pendingCompactMenuFocusPath = null;
      closeCompactMenu(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeCompactMenu, isMenuOpen, pathname]);

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
          onClick={() => {
            if (isMenuOpen) {
              pendingCompactMenuFocusPath = null;
              closeCompactMenu(true);
            } else {
              setIsMenuOpen(true);
            }
          }}
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
        >
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}
            onClick={() => handleCompactMenuLinkClick("/")}
            end
          >
            {t("common.nav.home")}
          </NavLink>

          <NavLink
            to="/scenes"
            className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}
            onClick={() => handleCompactMenuLinkClick("/scenes")}
          >
            {t("common.nav.scenes")}
          </NavLink>

          <NavLink
            to="/faq"
            className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}
            onClick={() => handleCompactMenuLinkClick("/faq")}
          >
            {t("common.nav.faq")}
          </NavLink>

          <a
            className="site-nav__link"
            href="https://github.com/chau-hm/view-camera-simulator"
            rel="noopener noreferrer"
            target="_blank"
            onClick={() => handleCompactMenuLinkClick(null)}
          >
            GitHub
          </a>
        </nav>

        <LanguageSelector />
      </div>
    </header>
  );
};
