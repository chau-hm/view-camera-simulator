import { spawn } from "node:child_process";

const filteredArgs = process.argv.slice(2).filter((arg) => arg !== "--runInBand" && arg !== "-i");

const child = spawn("vitest", ["run", ...filteredArgs], {
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }

  process.exit(code ?? 1);
});
