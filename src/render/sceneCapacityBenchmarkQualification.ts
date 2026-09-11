export type GraphicsBackendQualificationInput = {
  renderer: string | null | undefined;
  profilingBackend: string | null | undefined;
  timingUnit: string | null | undefined;
};

export type GraphicsBackendQualification = {
  softwareRendererDetected: boolean;
  hardwareRendererQualified: boolean;
  gpuTimingQualified: boolean;
};

const KNOWN_SOFTWARE_RENDERER_PATTERNS = [
  /swiftshader/i,
  /llvmpipe/i,
  /software\s+rasterizer/i,
  /microsoft\s+basic\s+render\s+driver/i,
] as const;

export const classifyGraphicsBackend = ({
  renderer,
  profilingBackend,
  timingUnit,
}: GraphicsBackendQualificationInput): GraphicsBackendQualification => {
  const rendererName = renderer?.trim() ?? "";
  const softwareRendererDetected = KNOWN_SOFTWARE_RENDERER_PATTERNS.some((pattern) =>
    pattern.test(rendererName),
  );

  return {
    softwareRendererDetected,
    hardwareRendererQualified: rendererName.length > 0 && !softwareRendererDetected,
    gpuTimingQualified:
      rendererName.length > 0 &&
      !softwareRendererDetected &&
      profilingBackend === "gpu-query" &&
      timingUnit === "gpu-ms",
  };
};
