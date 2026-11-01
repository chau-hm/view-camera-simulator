import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { release } from "node:os";
import { dirname, resolve } from "node:path";

export const isGroundGlassM7fRequired = (): boolean =>
  process.env.GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED === "1";

export const groundGlassM7fSourceProvenance = () => ({
  sourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  testInvocation: process.env.GROUND_GLASS_M7F_TEST_INVOCATION ?? "",
  browserProject: "",
  threePackageVersion: JSON.parse(readFileSync(resolve(process.cwd(), "node_modules/three/package.json"), "utf8")).version as string,
  rendererRevision: "r187",
  nodeVersion: process.version,
  operatingSystem: `${process.platform} ${release()} ${process.arch}`,
});

export const groundGlassM7fCaptureProvenance = () => ({
  ...groundGlassM7fSourceProvenance(),
  browserProject: "chrome-native-webgpu",
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
});

/** Persist a native capture only for the explicit M7F qualification run. */
export const writeGroundGlassM7fCapture = (
  artifactPath: string,
  value: unknown,
): void => {
  const evidenceDirectory = process.env.GROUND_GLASS_M7F_EVIDENCE_DIR;
  if (!isGroundGlassM7fRequired() || !evidenceDirectory) return;
  const outputPath = resolve(process.cwd(), evidenceDirectory, artifactPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(value, null, 2));
};
