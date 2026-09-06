export const homeMessages = {
  hero: {
    eyebrow: "View Camera Simulator",
    titleLine1: "Shape Perspective.",
    titleLine2: "Place Focus.",
    description:
      "Explore how rise, shift, tilt, swing, and focus reshape perspective, composition, and the plane of focus.",
    startExploring: "Start Exploring",
    exploreScenes: "Explore Scenes",
  },
  fundamentals: {
    eyebrow: "MASTER CAMERA MOVEMENTS",
    title: "Learn the Fundamentals",
    description:
      "Understand the core principles that shape how your camera sees, moves, and focuses on the world.",
    items: {
      perspective: {
        title: "Perspective Control",
        description:
          "See how viewpoint, framing, and camera movements affect perspective relationships and converging lines.",
      },
      focusPlane: {
        title: "Focus Plane",
        description:
          "See where the plane of sharp focus lies and how focusing, tilt, and swing change its relationship to the subject.",
      },
      groundGlass: {
        title: "Ground Glass View",
        description:
          "See the image from the photographer's point of view—framing, composition, and focus on the Ground Glass.",
      },
      opticalGeometry: {
        title: "Optical Geometry",
        description:
          "Understand the geometric relationship between the lens, subject, image plane, and image formation.",
      },
    },
  },
  visualize: {
    eyebrow: "SEE IT. STUDY IT. UNDERSTAND IT.",
    title: "Three Ways to Visualize",
    description:
      "The same camera state can be understood from three complementary views—each revealing something different.",
    items: {
      scene3d: {
        title: "3D Scene",
        description:
          "Understand the camera, subject, and viewpoint as a spatial relationship in 3D.",
      },
      groundGlass: {
        title: "Ground Glass",
        description:
          "See the image formed by the camera and inspect framing, composition, and focus.",
      },
      geometry: {
        title: "Geometry View",
        description:
          "Reveal the optical path, lens and image planes, focus plane, and perspective geometry.",
      },
    },
  },
  why: {
    eyebrow: "WHY IT MATTERS",
    title: {
      line1: "More control before the shot.",
      line2: "A deeper way to see.",
    },
    items: {
      control: {
        title: "What can you control before exposure?",
        description:
          "Camera position, composition, image geometry, and the plane of sharp focus are separate decisions. A view camera makes those relationships explicit before exposure.",
      },
      movements: {
        title: "Why do camera movements matter?",
        description:
          "Rise and shift can recompose while the whole-camera viewpoint stays fixed. Tilt and swing change the orientation of the plane of sharp focus. Move the whole camera, and viewpoint, perspective, and parallax change.",
      },
      learning: {
        title: "Why is large-format camera still worth learning?",
        description:
          "The slower process turns each adjustment into a deliberate decision. An inverted Ground Glass encourages you to inspect edges, planes, focus, and spatial relationships before exposure.",
      },
    },
  },
  faq: {
    title: "Frequently Asked Questions",
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
