export const supportedLocales = ["en", "zh-HK"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === "string" && supportedLocales.includes(value as SupportedLocale);

export const resolveBrowserLocale = (language: string | null | undefined): SupportedLocale => {
  const normalized = language?.trim().toLowerCase();
  return normalized === "zh" || normalized?.startsWith("zh-") ? "zh-HK" : defaultLocale;
};
