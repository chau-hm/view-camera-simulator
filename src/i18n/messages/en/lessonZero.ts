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
  },
} as const;
