import type { DerivedOpticsState } from "../../types/optics";
import { UI_COPY } from "../../ui/copy";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
};

export const GeometryViewport = ({ opticsState }: GeometryViewportProps) => (
  <section>
    <h2>{UI_COPY.simulator.geometryTitle}</h2>
    <p>
      {UI_COPY.simulator.tiltLabel}: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}°
    </p>
    <p>
      {UI_COPY.simulator.swingLabel}: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
    </p>
  </section>
);
