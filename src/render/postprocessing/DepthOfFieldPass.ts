export type DepthOfFieldPassConfig = {
  enabled: boolean;
};

export const createDepthOfFieldPass = (config: DepthOfFieldPassConfig): DepthOfFieldPassConfig =>
  config;
