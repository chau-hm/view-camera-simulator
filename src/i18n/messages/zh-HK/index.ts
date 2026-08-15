import { commonMessages } from "./common";
import { homeMessages } from "./home";
import { scenesMessages } from "./scenes";
import { simulatorMessages } from "./simulator";

export const zhHkMessages = {
  common: commonMessages,
  home: homeMessages,
  scenes: scenesMessages,
  simulator: simulatorMessages,
} as const;
