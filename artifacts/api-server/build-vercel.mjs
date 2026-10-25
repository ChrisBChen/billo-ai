// Bundles the Express app into a single self-contained Vercel Function at <repo>/api/index.js.
// Bundling resolves pnpm workspace packages (@workspace/*, shipped as TypeScript) ahead of time.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
  outfile: path.resolve(artifactDir, "../../api/index.js"),
  platform: "node",
  target: "node24",
  bundle: true,
  format: "cjs",
  external: ["pg-native", "pino-pretty"],
  sourcemap: false,
  logLevel: "info",
});
