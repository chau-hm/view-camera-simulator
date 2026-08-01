import { useCallback, useId } from "react";
import { useAppStore } from "../../state/appStore";
import { useShallow } from "zustand/react/shallow";
import { UI_COPY } from "../../ui/copy";
import {
  CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
  matchCameraMovementTeachingCase,
  type CameraMovementPublicCaseId,
} from "../../scenes/cameraMovementPublicTeaching";

type CaseOption = {
  id: CameraMovementPublicCaseId;
  name: string;
  copy: string;
};

const CASE_OPTIONS: Readonly<Record<CameraMovementPublicCaseId, CaseOption>> = {
  neutral: {
    id: "neutral",
    name: UI_COPY.controls.teachingNeutralLabel,
    copy: UI_COPY.controls.teachingNeutralCopy,
  },
  "A-front-tilt": {
    id: "A-front-tilt",
    name: UI_COPY.controls.teachingAName,
    copy: UI_COPY.controls.teachingACopy,
  },
  "B-rear-tilt": {
    id: "B-rear-tilt",
    name: UI_COPY.controls.teachingBName,
    copy: UI_COPY.controls.teachingBCopy,
  },
  "C1-front-rise": {
    id: "C1-front-rise",
    name: UI_COPY.controls.teachingC1Name,
    copy: UI_COPY.controls.teachingC1Copy,
  },
  "C2-rear-rise": {
    id: "C2-rear-rise",
    name: UI_COPY.controls.teachingC2Name,
    copy: UI_COPY.controls.teachingC2Copy,
  },
  "C3-high-viewpoint": {
    id: "C3-high-viewpoint",
    name: UI_COPY.controls.teachingC3Name,
    copy: UI_COPY.controls.teachingC3Copy,
  },
  "D1-front-fall": {
    id: "D1-front-fall",
    name: UI_COPY.controls.teachingD1Name,
    copy: UI_COPY.controls.teachingD1Copy,
  },
  "D2-rear-fall": {
    id: "D2-rear-fall",
    name: UI_COPY.controls.teachingD2Name,
    copy: UI_COPY.controls.teachingD2Copy,
  },
  "D3-low-viewpoint": {
    id: "D3-low-viewpoint",
    name: UI_COPY.controls.teachingD3Name,
    copy: UI_COPY.controls.teachingD3Copy,
  },
};

type TeachingGroup = {
  heading: string;
  caseIds: readonly CameraMovementPublicCaseId[];
};

const TEACHING_GROUPS: readonly TeachingGroup[] = [
  { heading: UI_COPY.controls.teachingReference, caseIds: ["neutral"] },
  { heading: UI_COPY.controls.teachingTilt, caseIds: ["A-front-tilt", "B-rear-tilt"] },
  {
    heading: UI_COPY.controls.teachingUpward,
    caseIds: ["C1-front-rise", "C2-rear-rise", "C3-high-viewpoint"],
  },
  {
    heading: UI_COPY.controls.teachingDownward,
    caseIds: ["D1-front-fall", "D2-rear-fall", "D3-low-viewpoint"],
  },
];

export const CameraMovementTeachingControls = () => {
  const groupId = useId();
  const explanationId = useId();
  const activeCaseId = useAppStore(
    useShallow((state) => {
      if (state.camera.activeSceneId !== "understanding-camera-movements") {
        return null;
      }
      return matchCameraMovementTeachingCase({
        anchor: state.camera.viewpointAnchor,
        targetRegion: state.scene.targetRegion,
        camera: state.camera,
      });
    }),
  );
  const applyCase = useAppStore((state) => state.applyCameraMovementTeachingCase);

  const handleChange = useCallback(
    (caseId: CameraMovementPublicCaseId) => {
      if (caseId in CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES) {
        applyCase(caseId);
      }
    },
    [applyCase],
  );

  const activeOption = activeCaseId ? CASE_OPTIONS[activeCaseId] : null;

  return (
    <section aria-label={UI_COPY.controls.teachingCaseGroupLabel}>
      <p className="teaching-controls__intro">{UI_COPY.controls.teachingIntro}</p>
      <fieldset
        className="teaching-controls"
        role="radiogroup"
        aria-labelledby={groupId}
      >
        <legend id={groupId}>{UI_COPY.controls.teachingCaseGroupLabel}</legend>
        {TEACHING_GROUPS.map((group) => (
          <div key={group.heading} className="teaching-controls__group">
            <h4 className="teaching-controls__heading">{group.heading}</h4>
            <div className="teaching-controls__grid">
              {group.caseIds.map((caseId) => {
                const option = CASE_OPTIONS[caseId];
                return (
                  <label key={caseId} className="teaching-controls__choice">
                    <input
                      type="radio"
                      name="camera-movement-teaching-case"
                      value={caseId}
                      checked={activeCaseId === caseId}
                      onChange={() => handleChange(caseId)}
                    />
                    <span>{option.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>
      <div
        className="teaching-controls__explanation"
        id={explanationId}
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {activeOption ? (
          <p>
            <strong>{activeOption.name}</strong> — {activeOption.copy}
          </p>
        ) : (
          <p>{UI_COPY.controls.teachingIntro}</p>
        )}
      </div>
    </section>
  );
};
