export const simulatorMessageKeys = {
  task: {
    title: "simulator.task.title",
    freePractice: "simulator.task.freePractice",
  },
  feedback: {
    title: "simulator.feedback.title",
    liveObservation: "simulator.feedback.liveObservation",
  },
  movementHelp: {
    button: "simulator.movementHelp.button",
    title: "simulator.movementHelp.title",
    close: "simulator.movementHelp.close",
    rise: "simulator.movementHelp.rise",
    tilt: "simulator.movementHelp.tilt",
    swing: "simulator.movementHelp.swing",
  },
  freePractice: {
    generic: {
      objective: "simulator.freePractice.generic.objective",
      observation: "simulator.freePractice.generic.observation",
    },
    understanding: {
      objective: "simulator.freePractice.understanding.objective",
      bullets: {
        viewpoint: "simulator.freePractice.understanding.bullets.viewpoint",
        tilt: "simulator.freePractice.understanding.bullets.tilt",
        verticalFraming: "simulator.freePractice.understanding.bullets.verticalFraming",
        compare: "simulator.freePractice.understanding.bullets.compare",
      },
      observation: "simulator.freePractice.understanding.observation",
    },
    focusFundamentals: {
      objective: "simulator.freePractice.focusFundamentals.objective",
      bullets: {
        focusDistance: "simulator.freePractice.focusFundamentals.bullets.focusDistance",
        readouts: "simulator.freePractice.focusFundamentals.bullets.readouts",
        compare: "simulator.freePractice.focusFundamentals.bullets.compare",
      },
      observation: "simulator.freePractice.focusFundamentals.observation",
    },
    architectureRise: {
      objective: "simulator.freePractice.architectureRise.objective",
      bullets: {
        rise: "simulator.freePractice.architectureRise.bullets.rise",
        level: "simulator.freePractice.architectureRise.bullets.level",
        focus: "simulator.freePractice.architectureRise.bullets.focus",
      },
      observation: "simulator.freePractice.architectureRise.observation",
    },
    tableTilt: {
      objective: "simulator.freePractice.tableTilt.objective",
      bullets: {
        focus: "simulator.freePractice.tableTilt.bullets.focus",
        tilt: "simulator.freePractice.tableTilt.bullets.tilt",
        patches: "simulator.freePractice.tableTilt.bullets.patches",
        aperture: "simulator.freePractice.tableTilt.bullets.aperture",
      },
      observation: "simulator.freePractice.tableTilt.observation",
    },
    shelfSwing: {
      objective: "simulator.freePractice.shelfSwing.objective",
      bullets: {
        start: "simulator.freePractice.shelfSwing.bullets.start",
        geometry: "simulator.freePractice.shelfSwing.bullets.geometry",
        refine: "simulator.freePractice.shelfSwing.bullets.refine",
        compare: "simulator.freePractice.shelfSwing.bullets.compare",
      },
      observation: "simulator.freePractice.shelfSwing.observation",
    },
    mirrorShift: {
      objective: "simulator.freePractice.mirrorShift.objective",
      bullets: {
        position: "simulator.freePractice.mirrorShift.bullets.position",
        viewpoint: "simulator.freePractice.mirrorShift.bullets.viewpoint",
        framing: "simulator.freePractice.mirrorShift.bullets.framing",
        parallax: "simulator.freePractice.mirrorShift.bullets.parallax",
      },
      observation: "simulator.freePractice.mirrorShift.observation",
    },
  },
} as const;

type StringLeaves<T> = T extends string
  ? T
  : T extends object
    ? StringLeaves<T[keyof T]>
    : never;

export type SimulatorMessageKey = StringLeaves<typeof simulatorMessageKeys>;
export type FreePracticeMessageKey = StringLeaves<typeof simulatorMessageKeys.freePractice>;
