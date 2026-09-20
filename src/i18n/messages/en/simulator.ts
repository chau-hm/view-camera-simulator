export const simulatorMessages = {
  headerContext: {
    freeExploration: "Free Exploration",
    lesson: "Lesson",
  },
  task: {
    title: "Task",
    freePractice: "Free practice",
  },
  feedback: {
    title: "Feedback",
    liveObservation: "Live observation",
  },
  learning: {
    title: "Task and Feedback",
    viewsLabel: "Task and Feedback views",
    open: "Open Task and Feedback",
    close: "Close Task and Feedback",
    pin: "Keep Task and Feedback open",
    unpin: "Allow Task and Feedback to auto-hide",
  },
  controls: {
    lensTitle: "Lens / Angle of View",
    lensOptionsLabel: "Lens options",
    lensCopy:
      "Same camera position. Changing focal length changes angle of view and framing, not perspective; perspective changes when the camera position changes.",
    lensWide: "Wide",
    lensStandard: "Standard",
    lensOptionLabel: "{{focalLength}} mm — {{label}}",
    movementTitle: "Movement",
    riseLabel: "Rise",
    tiltLabel: "Tilt",
    swingLabel: "Swing",
    focusTitle: "Focus",
    focusDistanceLabel: "Focus distance",
    apertureTitle: "Aperture",
    apertureOptionLabel: "f/{{value}}",
    resetTitle: "Reset",
    resetMovementsButton: "Reset movements",
    restartTaskButton: "Restart task",
    viewOptionsTitle: "View Options",
    gridLabel: "Grid",
    guidedControlLockedReason: "Disabled for this guided task",
    focusStandardGroupLabel: "Focus standard",
    focusWithLegend: "Focus with",
    frontStandard: "Front standard",
    rearStandard: "Rear standard",
    frontFocusHelp: "Front focusing moves the lens/viewpoint. The film stays fixed.",
    rearFocusHelp: "Rear focusing moves the film while the lens/viewpoint stays fixed.",
    focusTargetObservationNear: "Watch the white frame (near gate) and far pointer.",
    focusTargetObservationAlignment: "Front focus changes their alignment; Rear focus keeps them aligned.",
    focusInfinityLabel: "Focus: ∞",
    lastFiniteFocusLabel: "Last finite focus: {{distance}}",
    lastFiniteFocusHelp: "Last finite focus — drag to exit ∞",
    focusNearDetailButton: "Focus Near Detail",
    focusFarDetailButton: "Focus Far Detail",
    focusNearDetailAria: "focus-near-detail",
    focusFarDetailAria: "focus-far-detail",
    cameraMovementTitle: "Camera Movement",
    cameraMovementIntro: "Explore viewpoint and standard movements continuously.",
    viewpointTitle: "Viewpoint",
    viewpointCopy: "Move the whole camera lower or higher while keeping the standards neutral.",
    viewpointLower: "Lower",
    viewpointNeutral: "Neutral",
    viewpointHigher: "Higher",
    viewpointPositionsLabel: "Viewpoint positions",
    tiltTitle: "Tilt",
    tiltCopy: "Tilt the front or rear standard while the camera remains at the neutral viewpoint.",
    standardLabel: "Standard",
    tiltStandardGroupLabel: "Tilt standard",
    tiltNegative: "Negative",
    tiltZero: "Zero",
    tiltPositive: "Positive",
    tiltNegativeValue: "negative",
    tiltPositiveValue: "positive",
    tiltPositionsLabel: "Tilt positions",
    verticalFramingTitle: "Vertical Framing",
    verticalFramingControlLabel: "Vertical framing",
    verticalFramingCopy: "Move the front or rear standard vertically to frame a lower or higher part of the subject.",
    verticalFramingGroupLabel: "Vertical framing standard",
    verticalFramingLower: "Lower",
    verticalFramingMiddle: "Middle",
    verticalFramingUpper: "Upper",
    verticalFramingPositionsLabel: "Vertical framing positions",
    viewpointValueNeutral: "Neutral viewpoint",
    viewpointValueHigher: "Higher viewpoint",
    viewpointValueLower: "Lower viewpoint",
    viewpointValueTowardHigher: "{{percent}}% toward higher viewpoint",
    viewpointValueTowardLower: "{{percent}}% toward lower viewpoint",
    tiltValueZero: "{{standard}}, zero tilt",
    tiltValueSigned: "{{standard}}, {{direction}} {{degrees}} degrees",
    framingValue: "{{standard}}, {{position}} framing",
    framingValueToward: "{{standard}}, {{percent}}% toward {{position}} framing",
    frontTiltValue: "Front tilt",
    rearTiltValue: "Rear tilt",
    framingUpperValue: "upper",
    framingMiddleValue: "middle",
    framingLowerValue: "lower",
    framingUpperStatus: "Upper framing",
    framingMiddleStatus: "Middle framing",
    framingLowerStatus: "Lower framing",
    cameraPosition: "Camera Position",
    cameraPositionDirection: "Camera Position direction",
    frontShift: "Front Shift",
    frontShiftDirection: "Front Shift direction",
    left: "Left",
    right: "Right",
    mirrorShiftTopViewAria: "Mirror Shift top-view teaching geometry",
    mirrorAperture: "Mirror aperture",
    current: "Current",
    mirrorCentreChiefRay: "Mirror-centre chief ray",
    topViewAxes: "Top view · X lateral · Z optical depth",
    neutralReference: "Neutral reference",
    currentCamera: "Current camera",
    stateFilm: "{{state}} film",
    stateLens: "{{state}} lens",
    focusFixedReason: "Focus is fixed for this lesson",
    apertureFixedReason: "Aperture is fixed for this lesson",
    infinityReset: "Infinity Reset",
    cameraControls: "Camera Controls",
  },
  viewport: {
    allScenes: "All Scenes",
    bodyLabel: "Simulator body",
    groundGlassColumnLabel: "GroundGlassColumn",
    sceneTitle: "3D Scene",
    groundGlassTitle: "Ground Glass",
    geometryTitle: "2D Geometry",
    sceneViewReset: "Reset 3D view",
    sceneViewFocusLabel: "View Focus",
    sceneViewFocusScene: "Scene",
    sceneViewFocusCamera: "Camera",
    renderQualityLabel: "Render quality",
    renderQualityHigh: "High",
    renderQualityStandard: "Standard",
    renderQualityLow: "Low",
    expandGeometry: "Expand 2D Geometry",
    restoreGeometry: "Restore 2D Geometry",
    expandScene: "Expand 3D Scene",
    restoreScene: "Restore 3D Scene",
    expandGroundGlass: "Expand Ground Glass",
    restoreGroundGlass: "Restore Ground Glass",
    groundGlassViewportLabel: "GroundGlassViewport",
    previewLabel: "Ground Glass preview",
    preview: "Preview",
    rawGroundGlass: "Raw Ground Glass",
    uprightAssist: "Upright Assist",
    focusLoupe: "Focus loupe · 4×",
    groundGlassGridScaleCue: "Grid: {{size}} per square",
    viewOptions: "View Options",
    comparisonHeading: "Original and Current Ground Glass comparison",
    comparisonDescription: "Compare the neutral camera with the selected movement.",
    comparisonRegion: "Original and Current Ground Glass comparison",
    originalLabel: "Original",
    currentLabel: "Current",
    originalGroundGlass: "Original Ground Glass",
    currentGroundGlass: "Current Ground Glass",
    zoomIn: "Zoom in",
    pan: "Pan",
    resetView: "Reset view",
    resetAction: "Reset",
    viewOverlays: "View overlays",
    overlaysGroup: "3D overlays",
    overlayAction: "{{action}} {{label}}",
    show: "Show",
    hide: "Hide",
    focusPlaneOverlay: "Focus plane",
    dofOverlay: "DOF region",
    legendsOverlay: "Legends",
    opticalGeometryOverlay: "Optical geometry",
    scheimpflugConstructionOverlay: "Scheimpflug construction",
    webglUnavailable: "WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.",
    retryLoadScene: "Retry loading scene",
    sceneLoadFailed: "Scene load failed",
    sceneAssetLoadFailedPrefix: "Failed to load scene assets for",
    unknownScenePrefix: "Unknown scene",
    opticsFallbackPrefix: "Optics fallback active",
    scheimpflugConstructionNote:
      "Film (blue), lens (slate), and sharp-focus (green) planes contain the violet Scheimpflug line. Open the Scheimpflug Section to view that line end-on.",
    scheimpflugReasonParallel: "Film and lens planes are parallel.",
    scheimpflugReasonNoFocus: "A finite plane of sharp focus is unavailable.",
    scheimpflugReasonNonFiniteIntersection: "The plane intersection produced non-finite geometry.",
    scheimpflugReasonNonFiniteResidual: "The construction residuals are non-finite.",
    scheimpflugReasonInvalidFocusPlane: "The focus plane does not contain the film/lens intersection line.",
  },
  geometry: {
    macroSpecimenTarget: "Specimen coin",
    macroDepthNearTarget: "Near detail",
    macroDepthMiddleTarget: "Middle detail",
    macroDepthFarTarget: "Far detail",
    macroObliqueNearTarget: "Near planar detail",
    macroObliqueMiddleTarget: "Middle planar detail",
    macroObliqueFarTarget: "Far planar detail",
    viewLabel: "Geometry view",
    framingLabel: "Geometry framing",
    side: "Side",
    top: "Top",
    scheimpflugSection: "Scheimpflug Section",
    fitScene: "Fit Scene",
    fitConstruction: "Fit Construction",
    constructionAndSubjectRelationship: "Scheimpflug construction and subject relationship",
    sideView: "Side view",
    topView: "Top view",
    perpendicularScheimpflugSection: "Perpendicular Scheimpflug section",
    cameraConstructionHeading: "Camera-side Scheimpflug construction — enlarged",
    continuesToSubjectField: "continues to subject field",
    subjectField: "Subject field",
    opticalAxisAndFov:
      "Dotted amber: image-side construction lines from the film edges to the lens centre. Solid amber: object-side FOV boundary rays from the lens centre along the film-edge directions. Dashed amber: optical axis (lens normal). Dark dashed amber: chief ray from film centre through lens centre; it may be off-axis when the centres are displaced.",
    constructionScaleNote: "Each labelled region uses its own linear scale. The enlarged camera construction continues to the true-distance subject field.",
    scheimpflugValidNote: "Film, lens and focus planes meet along one line. This section views that line end-on.",
    scheimpflugZeroNote: "At zero tilt and swing the film and lens planes are parallel. Apply a movement to reveal their common Scheimpflug line and perpendicular section.",
    opticalDepthOrder: "Optical depth order",
    film: "Film",
    lens: "Lens",
    focus: "Focus",
    filmDatum: "Film datum",
    lensPlane: "Lens plane",
    focusPlane: "Focus plane",
    dofLimit: "DOF limit",
    farDof: "Far DOF",
    opticalAxis: "Optical axis",
    focusTargets: "Focus targets",
    scheimpflugIntersection: "Scheimpflug intersection",
    filmPlaneExtended: "Film plane (extended)",
    lensPlaneExtended: "Lens plane (extended)",
    sharpFocusPlaneExtended: "Plane of sharp focus (extended)",
    opticalAxisLabel: "Optical axis",
    focusPlaneLabel: "Focus plane",
    referenceState: "reference",
    currentState: "current",
    filmPlaneAria: "film plane",
    lensPlaneAria: "lens plane",
    focusPlaneAria: "focus plane",
    nearDofPlaneAria: "nearDof plane",
    farDofPlaneAria: "farDof plane",
    filmEdgeLensConstructionAria: "image-side construction line from a film edge to the lens centre",
    fovBoundaryRayAria: "FOV boundary ray from a film edge through the lens centre",
    chiefRayAria: "chief ray from film centre through lens centre",
    cameraBodyRail: "Camera body rail",
    bellowsConnector: "Simplified bellows connector",
    tabletopGuide: "Tabletop",
    diagonalSubjectPlaneGuide: "Diagonal subject plane",
    targetFacadeDepthGuide: "Target façade depth",
    architectureForegroundGroundGuide: "Foreground ground",
    architectureForegroundBuildingGuide: "Building profile",
    nearCardTarget: "Near card",
    middleNotebookTarget: "Middle notebook",
    farChartTarget: "Far chart",
    frontChartTarget: "Front chart",
    middleChartTarget: "Middle chart",
    backChartTarget: "Back chart",
    nearDetailTarget: "Near detail",
    farDetailTarget: "Far detail",
    targetFallback: "Target",
    nearFacadeTarget: "Near façade",
    middleFacadeTarget: "Middle façade",
    farFacadeTarget: "Far façade",
    architectureForegroundNearTarget: "Near foreground",
    architectureForegroundMiddleTarget: "Middle foreground",
    architectureForegroundBuildingBaseTarget: "Building base",
    architectureForegroundBuildingMiddleTarget: "Building middle",
    architectureRiseBuildingMidFacadeTarget: "Building mid facade",
    obliqueTabletopNearLeftTarget: "Near left",
    obliqueTabletopNearCentreTarget: "Near centre",
    obliqueTabletopNearRightTarget: "Near right",
    obliqueTabletopMiddleTarget: "Middle",
    obliqueTabletopFarLeftTarget: "Far left",
    obliqueTabletopFarCentreTarget: "Far centre",
    obliqueTabletopFarRightTarget: "Far right",
    interiorCornerRecedingWallGuide: "Receding side wall",
    obliqueTabletopNearFarGuide: "Subject board · near ↔ far",
    obliqueTabletopLeftRightGuide: "Subject board · left ↔ right",
    obliqueTabletopSideView:
      "Side view · inspect how Front Tilt changes the near-to-far component of the one focus plane.",
    obliqueTabletopTopView:
      "Top view · inspect how Front Swing changes the left-to-right component of the same focus plane.",
    obliqueTabletopScheimpflugView:
      "Scheimpflug view · film, lens, and one plane of sharp focus meet in a single 3D construction.",
    obliqueTabletopNeutralFeedback:
      "The subject board and current focus plane disagree in more than one direction.",
    obliqueTabletopTiltFeedback:
      "Front Tilt changes the near-to-far relationship. Compare the focus plane with the subject board before adding Swing.",
    obliqueTabletopSwingFeedback:
      "Front Swing changes the left-to-right relationship. Compare it with the near-to-far component.",
    obliqueTabletopCompoundFeedback:
      "Tilt and Swing are changing two directional components of the same three-dimensional focus plane.",
    interiorCornerNearWallTarget: "Near wall detail",
    interiorCornerMiddleWallTarget: "Middle wall detail",
    interiorCornerFarWallTarget: "Far wall detail",
  },
  sceneLegend: {
    filmPlane: "Film plane (blue)",
    lensPlane: "Lens plane (slate)",
    focusPlane: "Focus plane (green)",
    dofLimit: "DOF limit (blue)",
    farDof: "Far DOF (violet)",
    fovRays: "FOV rays (amber)",
    opticalAxis: "Optical axis",
  },
  focusOverlay: {
    preview: "Ground glass preview",
    infinity: "∞ focus",
    lastFinite: "Last finite focus: {{distance}}",
  },
  movementHelp: {
    button: "Help",
    title: "Movement help",
    close: "Close help",
    rise:
      "Front Rise moves the lens standard vertically to change framing without moving the whole-camera viewpoint.",
    tilt:
      "Front Tilt rotates the lens standard in the vertical/depth relationship, rotating the plane of sharp focus through depth.",
    swing:
      "Front Swing rotates the lens standard in the horizontal/depth relationship, rotating the plane of sharp focus across subjects arranged diagonally in depth.",
  },
  freePractice: {
    generic: {
      objective: "Explore the scene without a scored task.",
      observation:
        "Changes are reflected immediately in the 3D Scene, Ground Glass, and learner readouts.",
    },
    macroBellowsExtension: {
      objective: "Reach life-size reproduction (1:1) using Focus Distance and observe the bellows extension that makes it possible.",
      bullets: {
        focus: "Reduce Focus Distance from the starting point toward 300 mm to bring the selected focus plane toward the specimen.",
        grid: "Use the Ground Glass grid, labelled 1 cm per square, as a simple size reference.",
        consequences: "Watch magnification, required lens-to-film extension, bellows factor, and exposure compensation rise together.",
        capacity: "Bellows extension is the lens-to-film distance; real cameras may need an extension rail or added bellows when their available travel runs out.",
      },
      observation: "Move Focus Distance closer to see the rear standard extend and the selected focus-plane ratio increase.",
      title: "1:1 reproduction study",
      labels: {
        goal: "Goal",
        try: "Try",
        observe: "Observe",
        whyItMatters: "Why it matters",
      },
      goal: "Reach life-size reproduction of the specimen. At 1:1, its image on the film is the same size as the real subject.",
      try: "Move Focus Distance closer, from the initial macro setting toward 300 mm. If the Ground Glass becomes difficult to see, open the aperture while focusing.",
      observe: "Compare the specimen with the 1 cm Ground Glass grid and watch the rear standard move as the bellows extends. Opening the aperture makes the focusing view brighter without changing the reproduction geometry.",
      whyItMatters: "A view camera reaches high reproduction ratios by increasing lens-to-film distance. That also increases magnification and the bellows-factor exposure cost; opening the aperture helps you focus but does not remove that cost.",
      stages: {
        early: {
          title: "Early close focus",
          try: "Move Focus Distance closer to increase the reproduction ratio. If the Ground Glass becomes difficult to see, open the aperture while focusing.",
          observe: "The selected focus plane is still well behind the specimen. At {{magnification}} ({{ratio}}), its focused reproduction is smaller; move it closer and watch the bellows extend.",
          whyItMatters: "Closer focusing moves the film farther from the lens: more extension produces more magnification and a larger bellows-factor exposure cost. If the Ground Glass is dim, open the aperture to focus more easily; this changes viewing brightness, not the reproduction geometry.",
        },
        intermediate: {
          title: "Approaching life size",
          try: "Continue reducing Focus Distance and compare the specimen with the 1 cm Ground Glass grid. Open the aperture if the dim view makes focusing difficult.",
          observe: "The selected focus plane is approaching life size as it moves toward the specimen. At {{magnification}} ({{ratio}}), its focused reproduction is growing; required extension is {{extension}} and the bellows-factor exposure implication is now significant.",
          whyItMatters: "The causal chain is cumulative: closer focus → more extension → higher magnification → more exposure compensation. A wider aperture makes focusing easier, but it does not change the focus geometry or remove the bellows-factor exposure cost.",
        },
        nearLifeSize: {
          title: "Near life size",
          try: "Move through the last steps toward 1:1 and compare a known feature with one grid square; open the aperture for a brighter focusing view if needed.",
          observe: "The selected focus plane is very close to life size and nearly coincident with the specimen. Its focused ratio is {{ratio}} ({{magnification}}); compare the specimen with the calibrated 1 cm grid.",
          whyItMatters: "At high magnification, extension becomes substantial. Opening the aperture only improves the focusing view; beyond a camera's available travel, a real setup may need an extension rail or additional bellows.",
        },
        lifeSize: {
          title: "Life-size reproduction reached",
          try: "Pause at 1:1 and compare a 1 cm subject feature with one 1 cm Ground Glass square. Open the aperture if you need a clearer view while focusing.",
          observe: "The specimen is now sharply reproduced at 1:1. Its 90 mm diameter spans about nine 10 mm squares on the Ground Glass. Required extension is {{extension}}, with a {{factor}} bellows factor and {{stops}} exposure compensation.",
          whyItMatters: "View cameras reach life size by extending the lens-to-film distance. The extra extension still costs exposure; photographers often focus with the lens opened wide, then choose the working aperture before exposure. Greater magnification may require an extension rail or added bellows in real use.",
        },
      },
      capacityWarning: "Required extension ({{extension}}) is approaching the {{availableTravel}} of available bellows travel shown here. Many real cameras would need additional extension beyond their built-in travel.",
    },
    macroDepthOfField: {
      title: "Three-dimensional macro depth-of-field study",
      labels: {
        goal: "Goal",
        try: "Try",
        observe: "Observe",
        whyItMatters: "Why it matters",
      },
      goal: "Explore how difficult it is to keep a three-dimensional subject sharp at macro distance.",
      regions: {
        near: "Near detail",
        middle: "Middle detail",
        far: "Far detail",
      },
      listSeparator: ", ",
      stages: {
        wideOpen: {
          title: "Move the sharp zone",
          try: "Keep the aperture wide open at {{aperture}} and move Focus Distance from the Near detail to the Middle and Far details.",
          observe: "The {{focusedRegion}} is currently strongest. Only a narrow region is sharp; use Focus Distribution to watch the emphasis move through the subject.",
          whyItMatters: "At macro distance, depth of field is extremely shallow. Refocusing moves which depth is centered on the focus plane; it does not increase total depth of field.",
        },
        beginStoppingDown: {
          title: "Begin stopping down",
          try: "Return focus toward the Middle detail, then close the aperture to {{aperture}}.",
          observe: "The {{focusedRegion}} remains centered while the outer regions begin to improve: Near {{nearStatus}}, Middle {{middleStatus}}, Far {{farStatus}}.",
          whyItMatters: "Changing Focus relocates the sharp zone. Stopping down reduces actual blur away from the focus plane, so more depth falls within the same acceptable-sharpness range. The Ground Glass also becomes darker.",
        },
        moderateStoppingDown: {
          title: "A wider usable zone",
          try: "Keep focus near the Middle detail and compare {{aperture}} with the wider settings.",
          observe: "Stopping down has expanded usable depth around the {{focusedRegion}}: Near {{nearStatus}}, Middle {{middleStatus}}, Far {{farStatus}}.",
          whyItMatters: "More of the mechanism is usable, but a separated three-dimensional subject can still exceed what aperture alone can solve. Focus and aperture solve different parts of the problem.",
        },
        minimumAperture: {
          title: "Aperture has a limit",
          try: "At {{aperture}}, inspect all three target regions before deciding whether the whole subject is sharp.",
          observe: "At {{aperture}}, {{softRegions}} remain Soft. Depth of field is much greater than at f/5.6, but the full subject is not uniformly sharp.",
          observeAllSharp: "At {{aperture}}, all three target regions currently meet the physical presentation threshold. Keep checking the individual metrics rather than assuming every macro subject will behave this way.",
          whyItMatters: "Stopping down helps, but aperture alone cannot always cover a deep three-dimensional macro subject. If important details approximately share an oblique plane, a later movement lesson can explore aligning the focus plane rather than treating tilt as a cure for arbitrary depth.",
        },
      },
    },
    macroObliquePlane: {
      title: "Oblique plane alignment study",
      labels: {
        goal: "Goal",
        try: "Try",
        observe: "Observe",
        whyItMatters: "Why it matters",
      },
      goal: "Align the sharp-focus plane with the oblique PCB using Front Tilt and Focus Distance.",
      regions: {
        near: "Near region",
        middle: "Middle region",
        far: "Far region",
      },
      stages: {
        parallelExploration: {
          title: "Explore with a parallel focus plane",
          try: "Keep Front Tilt at 0° and move Focus Distance through the Near, Middle, and Far PCB details.",
          observe: "The {{strongestRegion}} is currently strongest. Near is {{nearStatus}}, Middle is {{middleStatus}}, and Far is {{farStatus}}. Refocusing moves the sharp region, but it cannot make this oblique plane all Sharp at once.",
          whyItMatters: "Focus Distance positions the plane of sharp focus. With Front Tilt at zero, its orientation stays parallel to the film, so it cannot follow the PCB's slope.",
        },
        tiltAndFocus: {
          title: "Use Tilt and Focus together",
          try: "Apply a small positive Front Tilt, then refocus. Compare the Ground Glass, Focus Distribution, and Scheimpflug Section.",
          observe: "Near is {{nearStatus}}, Middle is {{middleStatus}}, and Far is {{farStatus}}. The {{strongestRegion}} is currently strongest; the sharp-focus plane is rotating toward the PCB.",
          whyItMatters: "Front Tilt changes the orientation of the sharp-focus plane; Focus Distance positions that rotated plane. In the Scheimpflug construction, the lens plane, film plane, and sharp-focus plane meet along a common line.",
        },
        refineAlignment: {
          title: "Refine the alignment",
          try: "Use small 0.1° Tilt and 10 mm Focus steps while watching the {{weakestRegion}} region.",
          observe: "Two PCB regions are Sharp; the {{weakestRegion}} region is still {{weakestStatus}} and limits the alignment.",
          whyItMatters: "A nearly correct orientation still needs the focus plane positioned correctly. Refine both controls while watching the physical target metrics.",
        },
        aligned: {
          title: "Plane aligned",
          try: "Inspect all three PCB zones and compare the Ground Glass, Focus Distribution, and Scheimpflug Section.",
          observe: "Near, Middle, and Far are all Sharp at Front Tilt {{tilt}} and Focus Distance {{focus}}.",
          whyItMatters: "The important PCB details share one oblique plane. Aligning the sharp-focus plane solves this planar subject without increasing depth of field. Tilt is powerful when details share a plane, not a general solution for arbitrary 3D subjects; a subject that also recedes sideways may need Swing.",
        },
      },
    },
    understanding: {
      objective:
        "Compare whole-camera viewpoint movement with Front and Rear standard movements, and observe which image relationships change.",
      bullets: {
        viewpoint:
          "Move Viewpoint lower and higher with the standards neutral. Watch perspective relationships, parallax, and visible subject surfaces change as the whole camera moves.",
        tilt:
          "Return to the neutral viewpoint, then compare Front and Rear Tilt. Front Tilt changes lens-plane orientation; Rear Tilt changes film-plane orientation, so their image consequences are not interchangeable.",
        verticalFraming:
          "Compare Front and Rear Vertical Framing. The whole-camera viewpoint stays fixed while the selected standard moves vertically.",
        compare:
          "Use the 3D camera geometry and Ground Glass together. Ask what physically moved, what stayed fixed, and what changed in the image.",
      },
      observation:
        "Whole-camera Viewpoint movement changes perspective relationships and parallax. Front or Rear standard movement keeps the whole-camera viewpoint fixed. Compare the Ground Glass and camera geometry to see which relationship each movement changes.",
    },
    focusFundamentals: {
      objective:
        "Explore Front and Rear focusing across two depths of the same object at fixed f/11.",
      bullets: {
        focusDistance: "Move focus between the near and far detail.",
        readouts: "Watch the white near gate and far pointer.",
        compare:
          "Compare Front focusing, which changes their image alignment, with Rear focusing, which keeps them aligned.",
      },
      observation:
        "Watch the white near gate and far pointer as Front and Rear focusing change their image alignment.",
    },
    architectureRise: {
      objective:
        "Explore how Front Rise changes framing while the camera remains level and the whole-camera viewpoint stays fixed.",
      bullets: {
        rise: "Increase Front Rise to include more of the building.",
        level:
          "Keep the camera body and intended film-plane orientation level; watch the parallel verticals.",
        focus:
          "Adjust Focus and Aperture to compare sharpness and depth of field.",
      },
      observation:
        "Watch the top of the building as Front Rise changes. Framing moves while the whole-camera viewpoint stays fixed and the intended verticals remain parallel.",
    },
    architectureForeground: {
      objective:
        "Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph.",
      bullets: {
        framing: "At neutral, notice that the roof is cropped while the building base remains in frame.",
        rise: "Increase Front Rise to include the roof while keeping the camera level and the verticals parallel.",
        tilt: "Use Front Tilt to rotate the plane of sharp focus toward the foreground-to-building depth.",
        focus: "Adjust Focus to place that plane through the near foreground and the useful building reference.",
        aperture: "Stop down Aperture to expand usable depth around the already-aligned focus plane.",
      },
      observation:
        "Front Rise corrects framing without changing perspective or the parallel verticals. Front Tilt changes focus-plane orientation and Focus places it; Aperture then expands usable depth around that plane while the remaining depth of field stays finite.",
    },
    interiorCorner: {
      objective:
        "Explore the neutral Interior Corner setup before solving its framing and receding-wall focus problems.",
      bullets: {
        framing:
          "Notice that the camera is level, but the upper moulding is cropped or uncomfortably close to the top edge.",
        rise:
          "Use Front Rise to move the framing upward without pitching the camera upward.",
        depth:
          "Follow the same side wall from its nearer artwork through the middle and far details.",
        focus:
          "At f/5.6, use Front Swing to turn the focus plane toward the receding wall, then refine Focus to place it through the near, middle, and far details.",
      },
      observation:
        "The room remains level while the upper architecture presses against the frame. The three details on one receding wall sit at different distances, making the Rise and receding-wall Front Swing + Focus problems visible.",
      riseComposition: {
        needsAdjustmentStatus: "Rise composition needs adjustment",
        readyStatus: "Rise composition is acceptable",
        needsAdjustment:
          "Keep the camera level. The upper architecture is still too close to the top edge; use Front Rise to move the framing upward.",
        ready:
          "The upper architecture is now inside a safer frame while the room corner remains usable. The camera remains level.",
      },
      focusAlignment: {
        openApertureRequiredStatus: "Use the open aperture for focus alignment",
        misalignedStatus: "Receding-wall focus needs adjustment",
        refineFocusStatus: "Refine receding-wall focus",
        alignedStatus: "Receding-wall focus is acceptable",
        openApertureRequired:
          "Keep f/5.6 while checking the receding wall; Aperture is a later finishing step.",
        misaligned:
          "At f/5.6, the receding wall spans different depths. Focus alone cannot hold the near, middle, and far details together; use Front Swing, then refine Focus.",
        refineFocus:
          "The receding wall is not yet consistently sharp. Front Swing changes focus-plane orientation; refine Focus to place it through the wall.",
        aligned:
          "The near, middle, and far details on the receding side wall are acceptably sharp at f/5.6. The opposite wall remains contextual.",
      },
    },
    obliqueArchitecture: {
      objective:
        "Explore Front Rise, Front Swing, and Focus while keeping the rear standard level in an oblique architectural view.",
      bullets: {
        level: "The level camera keeps the building verticals parallel on the Ground Glass.",
        framing: "Increase Front Rise to include the building top while keeping the base inside the frame.",
        depth: "Use Front Swing and Focus to align the plane of sharp focus across the near, middle, and far windows.",
      },
      observation:
        "Front Rise changes framing and Front Swing rotates the lens/focus plane. Compare the Ground Glass and Top geometry while the rear standard preserves parallel verticals.",
    },
    tableTilt: {
      objective:
        "Use Front Tilt and Focus to align the plane of sharp focus with the three coplanar focus cards above the tabletop.",
      bullets: {
        focus:
          "At 0° Front Tilt, move Focus from the near card through the middle notebook to the far chart.",
        tilt:
          "Apply positive Front Tilt and watch the plane of sharp focus rotate through the focus-card surfaces.",
        patches:
          "Refine Focus until all three patches—not only their centre points—are covered.",
        aperture:
          "Compare f/11 and f/22, but do not rely on f/32 to solve the exercise.",
      },
      observation:
        "Front Tilt rotates the plane of sharp focus through the tabletop arrangement. Compare the geometry, Ground Glass sharpness, depth-of-field bounds, and Focus Targets readout as you refine Tilt and Focus.",
    },
    shelfSwing: {
      objective:
        "Use Front Swing and Focus to align the plane of sharp focus with subjects arranged diagonally in depth.",
      bullets: {
        start:
          "Begin near 0° Swing and move Focus through the subjects to see that their different depths do not become sharp together.",
        geometry:
          "Apply Front Swing and watch the plane of sharp focus rotate in the Top geometry view.",
        refine:
          "Refine Focus after changing Swing so the plane of sharp focus passes through the diagonal subject arrangement.",
        compare:
          "Compare the geometry, Ground Glass sharpness, and relevant learner readouts rather than relying on one indicator alone.",
      },
      observation:
        "Without Swing, changing Focus moves sharpness between subject depths. Front Swing rotates the plane of sharp focus through the diagonal arrangement. Compare the Top geometry view and Ground Glass as you refine Swing and Focus.",
    },
    obliqueTabletop: {
      objective:
        "Use Front Tilt, Front Swing, and Focus to align the inclined subject board at fixed f/11.",
      bullets: {
        focusDistance:
          "Start at neutral and compare the near, middle, and far subject-board details.",
        tilt:
          "Use Front Tilt to improve the board's near-to-far focus alignment.",
        refocus:
          "Refine Focus after changing either movement.",
        remaining:
          "Add Front Swing to resolve the remaining side-to-side difference and compare details across the board.",
        geometry:
          "Use the Side and Top geometry views together: they show two components of one three-dimensional focus plane.",
      },
      observation:
        "Front Tilt improves the board's near-to-far focus relationship. Front Swing resolves the remaining side-to-side difference; refine Focus after either movement and compare details across the board. The two movements do not create two focus planes; together they orient one plane in 3D.",
    },
    mirrorShift: {
      objective:
        "Separate viewpoint from framing: move the whole camera sideways, then use opposite Front Shift to restore the mirror framing without returning the camera to its original viewpoint.",
      bullets: {
        position:
          "Move Camera Position sideways until the camera reflection moves clear of the mirror.",
        viewpoint:
          "Leave Camera Position there. The whole-camera viewpoint has now changed.",
        framing:
          "Apply Front Shift in the opposite direction to restore approximately the original mirror framing.",
        parallax:
          "Watch the reflected props and parallax. Restoring the framing does not restore the original viewpoint.",
      },
      observation:
        "Camera Position changes the whole-camera viewpoint and reflected parallax. Front Shift changes framing without returning to the original viewpoint. If the mirror framing looks similar again, compare the reflected props to see that the viewpoint is still different.",
    },
  },
} as const;
