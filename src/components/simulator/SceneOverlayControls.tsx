import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import {
  getSceneOverlayPresentation,
  type SceneOverlayPresentation,
} from "./sceneOverlayResponsive";

export type SceneOverlayControlsProps = {
  resetGeneration?: number;
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

const OverlayChoice = ({ active, label, onToggle, disabled }: OverlayChoiceProps) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="scene-overlay-controls__button btn btn--compact"
      aria-label={t(simulatorMessageKeys.viewport.overlayAction, {
        action: t(active ? simulatorMessageKeys.viewport.hide : simulatorMessageKeys.viewport.show),
        label,
      })}
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
};

const OverlayChoices = ({
  labelledBy,
  presentation,
  ...props
}: SceneOverlayControlsProps & {
  labelledBy?: string;
  presentation: SceneOverlayPresentation;
}) => {
  const { t } = useTranslation();
  return (
    <div
      className={`scene-overlay-controls scene-overlay-controls--${presentation}`}
      role={presentation === "inline" ? "toolbar" : "group"}
      aria-label={labelledBy ? undefined : t(simulatorMessageKeys.viewport.overlaysGroup)}
      aria-labelledby={labelledBy}
      data-testid={`scene-overlay-${presentation}`}
    >
      <OverlayChoice active={props.showFocusPlane} label={t(simulatorMessageKeys.viewport.focusPlaneOverlay)} onToggle={props.onToggleFocusPlane} />
      <OverlayChoice active={props.showDofRegion} label={t(simulatorMessageKeys.viewport.dofOverlay)} onToggle={props.onToggleDofRegion} />
      <OverlayChoice active={props.showLegends} label={t(simulatorMessageKeys.viewport.legendsOverlay)} onToggle={props.onToggleLegends} />
      <OverlayChoice
        active={props.showOpticalGeometry}
        label={t(simulatorMessageKeys.viewport.opticalGeometryOverlay)}
        onToggle={props.onToggleOpticalGeometry}
      />
      {props.onToggleScheimpflugConstruction ? (
        <OverlayChoice
          active={Boolean(props.showScheimpflugConstruction)}
          label={t(simulatorMessageKeys.viewport.scheimpflugConstructionOverlay)}
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
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
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
    setMenuOpen(false);
  }, [props.resetGeneration]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      className="scene-overlay-responsive"
      data-overlay-presentation={presentation}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (!menuOpen || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }}
    >
      {presentation === "inline" ? (
        <OverlayChoices {...props} presentation="inline" />
      ) : (
        <div className="scene-overlay-menu">
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            className="scene-overlay-menu__trigger btn btn--compact"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">layers</span>
            <span>{t(simulatorMessageKeys.viewport.viewOverlays)}</span>
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
