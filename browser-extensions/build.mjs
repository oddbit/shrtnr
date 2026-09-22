// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0
//
// Builds the browser extension for chrome and firefox targets.
//
//   node build.mjs --target=chrome
//   node build.mjs --target=firefox
//   node build.mjs --target=all
//   node build.mjs --target=chrome --watch
//
// Outputs:
//   dist/<target>/         unpacked extension, loadable for development
//   dist/<target>.zip      store-ready archive (skipped in --watch mode)

import esbuild from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const ASSETS = path.join(ROOT, "assets");
const MANIFESTS = path.join(ROOT, "manifests");
const DIST = path.join(ROOT, "dist");

const TARGETS = ["chrome", "firefox"];

function parseArgs(argv) {
  const out = { target: "all", watch: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--target=")) out.target = arg.slice("--target=".length);
    else if (arg === "--watch") out.watch = true;
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function copyFile(src, dst) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}

async function buildEntries(target, outdir, watch) {
  const entryPoints = {
    background: path.join(SRC, "background.ts"),
    popup: path.join(SRC, "popup", "index.tsx"),
    options: path.join(SRC, "options", "index.tsx"),
  };

  const options = {
    entryPoints,
    bundle: true,
    outdir,
    format: "esm",
    target: ["chrome120", "firefox140"],
    platform: "browser",
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    jsx: "automatic",
    jsxImportSource: "preact",
    loader: { ".css": "css" },
    define: {
      "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
      "process.env.EXT_TARGET": JSON.stringify(target),
    },
    logLevel: "info",
  };

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    return ctx;
  } else {
    await esbuild.build(options);
    return null;
  }
}

async function copyStaticFiles(outdir) {
  const popupSrc = path.join(SRC, "popup");
  const optionsSrc = path.join(SRC, "options");

  await copyFile(path.join(popupSrc, "popup.html"), path.join(outdir, "popup.html"));
  await copyFile(path.join(optionsSrc, "options.html"), path.join(outdir, "options.html"));

  const assetsOut = path.join(outdir, "assets");
  await fs.mkdir(assetsOut, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await copyFile(
      path.join(ASSETS, `icon-${size}.png`),
      path.join(assetsOut, `icon-${size}.png`),
    );
  }
}

async function buildManifest(target, outdir) {
  const base = await readJson(path.join(MANIFESTS, "base.json"));
  const overrides = await readJson(path.join(MANIFESTS, `${target}.json`));
  const pkg = await readJson(path.join(ROOT, "package.json"));
  base.version = pkg.version;
  const merged = { ...base, ...overrides };
  await writeJson(path.join(outdir, "manifest.json"), merged);
}

async function rmDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

async function zipDir(srcDir, zipPath) {
  await fs.rm(zipPath, { force: true });
  await new Promise((resolve, reject) => {
    const proc = spawn("zip", ["-rq", zipPath, "."], { cwd: srcDir, stdio: "inherit" });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`zip exited ${code}`))));
    proc.on("error", reject);
  });
}

async function buildTarget(target, watch) {
  const outdir = path.join(DIST, target);
  if (!watch) {
    await rmDir(outdir);
  }
  await fs.mkdir(outdir, { recursive: true });

  const ctx = await buildEntries(target, outdir, watch);
  await copyStaticFiles(outdir);
  await buildManifest(target, outdir);

  if (!watch) {
    const zipPath = path.join(DIST, `${target}.zip`);
    await zipDir(outdir, zipPath);
    console.log(`✓ ${target}: ${path.relative(ROOT, outdir)} + ${path.relative(ROOT, zipPath)}`);
  } else {
    console.log(`watching: ${target}`);
  }
  return ctx;
}

async function main() {
  const args = parseArgs(process.argv);
  const targets = args.target === "all" ? TARGETS : [args.target];
  for (const t of targets) {
    if (!TARGETS.includes(t)) {
      throw new Error(`unknown target: ${t}`);
    }
  }
  if (args.watch && targets.length > 1) {
    throw new Error("--watch supports a single target only");
  }
  const contexts = [];
  for (const target of targets) {
    const ctx = await buildTarget(target, args.watch);
    if (ctx) contexts.push(ctx);
  }
  if (args.watch) {
    process.on("SIGINT", async () => {
      for (const ctx of contexts) await ctx.dispose();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
