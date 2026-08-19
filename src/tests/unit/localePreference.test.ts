import { describe, expect, it } from "vitest";
import {
  LOCALE_STORAGE_KEY,
  persistLocale,
  readPersistedLocale,
  resolveInitialLocale,
  type LocaleStorage,
} from "../../i18n/localePreference";
import { resolveBrowserLocale } from "../../i18n/locales";

class MemoryStorage implements LocaleStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("locale resolution", () => {
  it.each([
    ["en-US", "en"],
    ["zh-HK", "zh-HK"],
    ["zh-TW", "zh-HK"],
    ["zh", "zh-HK"],
    ["zh-Hans", "zh-HK"],
    ["fr-FR", "en"],
  ] as const)("maps browser language %s to %s", (language, expected) => {
    expect(resolveBrowserLocale(language)).toBe(expected);
  });

  it("uses a valid persisted preference before the browser language", () => {
    expect(
      resolveInitialLocale({ persistedLocale: "zh-HK", browserLanguage: "en-US" }),
    ).toBe("zh-HK");
  });

  it("ignores an invalid persisted preference", () => {
    expect(
      resolveInitialLocale({ persistedLocale: "not-a-locale", browserLanguage: "zh-TW" }),
    ).toBe("zh-HK");
  });

  it("reads and persists only supported locale identifiers", () => {
    const storage = new MemoryStorage();
    expect(readPersistedLocale(storage)).toBeNull();

    persistLocale("zh-HK", storage);
    expect(storage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-HK");
    expect(readPersistedLocale(storage)).toBe("zh-HK");

    storage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
    expect(readPersistedLocale(storage)).toBeNull();
  });

  it("continues with the default when storage access throws", () => {
    const unavailableStorage: LocaleStorage = {
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };

    expect(readPersistedLocale(unavailableStorage)).toBeNull();
    expect(() => persistLocale("zh-HK", unavailableStorage)).not.toThrow();
  });
});
