import type { TaskDefinition } from "../../types/task";
import architectureGeometry from "../../scenes/architectureRiseGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";

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
  title: "Align the diagonal focus plane with swing",
  objective:
    "Use negative front swing and focus to align the plane of sharp focus through all three diagonal charts.",
  mode: "guided",
  enabledControls: ["swing", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "swing-only",
    notes: [
      "Focus on the middle chart first, then apply negative front swing to rotate the plane of sharp focus through the front, middle and back charts.",
      "Keep rise and tilt at zero. Solve the lesson at f/11 or f/22 rather than relying on f/32.",
    ],
  },
  criteria: [
    {
      id: "swing-allowed-aperture",
      label: "Aperture is f/11 or f/22",
      type: "allowed-aperture",
      allowedApertures: [11, 22],
    },
    {
      id: "swing-rise-zero",
      label: "Rise remains at 0 mm",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "swing-tilt-zero",
      label: "Tilt remains at 0°",
      type: "movement-range",
      movement: "tilt",
      min: 0,
      max: 0,
    },
    {
      id: "swing-movement-range",
      label: `Swing remains within ${shelfSwingGeometry.shelfSwingCalibration.allowedSwingMinDeg.toFixed(1)}° to ${shelfSwingGeometry.shelfSwingCalibration.allowedSwingMaxDeg.toFixed(1)}°`,
      type: "movement-range",
      movement: "swing",
      min: shelfSwingGeometry.shelfSwingCalibration.allowedSwingMinDeg,
      max: shelfSwingGeometry.shelfSwingCalibration.allowedSwingMaxDeg,
      valueMode: "signed",
    },
    {
      id: "swing-front-sharp",
      label: "Front target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-front"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
    {
      id: "swing-middle-sharp",
      label: "Middle target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-middle"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
    {
      id: "swing-back-sharp",
      label: "Back target is sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-back"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
  ],
  feedbackRules: {
    passPrimary:
      "Great. Negative front swing rotated the plane of sharp focus through all three diagonal charts.",
    defaultFailPrimary:
      "Focus on the middle chart, apply negative front swing, then refine focus until all three charts are sharp.",
    failPrimaryByCriterionId: {
      "swing-allowed-aperture":
        "Solve this at f/11 or f/22. Do not rely on f/32 to hide an incorrect focus plane.",
      "swing-rise-zero": "Return Rise to 0 mm; this lesson is solved with swing and focus.",
      "swing-tilt-zero":
        "Return Tilt to 0°; tilt changes the vertical focus relationship and is not part of this lesson.",
      "swing-movement-range": `Use negative front swing near ${shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg.toFixed(1)}°. Positive swing rotates the focus plane in the opposite direction.`,
      "swing-front-sharp":
        "The focus plane has not reached the front chart. Keep negative swing and refine focus.",
      "swing-middle-sharp":
        "Establish sharp focus on the middle chart before refining negative swing.",
      "swing-back-sharp":
        "The focus plane has not extended through the back chart. Refine negative swing and focus.",
    },
    failSecondaryByCriterionId: {
      "swing-allowed-aperture":
        "Use the Top view to judge plane alignment instead of stopping down farther.",
      "swing-rise-zero":
        "In Top view, keep the lens centre on the canonical optical-axis datum.",
      "swing-tilt-zero":
        "This lesson uses the horizontal Top-view relationship; keep Tilt at zero.",
      "swing-movement-range":
        "In Top view, the green focus plane should align with the diagonal subject trace through all three chart markers.",
      "swing-front-sharp":
        "In Top view, check that the green focus plane crosses the Front chart marker.",
      "swing-middle-sharp":
        "Use the Middle chart marker as the initial focusing reference in Top view.",
      "swing-back-sharp":
        "In Top view, extend the green focus plane through the Back chart marker.",
    },
  },
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z,
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
