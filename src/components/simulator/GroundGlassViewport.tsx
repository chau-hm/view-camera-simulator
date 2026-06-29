import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import type { DerivedOpticsState } from "../../types/optics";
import { UI_COPY } from "../../ui/copy";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
};

export const GroundGlassViewport = ({ opticsState, focusAssistEnabled, gridEnabled }: GroundGlassViewportProps) => (
  <section>
    <h2>{UI_COPY.simulator.groundGlassTitle}</h2>
    <GroundGlassRenderer
      assistEnabled={opticsState.groundGlassProjection.assistModeEnabled}
      focusAssistEnabled={focusAssistEnabled}
      gridEnabled={gridEnabled}
    />
  </section>
);
