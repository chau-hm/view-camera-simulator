import { UI_COPY } from "../../ui/copy";
import { formatPerformanceSample } from "../../utils/performance";

type PerformancePanelProps = {
  movementInputLatencyMs: number | null;
  groundGlassFps: number | null;
  sceneSwitchDurationMs: number | null;
};

export const PerformancePanel = ({
  movementInputLatencyMs,
  groundGlassFps,
  sceneSwitchDurationMs,
}: PerformancePanelProps) => (
  <section aria-label="Performance" style={{ display: "grid", gap: "0.5rem" }}>
    <h2>Performance</h2>
    <p>
      {UI_COPY.performance.movementInputLatencyLabel}:{" "}
      <strong>{formatPerformanceSample(movementInputLatencyMs, "ms")}</strong>
    </p>
    <p>
      {UI_COPY.performance.groundGlassFpsLabel}:{" "}
      <strong>{formatPerformanceSample(groundGlassFps, "FPS")}</strong>
    </p>
    <p>
      {UI_COPY.performance.sceneSwitchDurationLabel}:{" "}
      <strong>{formatPerformanceSample(sceneSwitchDurationMs, "ms")}</strong>
    </p>
  </section>
);
