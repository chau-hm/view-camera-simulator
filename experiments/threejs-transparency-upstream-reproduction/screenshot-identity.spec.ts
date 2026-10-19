import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  captureKey,
  claimScreenshotPath,
  screenshotRelativePath,
  verifyScreenshotManifest,
  type CaptureIdentity,
} from "./screenshotIdentity.js";

const standard: CaptureIdentity = {
  version: "r186",
  backend: "webgl",
  output: "stock",
  fixture: "F1",
  family: "standard",
  opacity: 0.5,
  background: "light",
};

test("canonical screenshot identity separates all capture dimensions and rejects path reuse", async () => {
  const standardPath = screenshotRelativePath(standard);
  const basicPath = screenshotRelativePath({ ...standard, family: "basic" });
  expect(standardPath).toContain("r186-G-F1-standard-light-o0.50.png");
  expect(basicPath).toContain("r186-G-F1-basic-light-o0.50.png");
  expect(basicPath).not.toBe(standardPath);

  const rendererPaths = [
    screenshotRelativePath(standard),
    screenshotRelativePath({ ...standard, backend: "webgpu" }),
    screenshotRelativePath({ ...standard, backend: "webgpu", output: "material-aware" }),
  ];
  expect(new Set(rendererPaths).size).toBe(3);

  const versionPaths = (["r184", "r185", "r186"] as const)
    .map((version) => screenshotRelativePath({ ...standard, version }));
  expect(new Set(versionPaths).size).toBe(3);

  const opacityPaths = [0.16, 0.5, 1]
    .map((opacity) => screenshotRelativePath({ ...standard, opacity }));
  expect(new Set(opacityPaths).size).toBe(3);
  expect(opacityPaths).toEqual(expect.arrayContaining([
    expect.stringContaining("o0.16.png"),
    expect.stringContaining("o0.50.png"),
    expect.stringContaining("o1.00.png"),
  ]));

  const backgroundPaths = (["light", "dark", "transparent", "clear"] as const)
    .map((background) => screenshotRelativePath({ ...standard, background }));
  expect(new Set(backgroundPaths).size).toBe(4);

  expect(screenshotRelativePath(standard)).toBe(screenshotRelativePath({ ...standard }));
  const claims = new Map<string, string>();
  claimScreenshotPath(claims, standardPath, standard);
  expect(() => claimScreenshotPath(claims, standardPath, { ...standard, background: "dark" }))
    .toThrow(/collision.*r186\/webgl\/stock\/F1\/standard\/0\.50\/light.*r186\/webgl\/stock\/F1\/standard\/0\.50\/dark/i);
  expect(() => claimScreenshotPath(new Map(), standardPath, { ...standard, family: "basic" }))
    .toThrow(/canonical identity/);
});

test("screenshot manifest requires the claimed identity and a current-run artifact", async () => {
  const identity = { ...standard };
  const captureKeyValue = captureKey(identity);
  const screenshotPath = screenshotRelativePath(identity);
  const claims = new Map([[screenshotPath, captureKeyValue]]);
  const root = await mkdtemp(path.join(os.tmpdir(), "m-inv10-screenshot-identity-"));
  try {
    const manifest = [{ captureKey: captureKeyValue, screenshotPath, identity }];
    await expect(verifyScreenshotManifest(manifest, claims, root)).rejects.toThrow(/missing current-run artifact/);
    const output = path.resolve(root, screenshotPath);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, "current run PNG placeholder");
    await expect(verifyScreenshotManifest(manifest, claims, root)).resolves.toBeUndefined();
    await expect(verifyScreenshotManifest(
      [{ ...manifest[0]!, screenshotPath: `${screenshotPath}.missing` }],
      claims,
      root,
    )).rejects.toThrow(/identity does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
