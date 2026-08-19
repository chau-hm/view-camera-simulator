import { useTranslation } from "react-i18next";
import { changeLocale, isSupportedLocale, supportedLocales, type SupportedLocale } from "../../i18n";

export const LanguageSelector = () => {
  const { i18n, t } = useTranslation();
  const currentLocale: SupportedLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : "en";

  return (
    <label className="language-selector" htmlFor="language-selector">
      <span>{t("common.language.label")}</span>
      <select
        id="language-selector"
        aria-label={t("common.language.label")}
        value={currentLocale}
        onChange={(event) => changeLocale(event.currentTarget.value as SupportedLocale)}
      >
        {supportedLocales.map((locale) => (
          <option key={locale} value={locale}>
            {locale === "en"
              ? t("common.language.english")
              : t("common.language.traditionalChinese")}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSelector;
