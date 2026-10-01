import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cwd, execPath } from "node:process";
import { describe, expect, it } from "vitest";

const repositoryRoot = cwd();
const guardPath = resolve(repositoryRoot, "scripts/dream-loop/guard.mjs");
const manifestPath = resolve(
  repositoryRoot,
  "scripts/dream-loop/pilots/architecture-rise.json",
);

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
  await writeFile(join(repository, "src/core/optics.ts"), "export const optics = 'baseline';\n");
  await writeFile(
    join(repository, "src/scenes/presentation/architectureRise.ts"),
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

const runGuard = (repository: string, baseline: string) =>
  spawnSync(execPath, [guardPath, "--pilot", "architecture-rise", "--base", baseline], {
    cwd: repository,
    encoding: "utf8",
  });

const withGitFixture = async (
  run: (repository: string, baseline: string) => Promise<void>,
) => {
  const { repository, baseline } = await createGitFixture();
  try {
    await run(repository, baseline);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
};

describe("Architecture Rise Dream Loop guard", () => {
  it("defines the intended scene, registered asset, observer target, and regression views", async () => {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      pilotId: string;
      sceneId: string;
      assetKey: string;
      optimizationSurface: { id: string; route: string; sceneSelector: string; canvasSelector: string };
      writeScope: { allowedPaths: string[]; protectedPaths: string[] };
      verificationViews: Array<{ id: string; role: string }>;
    };

    expect(manifest).toMatchObject({
      pilotId: "architecture-rise",
      sceneId: "architecture-rise",
      assetKey: "architecture-rise-subject",
      optimizationSurface: {
        id: "observer-scene-viewport",
        route: "/simulator/free/architecture-rise",
        sceneSelector: '[data-testid="scene-canvas"]',
        canvasSelector: "canvas",
      },
    });
    expect(manifest.writeScope.allowedPaths).toContain(
      "src/render/ArchitectureRiseSubjectFactory.tsx",
    );
    expect(manifest.writeScope.protectedPaths).toContain("src/scenes/**");
    expect(manifest.verificationViews).toEqual([
      { id: "observer", role: "optimization-target" },
      { id: "ground-glass-raw", role: "regression-only" },
      { id: "ground-glass-upright", role: "regression-only" },
    ]);
  });

  it("accepts the permitted asset path and ignored Dream Loop working files", async () => {
    await withGitFixture(async (repository, baseline) => {
      await writeFile(
        join(repository, "src/render/ArchitectureRiseSubjectFactory.tsx"),
        "export const appearance = 'visual-only iteration';\n",
      );
      await mkdir(join(repository, ".dream-loop"), { recursive: true });
      await writeFile(join(repository, ".dream-loop/target.png"), "working target");
      execFileSync("git", ["check-ignore", "-q", ".dream-loop/target.png"], {
        cwd: repository,
        stdio: "ignore",
      });

      const result = runGuard(repository, baseline);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("guard passed");
    });
  });

  it.each([
    "src/core/optics.ts",
    "src/scenes/presentation/architectureRise.ts",
  ])("rejects tracked semantic path changes: %s", async (path) => {
    await withGitFixture(async (repository, baseline) => {
      await writeFile(join(repository, path), "export const protectedValue = 'changed';\n");

      const result = runGuard(repository, baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(result.stderr).toContain("No files were modified or restored");
    });
  });

  it("detects untracked forbidden files and leaves them untouched", async () => {
    await withGitFixture(async (repository, baseline) => {
      const path = "src/core/new-simulation-rule.ts";
      const contents = "export const accidentalSimulationChange = true;\n";
      await writeFile(join(repository, path), contents);

      const result = runGuard(repository, baseline);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(path);
      expect(await readFile(join(repository, path), "utf8")).toBe(contents);
    });
  });
});
