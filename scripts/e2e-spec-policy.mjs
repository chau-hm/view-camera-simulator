const productionPreviewSpecSuffix = "-production.spec.ts";

export const productionPreviewSpecGlob = `**/*${productionPreviewSpecSuffix}`;

export const isProductionPreviewSpec = (fileName) =>
  fileName.endsWith(productionPreviewSpecSuffix);

export const isDevelopmentE2ESpec = (fileName) =>
  fileName.endsWith(".spec.ts") && !isProductionPreviewSpec(fileName);
