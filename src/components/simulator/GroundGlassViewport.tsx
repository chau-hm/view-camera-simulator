import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import type { ApertureValue } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import { UI_COPY } from "../../ui/copy";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
};

export const GroundGlassViewport = ({
  opticsState,
  focusAssistEnabled,
  gridEnabled,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
}: GroundGlassViewportProps) => (
  <section>
    <h2>{UI_COPY.simulator.groundGlassTitle}</h2>
    <GroundGlassRenderer
      opticsState={opticsState}
      assistEnabled={opticsState.groundGlassProjection.assistModeEnabled}
      focusAssistEnabled={focusAssistEnabled}
      gridEnabled={gridEnabled}
      riseMm={riseMm}
      tiltDeg={tiltDeg}
      swingDeg={swingDeg}
      focusDistanceMm={focusDistanceMm}
      aperture={aperture}
    />
  </section>
);
