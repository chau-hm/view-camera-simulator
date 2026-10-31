import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { TestInfo } from "@playwright/test";

/** Attach evidence to Playwright and optionally persist a reviewer-facing native capture. */
export const attachGroundGlassM7dEvidence = async (
  testInfo: TestInfo,
  filename: string,
  evidence: unknown,
): Promise<void> => {
  const body = JSON.stringify(evidence, null, 2);
  await testInfo.attach(filename, { body, contentType: "application/json" });
  const captureDirectory = process.env.GROUND_GLASS_M7D_CAPTURE_DIR;
  if (!captureDirectory) return;
  const directory = resolve(captureDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), body, "utf8");
};
