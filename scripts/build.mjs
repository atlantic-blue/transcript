import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

// The attestation program needs a browser, so jsdom travels in the bundle. Only canvas is left out:
// jsdom loads it if it is there, and this page draws nothing.
const result = await build({
  entryPoints: ["src/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/index.js",
  external: ["canvas"],
  conditions: ["import", "default"],
  metafile: true,
  legalComments: "none",
  logLevel: "warning",
});

// jsdom resolves this worker by path when it loads, so bundling the code is not enough: the file has
// to sit beside the bundle or the function dies at the first require.
const worker = require_.resolve("jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js");
copyFileSync(worker, "dist/xhr-sync-worker.js");

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
console.log(`bundle: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`worker: ${statSync("dist/xhr-sync-worker.js").size} bytes`);

// The repository is a module package, so without this the runtime reads a CommonJS bundle named
// .js as a module and dies on the first export. The zip carries this file.
writeFileSync("dist/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
console.log("dist/package.json: type commonjs");
