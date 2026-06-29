import type { DerivedOpticsState } from "../../types/optics";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
};

export const GeometryViewport = ({ opticsState }: GeometryViewportProps) => (
  <section>
    <h2>2D Geometry</h2>
    <p>Tilt: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}°</p>
    <p>Swing: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°</p>
  </section>
);
