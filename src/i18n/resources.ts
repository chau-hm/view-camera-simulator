import { enMessages } from "./messages/en";
import { zhHkMessages } from "./messages/zh-HK";

export const resources = {
  en: { translation: enMessages },
  "zh-HK": { translation: zhHkMessages },
} as const;
