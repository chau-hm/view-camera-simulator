import { DiagramLegend, PlaneLine, PointMarker, RayLine, Region } from "../geometry/DiagramPrimitives";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
  geometryView: GeometryView;
  scene: SceneDefinition;
};

const SVG_WIDTH = 460;
const SVG_HEIGHT = 280;

export const GeometryViewport = ({ opticsState, geometryView, scene }: GeometryViewportProps) => (
  <section>
    <h2>{UI_COPY.simulator.geometryTitle}</h2>
    <p>
      {geometryView === "side" ? "Side view" : "Top view"} | {UI_COPY.simulator.tiltLabel}:{" "}
      {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | {UI_COPY.simulator.swingLabel}:{" "}
      {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
    </p>
    <svg
      data-testid={`geometry-svg-${geometryView}`}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#f8fafc" }}
    >
      <Region
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        nearPlane={opticsState.depthOfFieldNearPlane}
        farPlane={opticsState.depthOfFieldFarPlane}
        fill="#8b5cf6"
        label="DOF"
      />
      <PlaneLine
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        plane={opticsState.filmPlane}
        label="Film"
        stroke="#0284c7"
      />
      <PlaneLine
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        plane={opticsState.lensPlane}
        label="Lens"
        stroke="#475569"
      />
      <PlaneLine
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        plane={opticsState.focusPlane}
        label="Focus"
        stroke="#16a34a"
        dashed
      />
      <RayLine
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        start={opticsState.lensCenterWorld}
        end={opticsState.focusPointWorld}
        label="Optical axis"
        stroke="#f59e0b"
      />
      <PointMarker
        view={geometryView}
        bounds={scene.bounds}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        point={opticsState.focusPointWorld}
        label="Focus point"
        fill="#dc2626"
      />
      {opticsState.lensFilmHingeLine && (
        <PointMarker
          view={geometryView}
          bounds={scene.bounds}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          point={opticsState.lensFilmHingeLine.point}
          label="Hinge"
          fill="#7c3aed"
        />
      )}
      {scene.focusTargets.map((target) => (
        <PointMarker
          key={target.id}
          view={geometryView}
          bounds={scene.bounds}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          point={target.worldPosition}
          label={target.id}
          fill="#0f766e"
        />
      ))}
    </svg>
    <DiagramLegend />
  </section>
);
