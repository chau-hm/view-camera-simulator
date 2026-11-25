import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import { dirname, resolve } from "node:path";

export const isGroundGlassM7gRequired = (): boolean =>
  process.env.GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED === "1";

export const groundGlassM7gSourceProvenance = () => ({
  sourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  testInvocation: process.env.GROUND_GLASS_M7G_TEST_INVOCATION ?? "",
  browserProject: "chrome-native-webgpu",
  threePackageVersion: JSON.parse(
    readFileSync(resolve(process.cwd(), "node_modules/three/package.json"), "utf8"),
  ).version as string,
  rendererRevision: "r187",
  nodeVersion: process.version,
  operatingSystem: `${process.platform} ${release()} ${process.arch}`,
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
});

export const writeGroundGlassM7gCapture = (artifactPath: string, value: unknown): void => {
  const evidenceDirectory = process.env.GROUND_GLASS_M7G_CAPTURE_DIR;
  if (!isGroundGlassM7gRequired() || !evidenceDirectory) return;
  const outputPath = resolve(process.cwd(), evidenceDirectory, artifactPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(value, null, 2));
};
