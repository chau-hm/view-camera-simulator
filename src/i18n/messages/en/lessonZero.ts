export const lessonZeroMessages = {
  common: {
    lessonLabel: "Lesson 0 · Meet the View Camera",
    progressAria: "Lesson 0 anatomy progress",
    stepOf: "Step {{current}} of {{total}}",
    previous: "Previous",
    next: "Next",
    reset: "Restart lesson",
    lessonComplete: "Lesson complete",
    backToScenes: "Back to Scenes",
    showSmallAperture: "Show a smaller opening",
    showWideAperture: "Show a wider opening",
    tryControl: "Try this control",
    controlComplete: "Good — the physical change is now visible.",
    controlPending: "Move the control enough to make the physical change clear.",
  },
  steps: {
    completeCamera: {
      title: "The complete camera",
      body:
        "A view camera is built from two standards connected by flexible bellows. The front carries the lens; the rear carries the focusing or recording back.",
      cue: "Use the three-quarter view to see how the front, bellows, rear, and support fit together.",
    },
    frontStandard: {
      title: "Front Standard",
      body:
        "The Front Standard carries the lens assembly. It is the front half of the camera's two-standard structure; its positioning is a topic for later lessons.",
      cue: "Look for the upright frame surrounding the Lens Board.",
    },
    lensAndBoard: {
      title: "Lens and Lens Board",
      body:
        "The Lens forms the image. The Lens Board is the separate plate that mounts the lens to the Front Standard; real cameras use different board systems.",
      cue: "Notice the plate around the lens, separate from the larger standard frame.",
    },
    aperture: {
      title: "Aperture",
      body:
        "The aperture is inside the lens and controls the size of the opening through which light passes. A smaller opening is represented by a larger f-number.",
      cue: "Compare the iris opening, then continue when the physical location is clear.",
    },
    bellows: {
      title: "Bellows",
      body:
        "Bellows form a flexible, light-tight connection between the Front and Rear Standards. They allow the standards to be separated while keeping the light path enclosed.",
      cue: "Follow the folded connection from one standard to the other.",
    },
    rearStandard: {
      title: "Rear Standard",
      body:
        "The Rear Standard carries the focusing screen or film back and defines the image-plane side of the camera.",
      cue: "Look for the separate rear frame around the back opening.",
    },
    groundGlass: {
      title: "Ground Glass",
      body:
        "The physical Ground Glass is the focusing screen at the back of the camera. It is where the photographer inspects focus and composition before exposure.",
      cue: "This screen is camera anatomy; the simulator's Ground Glass panel is a separate preview of the image.",
    },
    filmHolder: {
      title: "Film Holder",
      body:
        "For exposure, the Film Holder replaces the Ground Glass. Its film surface occupies the same image plane as the focusing screen.",
      cue: "Notice that the holder is a cassette around the same rear image-plane position.",
    },
    cameraSupport: {
      title: "Camera Support",
      body:
        "The support keeps the camera structure aligned while the standards can be positioned relative to it. Real view cameras use different support arrangements, but the structural role is shared.",
      cue: "Trace the base beneath both standards; it supports the camera without being a standard movement.",
    },
    recap: {
      title: "Recap",
      body:
        "The Front Standard carries the Lens Board and Lens, including the Aperture. Bellows connect it to the Rear Standard, where Ground Glass or Film Holder occupies the image-plane position; the Camera Support holds the structure together.",
      cue: "You are ready to explore how camera controls move these parts in later lessons.",
    },
    controlsOverview: {
      title: "Now try the controls",
      body:
        "The controls change the physical camera parts you just identified. Each short exercise focuses on one real control and its visible result.",
      cue: "Use the highlighted control, then continue when the relationship is clear.",
    },
    frontRiseControl: {
      title: "Front Rise",
      body:
        "Rise moves the Front Standard vertically while the Camera Support stays in place.",
      cue: "Drag Rise until the Front Standard's vertical movement is easy to see.",
    },
    frontShiftControl: {
      title: "Front Shift",
      body:
        "Shift moves the Front Standard sideways without rotating it.",
      cue: "Drag Front Shift until the lateral movement is easy to see.",
    },
    frontTiltControl: {
      title: "Front Tilt",
      body:
        "Tilt rotates the Front Standard forward or backward around its horizontal axis.",
      cue: "Drag Tilt and watch the Front Standard change orientation.",
    },
    frontSwingControl: {
      title: "Front Swing",
      body:
        "Swing rotates the Front Standard left or right around its vertical axis.",
      cue: "Drag Swing and watch the Front Standard turn from side to side.",
    },
    focusFrontControl: {
      title: "Focus — Front Standard",
      body:
        "With Front Standard selected, focusing moves the Front Standard along the optical axis. The Bellows changes length with it.",
      cue: "Choose Front Standard, then move Focus distance until the travel is easy to see.",
    },
    focusRearControl: {
      title: "Focus — Rear Standard",
      body:
        "With Rear Standard selected, focusing moves the Rear Standard along the optical axis. The Bellows changes length with it.",
      cue: "Choose Rear Standard, then move Focus distance until the travel is easy to see.",
    },
    apertureControl: {
      title: "Aperture control",
      body:
        "The Aperture control changes the diaphragm blades inside the Lens. A larger f-number leaves a smaller opening.",
      cue: "Choose another aperture and watch the diaphragm opening change.",
    },
    controlsRecap: {
      title: "Controls recap",
      body:
        "Controls now have physical meaning: standard movements reposition a standard, focusing changes the selected standard and Bellows, and Aperture changes the diaphragm inside the Lens.",
      cue: "You are ready for later lessons that study the optical results of these changes.",
    },
  },
} as const;
