import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages project sites serve from /<repo-name>/, not the domain
  // root, so every asset URL needs that prefix. Set dynamically by the
  // deploy workflow (.github/workflows/deploy.yml) from the actual repo
  // name, rather than hardcoded here — a repo rename or fork then just
  // works, and local dev/build (no env var set) still defaults to "/".
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    // browsercc's compiled glue code locates clang.wasm/lld.wasm/sysroot.tar
    // via `new URL("x", import.meta.url)` relative to its own file. Vite's
    // esbuild pre-bundling would move that glue code into .vite/deps/,
    // breaking those relative lookups (they resolve to a 404 that Vite's
    // dev-server SPA fallback serves as index.html instead). monaco-editor
    // has the same shape of issue (its own worker/asset URLs), so it's
    // excluded for the same reason.
    exclude: ["browsercc", "@bjorn3/browser_wasi_shim", "monaco-editor"],
    // pyodide doesn't have that problem (its runtime asset files are served
    // unbundled from public/pyodide/ via an explicit indexURL — see
    // src/worker/python-runtime.ts — rather than resolved relative to its
    // own module URL), so pre-bundling it is safe. Listing it here avoids a
    // dev-server-only hiccup: without this, Vite only discovers "pyodide"
    // the first time a worker imports it at runtime, forcing one
    // mid-session re-optimize + page reload.
    include: ["pyodide"],
  },
});
