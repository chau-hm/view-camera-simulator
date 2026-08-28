export const homeMessages = {
  hero: {
    eyebrow: "Interactive View Camera Learning",
    title: "See how a view camera changes the image before the shutter is pressed.",
    description:
      "Move the whole camera or its Front and Rear standards, then compare how viewpoint, framing, perspective and focus change on the Ground Glass.",
    exploreSimulator: "Explore the Simulator",
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
  faq: {
    title: "Frequently Asked Questions",
    eyebrow: "VIEW CAMERA SIMULATOR",
    subtitle: "Answers to common questions about View Camera Simulator.",
    items: {
      audience: {
        question: "Who is View Camera Simulator for?",
        intro: "View Camera Simulator is for anyone who wants to understand camera movements and photographic geometry more clearly.",
        photographersNew: "photographers new to large-format or view cameras;",
        experiencedPhotographers: "experienced photographers exploring camera movements;",
        studentsAndEducators: "photography students and educators;",
        geometryInterested: "anyone interested in perspective, focus, composition, and camera geometry.",
        closing: "No previous experience with a view camera is required.",
      },
      ownership: {
        question: "Do I need to own a large-format camera?",
        intro: "No.",
        geometry: "The simulator uses the view camera as a way to make photographic geometry visible. It can help you understand camera position, perspective, framing, focus, and the relationship between the lens, subject, and image plane—even if you never plan to use a large-format camera.",
        otherCameras: "Many of these principles also apply to other cameras, including mirrorless cameras, DSLRs, smartphones, tilt-shift lenses, and technical cameras. However, not every camera provides the same physical movements.",
      },
      learning: {
        question: "What can I learn with View Camera Simulator?",
        intro: "The simulator helps you observe how camera movements affect the image.",
        cameraPosition: "camera position and composition;",
        perspective: "perspective and focal length;",
        standardMovements: "front and rear standard movements;",
        lensAndImagePlanes: "lens and image planes;",
        focusAndDepthOfField: "focus and depth of field;",
        resultingGroundGlass: "and the resulting image on the Ground Glass.",
        closing: "Rather than memorizing rules, you can change the camera and observe what happens.",
      },
      model: {
        question: "Is the simulator based on a specific type of view camera, camera, or lens?",
        opening: "Not exactly.",
        body: "View Camera Simulator uses a generalized, conceptual view-camera model rather than reproducing a particular monorail, field, folding, or other large-format camera. It is a teaching model, not a digital replica of a specific commercial camera or lens.",
        movements: "The front and rear standards provide the movements needed to explore general camera-movement principles, without necessarily reproducing the mechanical restrictions of a specific camera design. Some aspects may resemble a highly adjustable monorail camera, but the simulator should not be interpreted as a model of any particular camera.",
        dimensions: "The simulated camera's dimensions, focal lengths, film format, aperture settings, and movement ranges are chosen to support the concepts being demonstrated. They may therefore differ from those of real cameras such as Sinar, Arca-Swiss, Toyo, or Linhof systems.",
      },
      movementAvailability: {
        question: "Will every movement shown be available on my camera?",
        opening: "Not necessarily.",
        body: "Real view cameras differ in their mechanical design and available movements. Some provide extensive front and rear movements, while others restrict certain movements for reasons such as portability, rigidity, weight, or simplicity.",
        closing: "The simulator demonstrates the general photographic effect of a movement. Refer to your camera's specifications for its actual movement types and ranges.",
      },
      realism: {
        question: "How realistic is the simulator?",
        body: "View Camera Simulator represents the main geometric relationships behind camera movements, but it is primarily an educational tool rather than a complete optical or mechanical simulation.",
        feedback: "Visual elements such as Ground Glass sharpness, blur, and depth-of-field feedback are intended to explain photographic concepts. They should not be treated as measurements of a particular lens, film, sensor, or camera.",
      },
      practice: {
        question: "Is it a replacement for learning with a real view camera?",
        opening: "No.",
        body: "The simulator complements hands-on practice. A physical view camera introduces additional factors, including bellows limitations, mechanical movement limits, lens image-circle limitations, camera rigidity, focusing with a loupe, working under a dark cloth, film holders, and the characteristics of individual cameras and lenses.",
        closing: "The simulator allows you to explore camera geometry and movement concepts separately from these practical considerations.",
      },
    },
  },
} as const;
