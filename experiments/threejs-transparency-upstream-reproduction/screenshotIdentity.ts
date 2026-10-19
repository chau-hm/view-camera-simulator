import { access } from "node:fs/promises";
import path from "node:path";

export type Version = "r184" | "r185" | "r186";
export type Backend = "webgl" | "webgpu";
export type Output = "stock" | "material-aware";
export type Fixture = "F0" | "F1" | "F2";
export type Family = "basic" | "standard";
export type Background = "light" | "dark" | "transparent" | "clear";

export type CaptureIdentity = Readonly<{
  version: Version;
  backend: Backend;
  output: Output;
  fixture: Fixture;
  family: Family;
  opacity: number;
  background: Background;
}>;

export type ScreenshotProvenance = Readonly<{
  captureKey: string;
  screenshotPath: string;
  identity: CaptureIdentity;
}>;

export const captureKey = (identity: CaptureIdentity): string => [
  identity.version,
  identity.backend,
  identity.output,
  identity.fixture,
  identity.family,
  identity.opacity.toFixed(2),
  identity.background,
].join("/");

export const rendererMode = ({ backend, output }: Pick<CaptureIdentity, "backend" | "output">): "G" | "W" | "A" =>
  output === "material-aware" ? "A" : backend === "webgl" ? "G" : "W";

export const screenshotRelativePath = (identity: CaptureIdentity): string => {
  const filename = [
    identity.version,
    rendererMode(identity),
    identity.fixture,
    identity.family,
    identity.background,
    `o${identity.opacity.toFixed(2)}`,
  ].join("-") + ".png";
  return path.posix.join("test-results/threejs-transparency-upstream-reproduction", filename);
};

export const claimScreenshotPath = (
  claims: Map<string, string>,
  relativePath: string,
  identity: CaptureIdentity,
): string => {
  const key = captureKey(identity);
  const firstKey = claims.get(relativePath);
  if (firstKey !== undefined) {
    throw new Error(`Retained screenshot path collision at "${relativePath}" between capture identities "${firstKey}" and "${key}"`);
  }
  const expectedPath = screenshotRelativePath(identity);
  if (relativePath !== expectedPath) {
    throw new Error(`Screenshot path does not match its canonical identity: ${relativePath}; expected ${expectedPath}`);
  }
  claims.set(relativePath, key);
  return key;
};

export const verifyScreenshotManifest = async (
  manifest: readonly ScreenshotProvenance[],
  claims: ReadonlyMap<string, string>,
  artifactRoot: string,
): Promise<void> => {
  const paths = manifest.map((entry) => entry.screenshotPath);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Screenshot manifest contains duplicate paths");
  }
  if (paths.length !== claims.size) {
    throw new Error(`Screenshot manifest has ${paths.length} entries but the current run claimed ${claims.size} paths`);
  }

  for (const entry of manifest) {
    const expectedKey = captureKey(entry.identity);
    const expectedPath = screenshotRelativePath(entry.identity);
    if (entry.captureKey !== expectedKey || claims.get(entry.screenshotPath) !== expectedKey) {
      throw new Error(`Screenshot provenance identity does not match its current-run path: ${entry.screenshotPath}`);
    }
    if (entry.screenshotPath !== expectedPath) {
      throw new Error(`Screenshot path does not match its canonical identity: ${entry.screenshotPath}; expected ${expectedPath}`);
    }
    try {
      await access(path.resolve(artifactRoot, entry.screenshotPath));
    } catch {
      throw new Error(`Screenshot provenance points to a missing current-run artifact: ${entry.screenshotPath}`);
    }
  }
};
