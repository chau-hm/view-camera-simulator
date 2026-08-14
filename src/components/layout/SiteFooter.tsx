import { useTranslation } from "react-i18next";

export const SiteFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">
        <div>
          <strong>View Camera Simulator</strong>
          <div className="site-footer__desc">{t("common.footer.description")}</div>
        </div>

        <div>
          <a href="https://github.com/chau-hm/view-camera-simulator" rel="noopener noreferrer" target="_blank">GitHub</a>
        </div>
      </div>
    </footer>
  );
};
