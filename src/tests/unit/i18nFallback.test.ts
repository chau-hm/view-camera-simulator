import i18next from "i18next";
import { describe, expect, it } from "vitest";

describe("i18n fallback", () => {
  it("resolves a missing zh-HK message through the English fallback", async () => {
    const instance = i18next.createInstance();
    await instance.init({
      resources: {
        en: { translation: { fallbackMessage: "English fallback" } },
        "zh-HK": { translation: {} },
      },
      lng: "zh-HK",
      fallbackLng: "en",
    });

    const translate = (key: string) => instance.t(key as never);

    expect(translate("fallbackMessage")).toBe("English fallback");
    expect(translate("fallbackMessage")).not.toBe("fallbackMessage");
  });
});
