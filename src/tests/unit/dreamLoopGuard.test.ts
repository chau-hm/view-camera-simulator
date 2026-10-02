import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cwd, execPath } from "node:process";
import { describe, expect, it } from "vitest";

const repositoryRoot = cwd();
const guardPath = resolve(repositoryRoot, "scripts/dream-loop/guard.mjs");

const architectureRisePilot = {
  pilotId: "architecture-rise",
  sceneId: "architecture-rise",
  assetKey: "architecture-rise-subject",
  implementationPath: "src/render/ArchitectureRiseSubjectFactory.tsx",
  route: "/simulator/free/architecture-rise",
  capture: {
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    renderQuality: "standard",
    outputPath: ".dream-loop/architecture-rise/observer-clean.png",
    teachingOutputPath: ".dream-loop/architecture-rise/observer-teaching.png",
  },
  verificationViews: [
    { id: "observer", role: "optimization-target" },
    { id: "ground-glass-raw", role: "regression-only" },
    { id: "ground-glass-upright", role: "regression-only" },
  ],
} as const;

const interiorCornerPilot = {
  pilotId: "interior-corner",
  sceneId: "interior-corner",
  assetKey: "interior-corner-subject",
  implementationPath: "src/render/InteriorCornerSubjectFactory.tsx",
  route: "/simulator/free/interior-corner",
  capture: {
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    renderQuality: "standard",
    outputPath: ".dream-loop/interior-corner/observer-clean.png",
    teachingOutputPath: ".dream-loop/interior-corner/observer-teaching.png",
  },
  verificationViews: [
    { id: "observer", role: "optimization-target" },
    { id: "observer-teaching", role: "regression-only" },
    { id: "ground-glass-processed", role: "regression-only" },
    { id: "ground-glass-raw", role: "regression-only" },
    { id: "ground-glass-upright", role: "regression-only" },
  ],
} as const;

const expectedPilots = [architectureRisePilot, interiorCornerPilot] as const;
type ExpectedPilot = (typeof expectedPilots)[number];
type PilotId = ExpectedPilot["pilotId"];

const manifestPath = (pilotId: PilotId) =>
  resolve(repositoryRoot, "scripts/dream-loop/pilots", `${pilotId}.json`);

const createGitFixture = async () => {
  const repository = await mkdtemp(join(tmpdir(), "vcs-dream-loop-guard-"));
  await mkdir(join(repository, "src/render"), { recursive: true });
  await mkdir(join(repository, "src/core"), { recursive: true });
  await mkdir(join(repository, "src/scenes/presentation"), { recursive: true });
  await writeFile(join(repository, ".gitignore"), ".dream-loop/\n");
  await writeFile(
    join(repository, architectureRisePilot.implementationPath),
    "export const appearance = 'baseline';\n",
  );
  await writeFile(
    join(repository, interiorCornerPilot.implementationPath),
    "export const appearance = 'baseline';\n",
  );
  await writeFile(
    join(repository, "src/render/ProceduralSurfaceMaterials.ts"),
    "export const materialPattern = 'baseline';\n",
  );
  await writeFile(join(repository, "src/core/optics.ts"), "export const optics = 'baseline';\n");
  await writeFile(
    join(repository, "src/scenes/presentation/architectureRise.ts"),
    "export const presentation = 'baseline';\n",
  );
  await writeFile(
    join(repository, "src/scenes/presentation/interiorCorner.ts"),
    "export const presentation = 'baseline';\n",
  );
  execFileSync("git", ["init", "--quiet"], { cwd: repository, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Dream Loop Guard Test"], {
    cwd: repository,
    stdio: "ignore",
  });
  execFileSync("git", ["config", "user.email", "dream-loop-guard@example.invalid"], {
    cwd: repository,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "-A"], { cwd: repository, stdio: "ignore" });
  execFileSync("git", ["commit", "--quiet", "-m", "baseline"], {
    cwd: repository,
    stdio: "ignore",
  });
  const baseline = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repository,
    encoding: "utf8",
  }).trim();
  return { repository, baseline };
};

const runGuard = (repository: string, pilotId: PilotId, baseline: string) =>
  spawnSync(execPath, [guardPath, "--pilot", pilotId, "--base", baseline], {
    cwd: repository,
    encoding: "utf8",
  });

const withGitFixture = async (
  pilot: ExpectedPilot,
  run: (repository: string, baseline: string, pilot: ExpectedPilot) => Promise<void>,
) => {
  const { repository, baseline } = await createGitFixture();
  try {
    await run(repository, baseline, pilot);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
};

describe("Dream Loop pilot guard", () => {
  it.each(expectedPilots)(
    "defines the selected scene, asset, capture surface, and regression views: $pilotId",
    async (expected) => {
      const manifest = JSON.parse(await readFile(manifestPath(expected.pilotId), "utf8")) as {
        pilotId: string;
        sceneId: string;
        assetKey: string;
        implementationPath: string;
        optimizationSurface: {
          id: string;
          route: string;
          sceneSelector: string;
          canvasSelector: string;
        };
        capture: { outputPath: string; teachingOutputPath: string };
        writeScope: { allowedPaths: string[]; protectedPaths: string[] };
        verificationViews: Array<{ id: string; role: string }>;
      };

      expect(manifest.pilotId).toBe(expected.pilotId);
      expect(manifest.sceneId).toBe(expected.sceneId);
      expect(manifest.assetKey).toBe(expected.assetKey);
      expect(manifest.implementationPath).toBe(expected.implementationPath);
      expect(manifest.optimizationSurface).toEqual({
        id: "observer-scene-viewport",
        route: expected.route,
        sceneSelector: '[data-testid="scene-canvas"]',
        canvasSelector: "canvas",
      });
      expect(manifest.capture).toEqual(expected.capture);
      expect(manifest.writeScope.allowedPaths).toEqual([
        expected.implementationPath,
        ".dream-loop/**",
      ]);
      expect(manifest.verificationViews).toEqual(expected.verificationViews);
      if (expected.pilotId === "interior-corner") {
        expect(manifest.writeScope.protectedPaths).toContain(
          "src/render/ProceduralSurfaceMaterials.ts",
        );
        expect(manifest.writeScope.protectedPaths).toContain("src/render/TeachingLighting.tsx");
        expect(manifest.writeScope.protectedPaths).toContain("src/scenes/**");
      }
    },
  );

  it.each(expectedPilots)(
    "accepts only the selected asset path and ignored Dream Loop working files: $pilotId",
    async (pilot) => {
      await withGitFixture(pilot, async (repository, baseline, selectedPilot) => {
        await writeFile(
          join(repository, selectedPilot.implementationPath),
          "export const appearance = 'visual-only iteration';\n",
        );
        await mkdir(join(repository, ".dream-loop"), { recursive: true });
        await writeFile(join(repository, ".dream-loop/target.png"), "working target");
        execFileSync("git", ["check-ignore", "-q", ".dream-loop/target.png"], {
          cwd: repository,
          stdio: "ignore",
        });

        const result = runGuard(repository, selectedPilot.pilotId, baseline);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("guard passed");
      });
    },
  );

  it.each([
    "src/core/optics.ts",
    "src/scenes/presentation/interiorCorner.ts",
    "src/render/ProceduralSurfaceMaterials.ts",
  ])("rejects tracked paths outside the selected visual surface: %s", async (path) => {
    await withGitFixture(interiorCornerPilot, async (repository, baseline, pilot) => {
      await writeFile(join(repository, path), "export const protectedValue = 'changed';\n");

      const result = runGuard(repository, pilot.pilotId, baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(result.stderr).toContain("No files were modified or restored");
    });
  });

  it("detects untracked forbidden files and leaves them untouched", async () => {
    await withGitFixture(interiorCornerPilot, async (repository, baseline, pilot) => {
      const path = "src/core/new-simulation-rule.ts";
      const contents = "export const accidentalSimulationChange = true;\n";
      await writeFile(join(repository, path), contents);

      const result = runGuard(repository, pilot.pilotId, baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(await readFile(join(repository, path), "utf8")).toBe(contents);
    });
  });
});
