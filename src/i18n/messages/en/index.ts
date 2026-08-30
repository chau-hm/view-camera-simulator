import { commonMessages } from "./common";
import { homeMessages } from "./home";
import { readoutsMessages } from "./readouts";
import { scenesMessages } from "./scenes";
import { simulatorMessages } from "./simulator";
import { tasksMessages } from "./tasks";
import { guidedLessonMessages } from "./guidedLesson";
import { lessonZeroMessages } from "./lessonZero";

export const enMessages = {
  common: commonMessages,
  home: homeMessages,
  readouts: readoutsMessages,
  scenes: scenesMessages,
  simulator: simulatorMessages,
  tasks: tasksMessages,
  guidedLesson: guidedLessonMessages,
  lessonZero: lessonZeroMessages,
} as const;
