export const homeMessages = {
  hero: {
    eyebrow: "Interactive View Camera Learning",
    title: "See how a view camera changes the image before the shutter is pressed.",
    description:
      "Move the whole camera or its Front and Rear standards, then compare how viewpoint, framing, perspective and focus change on the Ground Glass.",
    exploreSimulator: "Explore the Simulator",
    learnWhy: "Learn Why",
  },
  why: {
    ariaLabel: "Why use a view camera",
  },
  info: {
    control: {
      title: "What can a view camera control before exposure?",
      body:
        "A view camera separates decisions that are often bundled together: where the camera observes from, how the subject is framed, how the image geometry is controlled, and where the plane of sharp focus lies. These relationships can be shaped at the camera before exposure rather than treated only as corrections afterwards.",
    },
    movements: {
      title: "Why do camera movements matter?",
      body:
        "Rise and shift can change framing without moving the viewpoint. Tilt and swing can rotate the plane of sharp focus. Moving the whole camera changes viewpoint, perspective relationships and parallax. The useful question is which physical relationship you want to change.",
    },
    artists: {
      title: "Why do artists still use view cameras?",
      body:
        "A view camera slows the process down. The upside-down image on the ground glass encourages careful looking, and every movement becomes a deliberate choice. Artists use it not only for image quality, but because the method changes how a photograph is seen and made.",
    },
  },
} as const;
