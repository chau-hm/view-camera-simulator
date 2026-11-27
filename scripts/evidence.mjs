#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evidenceCommands } from "./evidence-commands.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [action, ...rest] = process.argv.slice(2);
if (action === "help" || action === "list") {
  console.log("Usage: npm run evidence -- <action> [family] [arguments...]\n\nAvailable operations:\n" + Object.keys(evidenceCommands).sort().map((key) => `  ${key}`).join("\n"));
} else {
  const key = action === "qualify" ? action : `${action ?? ""} ${rest.shift() ?? ""}`;
  const command = Object.hasOwn(evidenceCommands, key) ? evidenceCommands[key] : null;
  if (!command) {
    console.error(`Unknown evidence operation: ${key}. Use 'npm run evidence -- list'.`);
    process.exitCode = 2;
  } else {
    const args = command.map((part) => part.startsWith("./scripts/") ? resolve(root, part) : part);
    const child = spawn(process.execPath, [...args, ...rest], { cwd: root, env: process.env, stdio: "inherit" });
    let interrupted = false;
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => { interrupted = true; child.kill(signal); });
    }
    child.on("error", (error) => { console.error(`Evidence command failed to spawn: ${error.message}`); process.exitCode = 1; });
    child.on("exit", (code, signal) => { process.exitCode = interrupted || signal || code === null ? 1 : code; });
  }
}
