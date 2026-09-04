import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";

export const SiteHeader = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const restoreMenuToggleFocus = useCallback(() => {
    menuButtonRef.current?.focus();
    if (typeof window.requestAnimationFrame !== "function") return;

    const focusCurrentMenuToggle = () => {
      document.querySelector<HTMLButtonElement>(".site-header__menu-button")?.focus();
    };

    window.requestAnimationFrame(() => {
      focusCurrentMenuToggle();
      window.requestAnimationFrame(focusCurrentMenuToggle);
    });
  }, []);

  const closeCompactMenu = useCallback(
    (restoreFocus = false) => {
      setIsMenuOpen(false);
      if (restoreFocus) restoreMenuToggleFocus();
    },
    [restoreMenuToggleFocus],
  );

  const handleCompactMenuLinkClick = useCallback(() => {
    if (isMenuOpen) closeCompactMenu(true);
  }, [closeCompactMenu, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    navRef.current?.querySelector<HTMLElement>("a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeCompactMenu(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeCompactMenu, isMenuOpen]);

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
            onClick={handleCompactMenuLinkClick}
            end
          >
            {t("common.nav.home")}
          </NavLink>

          <NavLink
            to="/scenes"
            className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}
            onClick={handleCompactMenuLinkClick}
          >
            {t("common.nav.scenes")}
          </NavLink>

          <NavLink
            to="/faq"
            className={({ isActive }) => (isActive ? "site-nav__link site-nav__link--active" : "site-nav__link")}
            onClick={handleCompactMenuLinkClick}
          >
            {t("common.nav.faq")}
          </NavLink>

          <a
            className="site-nav__link"
            href="https://github.com/chau-hm/view-camera-simulator"
            rel="noopener noreferrer"
            target="_blank"
            onClick={handleCompactMenuLinkClick}
          >
            GitHub
          </a>
        </nav>

        <LanguageSelector />
      </div>
    </header>
  );
};
