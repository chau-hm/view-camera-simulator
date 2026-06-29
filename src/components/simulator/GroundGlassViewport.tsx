import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import type { DerivedOpticsState } from "../../types/optics";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
};

export const GroundGlassViewport = ({ opticsState, focusAssistEnabled, gridEnabled }: GroundGlassViewportProps) => (
  <section>
    <h2>Ground Glass</h2>
    <GroundGlassRenderer
      assistEnabled={opticsState.groundGlassProjection.assistModeEnabled}
      focusAssistEnabled={focusAssistEnabled}
      gridEnabled={gridEnabled}
    />
  </section>
);
