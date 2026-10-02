import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cwd, execPath } from "node:process";
import { describe, expect, it } from "vitest";

const repositoryRoot = cwd();
const guardPath = resolve(repositoryRoot, "scripts/dream-loop/guard.mjs");
const pilotIds = ["architecture-rise", "interior-corner"] as const;
const manifestPath = (pilotId: (typeof pilotIds)[number]) =>
  resolve(repositoryRoot, "scripts/dream-loop/pilots", pilotId + ".json");

const createGitFixture = async () => {
  const repository = await mkdtemp(join(tmpdir(), "vcs-dream-loop-guard-"));
  await mkdir(join(repository, "src/render"), { recursive: true });
  await mkdir(join(repository, "src/core"), { recursive: true });
  await mkdir(join(repository, "src/scenes/presentation"), { recursive: true });
  await writeFile(join(repository, ".gitignore"), ".dream-loop/\n");
  await writeFile(
    join(repository, "src/render/ArchitectureRiseSubjectFactory.tsx"),
    "export const appearance = 'baseline';\n",
  );
  await writeFile(
    join(repository, "src/render/InteriorCornerSubjectFactory.tsx"),
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

const runGuard = (
  repository: string,
  pilotId: (typeof pilotIds)[number],
  baseline: string,
) =>
  spawnSync(execPath, [guardPath, "--pilot", pilotId, "--base", baseline], {
    cwd: repository,
    encoding: "utf8",
  });

const withGitFixture = async (
  pilotId: (typeof pilotIds)[number],
  run: (repository: string, baseline: string, pilotId: (typeof pilotIds)[number]) => Promise<void>,
) => {
  const { repository, baseline } = await createGitFixture();
  try {
    await run(repository, baseline, pilotId);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
};

describe("Dream Loop pilot guard", () => {
  it.each(pilotIds)(
    "defines the selected scene, asset, capture surface, and regression views: %s",
    async (pilotId) => {
      const manifest = JSON.parse(await readFile(manifestPath(pilotId), "utf8")) as {
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

      expect(manifest.pilotId).toBe(pilotId);
      expect(manifest.sceneId).toBe(pilotId);
      expect(manifest.assetKey).toBe(pilotId + "-subject");
      expect(manifest.optimizationSurface).toEqual({
        id: "observer-scene-viewport",
        route: "/simulator/free/" + pilotId,
        sceneSelector: '[data-testid="scene-canvas"]',
        canvasSelector: "canvas",
      });
      expect(manifest.implementationPath).toContain("SubjectFactory.tsx");
      expect(manifest.writeScope.allowedPaths).toEqual([
        manifest.implementationPath,
        ".dream-loop/**",
      ]);
      expect(manifest.capture.outputPath.startsWith(".dream-loop/" + pilotId + "/")).toBe(true);
      expect(manifest.capture.teachingOutputPath.startsWith(".dream-loop/" + pilotId + "/")).toBe(true);
      expect(manifest.verificationViews).toContainEqual({
        id: "observer",
        role: "optimization-target",
      });
      expect(manifest.verificationViews).toContainEqual({
        id: "ground-glass-raw",
        role: "regression-only",
      });
      expect(manifest.verificationViews).toContainEqual({
        id: "ground-glass-upright",
        role: "regression-only",
      });
      if (pilotId === "interior-corner") {
        expect(manifest.writeScope.protectedPaths).toContain(
          "src/render/ProceduralSurfaceMaterials.ts",
        );
        expect(manifest.writeScope.protectedPaths).toContain("src/render/TeachingLighting.tsx");
        expect(manifest.writeScope.protectedPaths).toContain("src/scenes/**");
      }
    },
  );

  it.each(pilotIds)(
    "accepts only the selected asset path and ignored Dream Loop working files: %s",
    async (pilotId) => {
      await withGitFixture(pilotId, async (repository, baseline, selectedPilotId) => {
        const factoryPath = selectedPilotId === "architecture-rise"
          ? "ArchitectureRiseSubjectFactory.tsx"
          : "InteriorCornerSubjectFactory.tsx";
        await writeFile(
          join(repository, "src/render", factoryPath),
          "export const appearance = 'visual-only iteration';\n",
        );
        await mkdir(join(repository, ".dream-loop"), { recursive: true });
        await writeFile(join(repository, ".dream-loop/target.png"), "working target");
        execFileSync("git", ["check-ignore", "-q", ".dream-loop/target.png"], {
          cwd: repository,
          stdio: "ignore",
        });

        const result = runGuard(repository, pilotId, baseline);
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
    await withGitFixture("interior-corner", async (repository, baseline) => {
      await writeFile(join(repository, path), "export const protectedValue = 'changed';\n");

      const result = runGuard(repository, "interior-corner", baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(result.stderr).toContain("No files were modified or restored");
    });
  });

  it("detects untracked forbidden files and leaves them untouched", async () => {
    await withGitFixture("interior-corner", async (repository, baseline) => {
      const path = "src/core/new-simulation-rule.ts";
      const contents = "export const accidentalSimulationChange = true;\n";
      await writeFile(join(repository, path), contents);

      const result = runGuard(repository, "interior-corner", baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(await readFile(join(repository, path), "utf8")).toBe(contents);
    });
  });
});
