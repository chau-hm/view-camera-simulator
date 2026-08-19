import {
  defaultLocale,
  isSupportedLocale,
  resolveBrowserLocale,
  type SupportedLocale,
} from "./locales";

export const LOCALE_STORAGE_KEY = "view-camera-simulator.locale";

export type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

const getBrowserLanguage = (): string | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return navigator.languages?.[0] ?? navigator.language;
};

const getLocalStorage = (): LocaleStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readPersistedLocale = (
  storage: LocaleStorage | null = getLocalStorage(),
): SupportedLocale | null => {
  if (!storage) return null;

  try {
    const value = storage.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  } catch {
    return null;
  }
};

export const persistLocale = (
  locale: SupportedLocale,
  storage: LocaleStorage | null = getLocalStorage(),
): void => {
  if (!storage) return;

  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The app remains usable with the in-memory locale when storage is blocked.
  }
};

export type LocaleResolutionInput = {
  persistedLocale?: unknown;
  browserLanguage?: string | null;
};

export const resolveInitialLocale = ({
  persistedLocale = readPersistedLocale(),
  browserLanguage = getBrowserLanguage(),
}: LocaleResolutionInput = {}): SupportedLocale => {
  if (isSupportedLocale(persistedLocale)) return persistedLocale;
  return browserLanguage ? resolveBrowserLocale(browserLanguage) : defaultLocale;
};
