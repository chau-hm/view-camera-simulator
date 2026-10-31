import { build } from "esbuild";
import { resolve } from "node:path";

const root = process.cwd();
const entry = resolve(root, "scripts/replayM7eEvidence.ts");
const bundle = await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  sourcemap: false,
  logLevel: "silent",
});
process.env.GROUND_GLASS_M7E_REPLAY_ARGS = JSON.stringify(process.argv.slice(2));
const moduleSource = Buffer.from(bundle.outputFiles[0].contents).toString("base64");
await import(`data:text/javascript;base64,${moduleSource}`);
