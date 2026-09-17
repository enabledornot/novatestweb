# Design Description Document — Framework, Libraries, Extensibility

> Companion to `SPEC.md`. That document defines *what* the tool does; this
> one covers *what it's built with* and *why* — the framework choice, the
> third-party components we lean on instead of writing ourselves, and the
> architecture that lets Python/Java slot in later without a rewrite.
> Everything here still targets **static hosting only** (§2 of SPEC.md) —
> every library below is a pure client-side, browser-executable dependency;
> none of them assume a server.

## 1. Framework evaluation

**Current state:** vanilla TypeScript + Vite, hand-rolled DOM string
templates re-rendered on every state change (`src/main.ts`). That was fine
for a one-screen proof of concept. It stops being fine once the app has
three real views (single-submission test, instructor authoring, bulk
evaluator), file trees, a code editor, forms, and a results table — that's
enough moving state that manual re-rendering turns into its own
maintenance burden, and it forecloses using the component libraries this
document recommends (nearly all of them assume a component framework).

**Recommendation: move to React + Vite + TypeScript.**

| Framework | Ecosystem fit for this app | Notes |
|---|---|---|
| **React** (recommended) | Largest ecosystem, by a wide margin, specifically for the components this app needs: in-browser code editors, file trees, drag-drop uploaders, data tables, dev-tool-style UI kits. Most of the "don't build this yourself" pieces below have a first-class, actively maintained React integration. | Official Vite template (`react-ts`) — same workflow you already know. No SSR involved; builds to static files exactly like the current setup. |
| Vue | Comparable maturity, and Vite itself comes from the Vue ecosystem (Evan You). A perfectly reasonable alternative. | Thinner selection of ready-made components for *this specific* domain (in-browser IDE-like tooling skews heavily React in practice), meaning more assembly-required. |
| Svelte (plain, not SvelteKit) | Smallest runtime overhead, compiles away most framework code. | Ecosystem for our specific needs (Monaco integration, tree views) is noticeably thinner. Bundle savings don't matter much here anyway — the C toolchain alone is ~95MB; a few hundred KB of framework is noise. |
| SolidJS | Fast, small, React-like JSX. | Ecosystem still small; would mean writing more glue code ourselves, which cuts against "lean on existing tools." |
| Vanilla (status quo) | No framework tax. | Doesn't scale past one view without reinventing state/diffing, and locks out virtually every component library below. |

React wins here specifically because of the *lean on existing tools*
requirement — for an in-browser dev-tool UI, that ecosystem is the deepest.
It costs nothing towards the static-hosting requirement: `vite build`
produces the same kind of static `dist/` either way.

## 2. Components to use instead of building our own

Per your instruction: none of these get hand-rolled.

### Code viewer / editor — **Monaco Editor**, via `@monaco-editor/react`
- This is the actual editor VS Code (and LeetCode) uses — closest match to
  "much like LeetCode" of any option.
- One component serves both needs: a read-only, syntax-highlighted viewer
  (student/reference/bulk-drilldown file panes, §11.1/§11.2/§11.3 of
  SPEC.md) and an editable surface (instructor pasting in a reference
  solution, or a student editing in-browser instead of uploading).
- Built-in language support for C, Python, and Java out of the box — no
  separate grammar/highlighter package needed as Python/Java are added.
- Cost: ~2–5MB bundle. Irrelevant next to the ~95MB C toolchain already
  shipped; not a reason to pick anything else.
- **Must be self-hosted, not CDN-loaded.** `@monaco-editor/react` defaults
  to fetching Monaco from a CDN, which conflicts with this project's
  "pin exact versions, never pull latest" principle (SPEC.md §4, rule 2) —
  the same reasoning that pins Pyodide/CheerpJ/the C toolchain applies
  here. Configure its loader to point at a locally bundled copy (e.g. via
  `vite-plugin-monaco-editor` or manually vendoring the worker files)
  instead of the default CDN path.
- Lighter alternative if bundle size ever becomes a real constraint:
  **CodeMirror 6** (~300KB modular vs Monaco's several MB) — noted here in
  case Monaco turns out to be overkill in practice, but Monaco is the
  default recommendation given the explicit LeetCode reference point.

### File tree — **react-arborist**
- MIT-licensed, actively maintained, virtualized (handles large submission
  trees without perf issues), drag/drop and inline-rename included if
  ever needed (e.g. an instructor reorganizing package files while
  authoring).
- Takes plain `{id, children}`-shaped data — no backend assumption, feeds
  directly from the in-browser zip/folder listing.

### Zip extraction & creation — **fflate**
- Assignment packages, submissions, and Brightspace bulk exports (SPEC.md
  §11) all arrive/leave as zips.
- Chosen over the more famous **JSZip** because it's purpose-built for the
  browser: ~8KB min, offloads decompression to a worker thread (fits this
  project's worker-heavy architecture instead of fighting it), and
  benchmarks meaningfully faster. JSZip remains a fine fallback if its
  more "folder object" ergonomics end up mattering more than the size/perf
  difference — worth a quick spike either way before committing, since
  fflate's API is lower-level (raw paths + `Uint8Array`s, no folder
  object).

### Folder upload — native `<input type="file" webkitdirectory>`
- No library needed; it's a browser API, already the plan in SPEC.md §6.
- Optional nicety: **react-dropzone** for a drag-and-drop zone around the
  native input (purely UX sugar, not required for function).

### Cross-view state — **Zustand**
- The single-submission view, authoring view, and bulk evaluator all need
  to share some state (current package, current runner results) without
  prop-drilling through three view trees.
- Zustand over Redux/Context: a few lines to define a store, no
  boilerplate, no provider-wrapping ceremony — appropriately small for an
  MVP-sized app.

### Routing between the three views — **React Router, in hash mode**
- Hash-based routing (`/#/authoring`, `/#/bulk`) needs no server rewrite
  rules, which matters because we don't control the static host and can't
  assume it supports SPA fallback routing (some do, some — like plain
  GitHub Pages serving from a subpath — don't without extra config).
- If the three views never need to be independently bookmarkable/linkable,
  a plain in-memory view switch (no router library) is simpler and equally
  valid — don't add the dependency until a real need for shareable URLs
  shows up.

### Bulk-evaluator report table — **TanStack Table** (when that view gets built)
- Sorting/filtering a per-student score table is exactly what it's for;
  no reason to hand-roll table state management.

### Instructor test-authoring forms — **react-hook-form** (when that view gets built)
- Small, uncontrolled-input-based, avoids re-render storms on a form with
  several per-test fields (stdin, expected output, points, visibility,
  comparison mode) repeated across a growing test list.

None of the above changes the static-hosting story: every one is a
pure-JS/browser library with no server component, same as Pyodide/CheerpJ/
browsercc already are.

## 3. Multi-language extensibility

Right now only C exists. The goal is that adding Python or Java later is
additive — new files plugged into a registry — not a refactor of the
grading engine or UI.

**Already language-agnostic** (no change needed when Python/Java land):
- `src/grading/types.ts` — `Manifest.language` is already a discriminated
  field; extending its union (`"c" | "python" | "java"`) is additive.
- `src/grading/compare.ts`, `run-grading.ts` — operate purely on
  stdin/stdout text and worker messages; nothing C-specific in them.
- The core run contract from SPEC.md's original brief —
  `{language, files, stdin, limits} -> {stdout, stderr, status, timeMs}` —
  already language-agnostic by design.

**Not yet generalized** (currently hardcoded to C, needs a registry once a
second language is added):
- `src/worker/grading.worker.ts` currently imports `compileC`/`runModule`
  directly. This should become a lookup: given `manifest.language`, resolve
  the matching compile/run implementation.
- Entry-point detection (SPEC.md §11.4) is per-language by nature (grep for
  `main(` in C; heuristics in Python; scan for
  `public static void main` in Java) and needs the same kind of registry.
- Monaco's `language` prop (for syntax highlighting) needs to be derived
  from the manifest's language rather than hardcoded to `"c"`.

**Planned shape**, one entry per language, added when that language is
actually built (not speculatively now — this is the seam, not the
implementation):

```ts
type LanguageRunner = {
  id: "c" | "python" | "java";
  monacoLanguageId: string;              // "c" | "python" | "java" — Monaco already knows all three
  fileExtensions: string[];              // e.g. [".c", ".h"]
  detectEntryPoint(files: Record<string, string>): EntryPointResult;
  workerUrl: URL;                        // e.g. new URL("./c-runner.worker.ts", import.meta.url)
};

const LANGUAGE_RUNNERS: Record<string, LanguageRunner> = {
  c: cRunner,
  // python: pythonRunner,   // added when the Python slice is built
  // java: javaRunner,       // added when the Java slice is built
};
```

Each language's compiler/run/worker files keep living under
`src/worker/` with a per-language filename prefix (already the pattern:
`c-compiler.ts`, `c-run.ts`) — `python-compiler.ts` and
`python-runner.worker.ts` would slot in next to them unchanged in shape.
The UI (view components, file tree, Monaco instance) reads from
`LANGUAGE_RUNNERS[manifest.language]` rather than assuming C, which is the
one piece of current code (`grading.worker.ts`) that would need to change
when a second language actually arrives.

## 4. What this means for the current prototype

The `src/grading/*` logic (types, compare, export, orchestration) is
already framework-agnostic — none of it touches the DOM, so it survives a
React migration untouched. The only rewrite is the UI layer
(`src/main.ts`'s hand-rolled render loop) into React components consuming
the same underlying functions, plus wiring in Monaco/react-arborist/fflate
where the current prototype uses `<textarea>`/hardcoded sample data. This
document doesn't commit to a build order for that migration — that's a
follow-up planning step once you confirm this direction.

## 5. Open decisions carried forward

- **fflate vs JSZip** — leaning fflate (size/perf/worker-friendliness), but
  worth a short spike against real zip structures (assignment packages,
  Brightspace exports) before locking it in, since fflate's lower-level API
  costs some ergonomics.
- **Monaco self-hosting mechanics** — needs a concrete Vite config spike
  (worker files, language service workers) before the code-viewer work
  starts, same category of risk as the browsercc dev-server asset issue
  already hit once in this project.
- **Router vs no router** — deferred until it's clear whether the three
  views need bookmarkable URLs.
