import { commonMessages } from "./common";
import { homeMessages } from "./home";
import { readoutsMessages } from "./readouts";
import { scenesMessages } from "./scenes";
import { simulatorMessages } from "./simulator";
import { tasksMessages } from "./tasks";

export const zhHkMessages = {
  common: commonMessages,
  home: homeMessages,
  readouts: readoutsMessages,
  scenes: scenesMessages,
  simulator: simulatorMessages,
  tasks: tasksMessages,
} as const;
