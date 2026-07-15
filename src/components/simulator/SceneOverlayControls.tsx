import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { UI_COPY } from "../../ui/copy";
import {
  getSceneOverlayPresentation,
  type SceneOverlayPresentation,
} from "./sceneOverlayResponsive";

export type SceneOverlayControlsProps = {
  sceneId?: string;
  showFocusPlane: boolean;
  showDofRegion: boolean;
  showLegends: boolean;
  showOpticalGeometry: boolean;
  showScheimpflugConstruction?: boolean;
  scheimpflugConstructionAvailable?: boolean;
  onToggleFocusPlane: () => void;
  onToggleDofRegion: () => void;
  onToggleLegends: () => void;
  onToggleOpticalGeometry: () => void;
  onToggleScheimpflugConstruction?: () => void;
};

type OverlayChoiceProps = {
  active: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
};

const OverlayChoice = ({ active, label, onToggle, disabled }: OverlayChoiceProps) => (
  <button
    type="button"
    className="scene-overlay-controls__button btn btn--compact"
    aria-label={`${active ? "Hide" : "Show"} ${label}`}
    aria-pressed={active}
    disabled={disabled}
    onClick={onToggle}
  >
    <span aria-hidden="true" className="scene-overlay-controls__check">
      {active ? "✓" : ""}
    </span>
    <span>{label}</span>
  </button>
);

const OverlayChoices = ({
  labelledBy,
  presentation,
  ...props
}: SceneOverlayControlsProps & {
  labelledBy?: string;
  presentation: SceneOverlayPresentation;
}) => {
  const rawFocusBase = UI_COPY.simulator.focusPlaneOverlayLabel.replace(/^Show\s+/i, "");
  const focusBase = `${rawFocusBase.charAt(0).toUpperCase()}${rawFocusBase.slice(1)}`;
  const dofBase = UI_COPY.simulator.dofOverlayLabel.replace(/^Show\s+/i, "");
  return (
    <div
      className={`scene-overlay-controls scene-overlay-controls--${presentation}`}
      role={presentation === "inline" ? "toolbar" : "group"}
      aria-label={labelledBy ? undefined : "3D overlays"}
      aria-labelledby={labelledBy}
      data-testid={`scene-overlay-${presentation}`}
    >
      <OverlayChoice active={props.showFocusPlane} label={focusBase} onToggle={props.onToggleFocusPlane} />
      <OverlayChoice active={props.showDofRegion} label={dofBase} onToggle={props.onToggleDofRegion} />
      <OverlayChoice active={props.showLegends} label="Legends" onToggle={props.onToggleLegends} />
      <OverlayChoice
        active={props.showOpticalGeometry}
        label="Optical geometry"
        onToggle={props.onToggleOpticalGeometry}
      />
      {props.onToggleScheimpflugConstruction ? (
        <OverlayChoice
          active={Boolean(props.showScheimpflugConstruction)}
          label="Scheimpflug construction"
          disabled={
            props.scheimpflugConstructionAvailable === false &&
            !props.showScheimpflugConstruction
          }
          onToggle={props.onToggleScheimpflugConstruction}
        />
      ) : null}
    </div>
  );
};

export const SceneOverlayControls = (props: SceneOverlayControlsProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [presentation, setPresentation] = useState<SceneOverlayPresentation>("collapsed");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const triggerId = useId();

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const update = (width: number) => {
      const next = getSceneOverlayPresentation(width);
      setPresentation(next);
      if (next === "inline") setMenuOpen(false);
    };
    const initialWidth = element.getBoundingClientRect().width;
    if (initialWidth > 0) update(initialWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      if (width > 0) update(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [props.sceneId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      className="scene-overlay-responsive"
      data-overlay-presentation={presentation}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {presentation === "inline" ? (
        <OverlayChoices {...props} presentation="inline" />
      ) : (
        <div className="scene-overlay-menu">
          <button
            id={triggerId}
            type="button"
            className="scene-overlay-menu__trigger btn btn--compact"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">layers</span>
            <span>View overlays</span>
            <span aria-hidden="true">{menuOpen ? "▴" : "▾"}</span>
          </button>
          {menuOpen ? (
            <div id={menuId} className="scene-overlay-menu__panel">
              <OverlayChoices {...props} presentation="collapsed" labelledBy={triggerId} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
