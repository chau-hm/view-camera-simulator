import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import type { DerivedOpticsState } from "../../types/optics";

type GroundGlassViewportProps = {
  opticsState: DerivedOpticsState;
};

export const GroundGlassViewport = ({ opticsState }: GroundGlassViewportProps) => (
  <section>
    <h2>Ground Glass</h2>
    <GroundGlassRenderer assistEnabled={opticsState.groundGlassProjection.assistModeEnabled} />
  </section>
);
