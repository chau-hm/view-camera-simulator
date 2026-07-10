import { spawn } from "node:child_process";

const includeE2E = process.argv.includes("--with-e2e");

const steps = [
  { name: "CSS structure check", command: "npm", args: ["run", "check:css"] },
  { name: "Lint", command: "npm", args: ["run", "lint"] },
  { name: "Type-check", command: "npm", args: ["run", "typecheck"] },
  { name: "Unit and integration tests", command: "npm", args: ["run", "test"] },
  { name: "Build", command: "npm", args: ["run", "build"] },
];

if (includeE2E) {
  steps.push({ name: "E2E tests", command: "npm", args: ["run", "test:e2e"] });
}

const runStep = (step) =>
  new Promise((resolve, reject) => {
    process.stdout.write(`\n==> ${step.name}\n`);

    const child = spawn(step.command, step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${step.name} failed with exit code ${code ?? 1}`));
    });
  });

for (const step of steps) {
  await runStep(step);
}

process.stdout.write("\n✅ Local CI workflow passed.\n");
