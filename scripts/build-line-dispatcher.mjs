import { build } from "esbuild";
import { resolve } from "node:path";

const workspaceRoot = process.cwd();

await build({
  absWorkingDir: workspaceRoot,
  entryPoints: [resolve(workspaceRoot, "scripts/line-delivery-dispatcher.ts")],
  outfile: resolve(workspaceRoot, "dist/line-delivery-dispatcher.cjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  conditions: ["react-server"],
  logLevel: "info",
});
