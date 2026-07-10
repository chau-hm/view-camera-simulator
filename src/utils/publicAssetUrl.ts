export const publicAssetUrl = (path: string): string => {
  const normalizedPath = path.replace(/^\/+/, "");
  // import.meta.env.BASE_URL is provided by Vite and points to the configured base (e.g., '/view-camera-simulator/')
  // Ensure it ends with a slash so concatenation is safe
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}${normalizedPath}`;
};
