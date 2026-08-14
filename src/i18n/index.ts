import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import {
  defaultLocale,
  isSupportedLocale,
  supportedLocales,
  type SupportedLocale,
} from "./locales";
import { persistLocale, resolveInitialLocale } from "./localePreference";
import { resources } from "./resources";

export { defaultLocale, isSupportedLocale, supportedLocales } from "./locales";
export { LOCALE_STORAGE_KEY, readPersistedLocale, resolveInitialLocale } from "./localePreference";
export type { SupportedLocale } from "./locales";
export { publicSceneMessageKeys } from "./messageKeys";
export type {
  PublicSceneDescriptionKey,
  PublicSceneTitleKey,
  PublicSceneTopicKey,
} from "./messageKeys";

export const i18n = i18next;
const initialLocale = resolveInitialLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: defaultLocale,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  ns: ["translation"],
  interpolation: { escapeValue: false },
});

const syncDocumentLanguage = (locale: SupportedLocale): void => {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
};

i18n.on("languageChanged", (locale) => {
  syncDocumentLanguage(isSupportedLocale(locale) ? locale : defaultLocale);
});
syncDocumentLanguage(initialLocale);

export const changeLocale = (locale: SupportedLocale): void => {
  if (!isSupportedLocale(locale)) return;
  persistLocale(locale);
  syncDocumentLanguage(locale);
  void i18n.changeLanguage(locale);
};
