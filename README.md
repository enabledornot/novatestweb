# CodeBench

A fully client-side code evaluation and grading tool for intro CS courses.
Students and instructors upload a submission and a grading package to a
static web page; compilation and execution happen entirely in the browser
(Web Workers + WebAssembly) — no server, no backend, nothing to host beyond
static files.

See [`SPEC.md`](./SPEC.md) for the full design brief and
[`DESIGN.md`](./DESIGN.md) for the framework/library choices and
extensibility architecture.

## Stack

- Vite + React + TypeScript
- **C**: [browsercc](https://github.com/BertalanD/browsercc) (Clang/LLVM → WASM) via [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim)
- **Python**: [Pyodide](https://pyodide.org)
- Monaco Editor, react-arborist (file tree), react-hook-form, fflate (zip), react-router-dom (hash routing)

Everything above is self-hosted — no CDN dependency, no external requests at
runtime.

## Development

```sh
npm install
npm run dev       # dev server
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

## Deployment

Static output only — `dist/` can be served from any static host. A GitHub
Actions workflow (`.github/workflows/deploy.yml`) builds and deploys to
GitHub Pages automatically on push to `main`; see that file for the one
manual step (enabling Pages in the repo's Settings → Pages → Source →
GitHub Actions).
