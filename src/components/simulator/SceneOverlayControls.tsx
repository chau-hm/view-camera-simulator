import { UI_COPY } from '../../ui/copy';

export type SceneOverlayControlsProps = {
  showFocusPlane: boolean;
  showDofRegion: boolean;
  showLegends: boolean;
  showOpticalGeometry: boolean;
  onToggleFocusPlane: () => void;
  onToggleDofRegion: () => void;
  onToggleLegends: () => void;
  onToggleOpticalGeometry: () => void;
};

export const SceneOverlayControls = ({
  showFocusPlane,
  showDofRegion,
  showLegends,
  showOpticalGeometry,
  onToggleFocusPlane,
  onToggleDofRegion,
  onToggleLegends,
  onToggleOpticalGeometry,
}: SceneOverlayControlsProps) => {
  const focusBase = UI_COPY.simulator.focusPlaneOverlayLabel.replace(/^Show\s+/i, "");
  const dofBase = UI_COPY.simulator.dofOverlayLabel.replace(/^Show\s+/i, "");

  return (
    <div className="scene-overlay-controls" role="toolbar" aria-label="3D overlays">
      <button
        type="button"
        className="scene-overlay-controls__button btn btn--compact"
        aria-pressed={showFocusPlane}
        onClick={onToggleFocusPlane}
      >
        {showFocusPlane ? `Hide ${focusBase}` : `Show ${focusBase}`}
      </button>

      <button
        type="button"
        className="scene-overlay-controls__button btn btn--compact"
        aria-pressed={showDofRegion}
        onClick={onToggleDofRegion}
      >
        {showDofRegion ? `Hide ${dofBase}` : `Show ${dofBase}`}
      </button>

      <button
        type="button"
        className="scene-overlay-controls__button btn btn--compact"
        aria-pressed={showLegends}
        onClick={onToggleLegends}
      >
        {showLegends ? UI_COPY.simulator.hideLegends : UI_COPY.simulator.showLegends}
      </button>

      <button
        type="button"
        className="scene-overlay-controls__button btn btn--compact"
        aria-pressed={showOpticalGeometry}
        onClick={onToggleOpticalGeometry}
      >
        {showOpticalGeometry ? UI_COPY.simulator.hideOpticalGeometry : UI_COPY.simulator.showOpticalGeometry}
      </button>
    </div>
  );
};
