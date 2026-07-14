import type { TaskDefinition } from "../../types/task";
import architectureGeometry from "../../scenes/architectureRiseGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";

const riseTask: TaskDefinition = {
  id: "rise-01",
  sceneId: "architecture-rise",
  title: "Lift composition with rise",
  mode: "guided",
  enabledControls: ["rise", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "rise-only",
    notes: ["Use rise without tilt or swing to frame the building top."],
  },
  criteria: [
    {
      id: "rise-building-top-visible",
      label: "Building top visibility is at least 95%",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
    },
    {
      id: "rise-building-main-visible",
      label: "Main building visibility is at least 70%",
      type: "composition-visible",
      targetId: "building-main-body",
      minimumCoverage: 0.7,
    },
    {
      id: "rise-movement-used",
      label: "Rise movement is used",
      type: "movement-used",
      movement: "rise",
      minimumAbs: 12,
    },
    {
      id: "rise-movement-range",
      label: "Rise remains within 12mm to 35mm",
      type: "movement-range",
      movement: "rise",
      min: 12,
      max: 35,
    },
  ],
  feedbackRules: {
    passPrimary: "You used rise to include the building top without tilting the camera body.",
    defaultFailPrimary: "Increase rise while keeping tilt and swing at 0°.",
    failPrimaryByCriterionId: {
      "rise-building-top-visible": "Building top is still clipped. Increase rise further.",
      "rise-building-main-visible":
        "Main building coverage is too low. Reduce excessive rise slightly.",
      "rise-movement-used": "Rise is too low for this composition task.",
      "rise-movement-range": "Keep rise between 12mm and 35mm for this exercise.",
    },
    failSecondaryByCriterionId: {
      "rise-building-top-visible": "Check the ground glass top edge and keep verticals stable.",
      "rise-building-main-visible": "Reframe so the body stays centered while retaining the top.",
      "rise-movement-used": "Start from about 15mm and fine-tune upward.",
      "rise-movement-range": "Avoid solving this by tilt; use rise-only framing.",
    },
  },
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: architectureGeometry.architectureFacadeFocusDistanceMm,
    aperture: 11,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const tiltTask: TaskDefinition = {
  id: "tilt-01",
  sceneId: "table-tilt",
  title: "Align the tabletop focus cards with tilt",
  mode: "guided",
  enabledControls: ["tilt", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "tilt-only",
    notes: [
      "Focus near the middle card first. Then use positive front tilt to rotate the plane of sharp focus until it is parallel to the tabletop and passes through all three coplanar focus cards.",
      "Keep rise and swing at zero. Solve the lesson at f/11 or f/22.",
    ],
  },
  criteria: [
    {
      id: "tilt-allowed-aperture",
      label: "Aperture is f/11 or f/22",
      type: "allowed-aperture",
      allowedApertures: [11, 22],
    },
    {
      id: "tilt-rise-zero",
      label: "Rise remains at 0 mm",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "tilt-swing-zero",
      label: "Swing remains at 0°",
      type: "movement-range",
      movement: "swing",
      min: 0,
      max: 0,
    },
    {
      id: "tilt-movement-range",
      label: `Tilt remains within ${tableTiltGeometry.tableTiltCalibration.allowedTiltMinDeg}° to ${tableTiltGeometry.tableTiltCalibration.allowedTiltMaxDeg}°`,
      type: "movement-range",
      movement: "tilt",
      min: tableTiltGeometry.tableTiltCalibration.allowedTiltMinDeg,
      max: tableTiltGeometry.tableTiltCalibration.allowedTiltMaxDeg,
    },
    {
      id: "tilt-near-sharp",
      label: "Near cup focus card is sharp",
      type: "focus-targets-sharp",
      targetIds: ["near-cup"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
    {
      id: "tilt-mid-sharp",
      label: "Middle notebook line chart is sharp",
      type: "focus-targets-sharp",
      targetIds: ["mid-notebook"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
    {
      id: "tilt-far-sharp",
      label: "Far book focus chart is sharp",
      type: "focus-targets-sharp",
      targetIds: ["far-book"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
  ],
  feedbackRules: {
    passPrimary:
      "Great. Positive front tilt made the plane of sharp focus parallel to the tabletop and aligned it with all three focus cards.",
    defaultFailPrimary:
      "Focus on the middle card, apply positive front tilt, then refine focus across all three focus cards.",
    failPrimaryByCriterionId: {
      "tilt-allowed-aperture": "Do not use f/32. Solve this at f/11 or f/22 with tilt and focus.",
      "tilt-rise-zero": "Return Rise to 0 mm; this lesson is solved with front tilt and focus.",
      "tilt-swing-zero": "Return Swing to 0°; swing cannot align a near-to-far tabletop.",
      "tilt-movement-range": `Use positive front tilt near ${tableTiltGeometry.tableTiltCalibration.frontTiltDeg}° for this calibrated tabletop.`,
      "tilt-near-sharp": "The near cup focus card is soft. Fine-tune focus after setting the calibrated tilt.",
      "tilt-mid-sharp": "The notebook line chart is soft. Refocus around the middle target.",
      "tilt-far-sharp": "The far book chart is soft. Refine focus without adding swing.",
    },
    failSecondaryByCriterionId: {
      "tilt-allowed-aperture": "Compare f/11 and f/22, but do not rely on f/32.",
      "tilt-rise-zero": "The side-view geometry should keep the lens centre at the canonical datum.",
      "tilt-swing-zero": "Watch the top-view readout: Swing must remain zero for this tilt-only task.",
      "tilt-movement-range": "In the side view, the green focus plane should become nearly horizontal across the probe height.",
      "tilt-near-sharp": "Watch the cup focus card in Ground Glass and the near target sharpness readout.",
      "tilt-mid-sharp": "Use the notebook line chart as the initial focusing reference.",
      "tilt-far-sharp": "The far checker chart should sharpen as the focus plane reaches the far focus-card surface.",
    },
  },
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: tableTiltGeometry.canonicalFocusDistanceMm,
    aperture: 11,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const swingTask: TaskDefinition = {
  id: "swing-01",
  sceneId: "shelf-swing",
  title: "Align diagonal focus with swing",
  mode: "guided",
  enabledControls: ["swing", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "swing-only",
    notes: ["Use front swing to align focus along the diagonal shelf."],
  },
  criteria: [
    {
      id: "swing-allowed-aperture",
      label: "Aperture is one of f/5.6, f/11, f/22",
      type: "allowed-aperture",
      allowedApertures: [5.6, 11, 22],
    },
    {
      id: "swing-front-sharp",
      label: "Front target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-front"],
      minimumSharpness: 0.8,
    },
    {
      id: "swing-middle-sharp",
      label: "Middle target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-middle"],
      minimumSharpness: 0.8,
    },
    {
      id: "swing-back-sharp",
      label: "Back target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-back"],
      minimumSharpness: 0.8,
    },
    {
      id: "swing-movement-used",
      label: "Swing is used",
      type: "movement-used",
      movement: "swing",
      minimumAbs: 1.5,
    },
    {
      id: "swing-movement-range",
      label: "Swing remains within 1.5° to 8°",
      type: "movement-range",
      movement: "swing",
      min: 1.5,
      max: 8,
    },
  ],
  feedbackRules: {
    passPrimary: "Great. You used swing to align focus across the diagonal subject layout.",
    defaultFailPrimary: "Adjust swing direction and focus until all shelf targets are sharp.",
    failPrimaryByCriterionId: {
      "swing-allowed-aperture": "Do not use f/32. Solve this with swing and focus.",
      "swing-front-sharp": "Front shelf target is soft. Recheck swing direction and focus.",
      "swing-middle-sharp": "Middle shelf target is soft. Fine-tune swing and focus balance.",
      "swing-back-sharp": "Back shelf target is soft. Increase swing magnitude slightly.",
      "swing-movement-used": "Swing is too small. Increase swing to at least 1.5°.",
      "swing-movement-range": "Swing is outside the guided range (1.5° to 8°).",
    },
    failSecondaryByCriterionId: {
      "swing-allowed-aperture": "Use f/22 or wider and solve with geometry.",
      "swing-front-sharp":
        "Top-view diagram should show focus plane crossing front and mid targets.",
      "swing-middle-sharp": "Keep swing direction consistent with the shelf diagonal.",
      "swing-back-sharp": "Top-view focus plane should extend through the back shelf marker.",
      "swing-movement-used": "Start around 2° swing and tune focus distance.",
      "swing-movement-range": "Excess swing often softens one end of the diagonal.",
    },
  },
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: 3200,
    aperture: 11,
    geometryView: "top",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

export const taskRegistry: Record<string, TaskDefinition> = {
  "rise-01": riseTask,
  "tilt-01": tiltTask,
  "swing-01": swingTask,
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];
