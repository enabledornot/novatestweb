# Browser-Based Code Evaluation Tool — Project Spec

> Handoff brief. This document is self-contained: it captures the full design
> so a fresh Claude Code session can start building without prior context.
> Suggested placement: repo root as `SPEC.md` (or `CLAUDE.md`).

## 1. What we're building

A **generic, fully client-side code evaluation tool** for introductory CS
courses. Students upload a submission and a **grading package** to a static web
page; the code compiles and runs **entirely in the browser**, and the tool
reports pass/fail against the package's test cases. Instructors use the **same
tool** with the full package to inform grading.

Target languages: **Python, Java, and C.**

## 2. Hard requirements

- **Static hosting only.** No server-side code execution. The host serves
  files (HTML/JS/WASM/assets); everything runs in the visitor's browser.
- **Arbitrary code.** Students write the code, so the tool must compile/run
  arbitrary source in each language (not just pre-prepared binaries).
- **Two audiences, one tool.** Students self-check; instructors evaluate. The
  in-browser result is **NOT an authoritative grade** — it's feedback and an
  input to the instructor's own graded run. It must be **decently consistent**:
  the same submission + package must produce the same verdict for student and
  instructor.
- **Intro-level scope.** Feature use can be restricted; no advanced techniques
  expected. Lean on this to keep runtimes small and improve safety/consistency.
- **Load time is acceptable;** individual submissions should run reasonably
  quickly once loaded.

## 3. Architecture decision

**Fully client-side execution using per-language WASM runtimes.** The browser +
WebAssembly sandbox already provides isolation (no filesystem, network, or host
access unless explicitly granted), so untrusted student code never touches any
infrastructure we own. We do **not** build a sandbox and do **not** run a
backend.

### Chosen stack (default)
- **Python:** [Pyodide](https://pyodide.org) — CPython compiled to WASM; runs
  arbitrary source directly. Restrict available modules/builtins to the course
  subset.
- **Java:** [CheerpJ](https://cheerpj.com) — OpenJDK JVM in WASM. Compile
  student `.java` in-browser by running `javac` (itself Java bytecode), then run.
- **C:** [browsercc](https://github.com/BertalanD/browsercc) (clang/LLVM → WASI
  wasm) executed via
  [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim).
  This is the highest-risk piece — **spike it first** to confirm feasibility,
  size, and multi-file linking before committing to full scope.

### Alternatives considered (documented, not chosen)
- **container2wasm (`c2w`)** — Docker image → WASM blob; real `gcc`/`javac`/
  `python3` via CPU emulation. Open source (Apache-2.0). Heavy downloads
  (~90–140MB images), experimental. Reconsider **only** if the language set
  becomes open-ended or assignments rely on makefiles/build systems.
- **CheerpX / WebVM** — full Debian via x86→WASM JIT. Real toolchains but
  ⚠️ CheerpX is proprietary (commercial license for organizational use).
- **Judge0 (server-side)** — rejected because it requires a backend. Keep in
  mind only if authoritative server-side grading is ever needed.

## 4. Core design principles (apply to every runtime)

1. **Run each submission in a Web Worker.** Isolation boundary + the ability to
   `worker.terminate()` a runaway program. This is the primary timeout/
   infinite-loop enforcement mechanism.
2. **Pin exact runtime versions.** Serve one fixed Pyodide build, one fixed
   CheerpJ version, one fixed C toolchain. Never pull "latest" — version drift
   between a student's cached build and the instructor's breaks consistency.
3. **Never grade on wall-clock time or performance.** Timing varies by machine/
   browser and is the main source of disagreement. Use timeouts only to kill
   runaway code, never as a scoring signal.
4. **Forgiving output comparison.** Support exact match, whitespace-tolerant
   match (ignore trailing whitespace / blank-line differences / case where
   appropriate), and regex match — chosen per test in the manifest. (Modeled on
   Moodle CodeRunner's grader types.)
5. **Reset the virtual filesystem between runs.** Start each submission from a
   clean copy of the package + the fresh submission. No state leaks between runs.
6. **Separate student files from package files** in the VFS (different dirs) so
   submissions can't clobber the harness and so hidden files stay out of the
   student build.
7. **Feature allowlists.** Enforce permitted imports (Python), includes (C), and
   language constructs at the harness level — improves both safety and
   consistency.

## 5. The grading package

A single bundle (zip) authored by the instructor, containing a **manifest** plus
tests, expected outputs, and any support files.

- **Author once, export two.** Author a master package with every test flagged
  `public` or `hidden`; a build/export step strips `hidden` items to produce the
  **student distribution**. (Model: UC Berkeley's Otter-Grader.)
- **Confidentiality by non-distribution.** A client-side tool can never hide
  file contents from the browser running it. Hidden tests stay confidential
  **only** because they are never shipped in the student package — not because
  of any runtime protection. Encryption/obfuscation cannot fix this.
- **Precompute expected outputs at authoring time.** Ship expected outputs, NOT
  the instructor's reference solution (which would be exposed to whoever runs it).
- Tampering with one's own student package only corrupts a non-authoritative
  self-check; the instructor grades with their own trusted package.

### Manifest (to be finalized — starting shape)
JSON or YAML describing:
- `language` and pinned runtime version
- per-test: `stdin`, `expected_output`, `points`, `visibility` (public/hidden),
  `comparison` (exact | whitespace | regex)
- limits: `time_limit`, `memory_limit`
- allowed imports/includes/constructs
- **file layout:** which files are student-supplied vs package-supplied, the
  **entry point** (main class / main source / module to run), compile command,
  and include/classpath additions

> Multi-file support is the main driver of the manifest's file-layout fields —
> design the schema around it from the start.

## 6. Multi-file handling

Every runtime exposes a virtual filesystem (VFS). Multi-file = write all files
into the VFS at correct paths, then invoke build/run. Two file sets per run:
student submission + instructor package.

- **Python:** write files into a dir on `sys.path`; cross-module imports work;
  packages need a dir + `__init__.py`. Pyodide can unpack a zip straight into
  the FS.
- **Java:** write `.java` tree mirroring packages into CheerpJ's VFS; compile
  with `javac` (list all sources, or compile the entry class with `-sourcepath`
  to pull in referenced sources); run the main class with a classpath including
  student classes + test classes + any JUnit JAR. Public class name must match
  filename → manifest names the entry class.
- **C:** write all `.c`/`.h` into the VFS; compile+link translation units in one
  clang invocation (`clang a.c b.c -o prog`) or compile-to-objects then link;
  headers resolve via include path. Makefiles/build systems are the point where
  the per-language approach strains → full-Linux territory.
- **Uploads:** accept a zip (unpack preserving relative paths) or a directory
  upload via `<input webkitdirectory>`.

## 7. Consistency & security notes

- Emulation/interpretation is deterministic in output → verdicts are stable
  across machines; only timing varies (hence rule #3).
- Memory limits in-browser are coarser than server cgroups; cap WASM linear
  memory where possible, but `worker.terminate()` is the real backstop.
- No fork/threads/raw sockets by default — a safety feature for intro use.
- If interactive stdin is needed, blocking reads in a worker require
  SharedArrayBuffer + Atomics → cross-origin isolation (COOP/COEP headers),
  which some static hosts (e.g. plain GitHub Pages) can't set. For batch grading,
  feed all stdin up front and avoid this.
- ⚠️ CheerpJ licensing: the free community license loads the runtime from
  CheerpJ's CDN; **self-hosting the runtime requires a commercial license.**
  Resolve this before committing to a fully self-contained static deploy of the
  Java path.

## 8. Suggested build order

1. **Python harness first.** Web Worker + pinned Pyodide + VFS mount of uploaded
   files + run against a list of test cases with a timeout + pass/fail report.
   This proves the whole architecture end to end (worker, timeout, FS, capture,
   compare, manifest parsing).
2. **Manifest schema + package format + public/hidden export step.**
3. **Java via CheerpJ** (compile with `javac`, run, classpath for multi-file).
4. **C via browsercc + browser_wasi_shim** — do a feasibility spike early
   (ideally in parallel with step 1) since it's the riskiest piece.
5. UI polish: editor (CodeMirror/Monaco), upload flows, results display.

## 9. Open questions to resolve

- Manifest format: JSON or YAML? Finalize field names.
- ~~Test representation~~ **Resolved: stdin/stdout pairs only.** A test gives
  stdin and an expected-output string; grading runs the submission's compiled
  entry point with that stdin and compares captured stdout against the
  expected text (exact / whitespace-tolerant / regex, per test). No unit-test
  framework, no inspecting function return values or program internals — the
  program is a black box that reads stdin and writes stdout. This applies
  whether the submission's own `main` does the I/O directly, or (for
  assignments needing package-supplied support code) a package-supplied file
  provides `main` and calls into student-submitted functions — either way the
  compiled result is graded the same way, from the outside.
- Is the language set truly fixed at Python/Java/C, or expected to grow? (Drives
  per-language-runtime vs full-Linux decision.)
- ~~CheerpJ self-hosting licensing decision.~~ **Resolved: Java is not
  implemented.** CheerpJ is effectively the only option for compiling/running
  arbitrary Java in-browser, and its free Community License requires loading
  the runtime from their CDN (`cjrtnc.leaningtech.com`) — self-hosting needs
  a paid Commercial License (per-application, pricing not public, requires
  contacting their sales team). Both options conflict with this project's
  "no external requests" principle, and the paid option is a real cost/legal
  decision outside a coding session's scope. C and Python are implemented;
  the `LanguageRunner` registry (`src/languages/registry.ts`) already has an
  empty, documented slot for Java if this changes later (a self-hostable
  alternative appears, or the license cost becomes worth it).
- Which static host (affects ability to set COOP/COEP headers)?
- **Brightspace export format**: the bulk evaluator (§11.3) needs the exact
  zip/folder/filename structure of a Brightspace (D2L) bulk-download-
  submissions export, confirmed against a real sample — don't guess at the
  naming convention before building the extractor. **Partially addressed:**
  the current extractor sidesteps this by not parsing D2L's filename
  convention at all — it treats each top-level file/folder in the bulk zip
  as one submission (see `src/grading/bulk-extract.ts`), which is safe
  regardless of the exact (institution-configurable) naming format, but
  still hasn't been checked against a real Brightspace export.
- Submission upload: support zip upload, folder upload (`<input
  webkitdirectory>`), or both, for the single-submission view (§11.1)?
  **Resolved: both** — implemented in `src/components/SubmissionUpload.tsx`.
- Bulk-run performance: for a class-sized batch (dozens of submissions ×
  several tests each), is running submissions one at a time acceptable for
  the first version, or does it need a bounded worker pool / progress bar
  from the start? **Resolved for now: sequential** (`src/grading/bulk-run.ts`)
  — revisit if real-world testing shows it's too slow.

## 10. Reference projects

- **Otter-Grader** — packaging model (portable instructor package + student
  client for public checks): https://github.com/ucbds-infra/otter-grader
- **Moodle CodeRunner** — grader types, per-question limits, allowed/disallowed
  constructs (design reference): https://trampgeek.github.io/moodle-qtype_coderunner/
- **browsercc** — C/C++ → WASI in browser: https://github.com/BertalanD/browsercc
- **browser_wasi_shim** — run WASI wasm in browser:
  https://github.com/bjorn3/browser_wasi_shim
- **container2wasm** — container → WASM (fallback full-Linux option):
  https://github.com/container2wasm/container2wasm
- **Carleton CSS code-questions** — prior art doing the same Pyodide/CheerpJ/
  Judge0 evaluation:
  https://github.com/CarletonComputerScienceSociety/code-questions-test/issues/3

## 11. Application structure & workflows

Three views/pages, all client-side, all built on the same underlying
compile/run/compare engine (§3-§7):

### 11.1 Single-submission test view (default / landing page)

The self-check / single-grading experience.

- Two upload slots:
  - **Assignment package** — a zip: the manifest + test cases + (for
    students) whatever package-supplied files that assignment needs, per §5
    — i.e. the *student distribution* produced by stripping hidden tests
    from the instructor's master package.
  - **Submission** — the student's code, as a zip or a folder upload.
- On upload, the tool:
  1. Unpacks the assignment zip and reads the manifest (learns `language`,
     package files, and the test list).
  2. Unpacks the submission and locates the program's entry point for that
     language (§11.4).
  3. On success, shows a file-tree + read-only, syntax-highlighted code
     viewer of the submission (LeetCode-style: file list alongside a source
     pane — §11.5), and the list of test cases from the manifest.
  4. A **Run** action compiles/links the submission (plus any package
     files) once and runs it against every test case in the manifest,
     reporting pass/fail, points, and captured stdout/stderr/errors per
     test — the same result model already implemented in `src/grading/`.
- Since the assignment zip a student receives is already the hidden-stripped
  student distribution, the tool doesn't need to hide anything further at
  runtime — there's nothing hidden left to leak (§5's "confidentiality by
  non-distribution" carries through to this UI unchanged).

### 11.2 Instructor authoring view

Where a manifest test suite gets built and sanity-checked, not hand-written
as raw JSON.

- Form-driven test authoring: name, stdin, expected output, comparison mode,
  points, and visibility (public/hidden) per test, added to a working
  manifest.
- **Reference implementation check**: the instructor uploads/pastes their
  own solution through the *same* upload-and-viewer flow as §11.1, runs it
  against the tests being authored, and inspects the actual output next to
  the expected output for each one — confirming the reference solution
  really produces what each test claims it should, before anything ships to
  students. This is the primary defense against a manifest with a wrong
  `expected_output`.
- Produces two artifacts on export: the full instructor package (every
  test) and the student distribution (hidden tests stripped — the
  `exportStudentPackage` transform already implemented), matching the
  "author once, export two" model from §5.

### 11.3 Bulk evaluator view

For grading a whole class's submissions at once. Not linked from the
landing page — reached via a separate route/tab.

- Instructor uploads one Brightspace (D2L) bulk-download zip for an
  assignment.
- The tool extracts each student's individual submission from that
  export into separate in-memory submissions (extraction logic depends on
  confirming Brightspace's actual export structure — open question, §9).
- A **Run all** action runs every extracted submission against the full
  (instructor) manifest — sequentially for the first version unless testing
  shows that's too slow for a realistic class size (§9).
- Results aren't rendered inline on the run screen by default; a summary
  (student name/ID, score, pass/fail counts) links through to a per-student
  view reusing the same file-tree/code-viewer + test-results UI from §11.1,
  so instructors can inspect any individual submission's source and output
  without leaving the report.

### 11.4 Entry-point detection

Before a submission can be compiled, the tool must find its entry point —
distinct per language:

- **C**: search all `.c` files in the submission for a function matching
  `int main(` (or `void main(`). Compilation already links every `.c` file
  in the submission together (§6), so this step is really "confirm exactly
  one file defines `main`" — which doubles as an early, clear rejection for
  a submission with no `main` or more than one.
- **Python** (once the Python runtime lands): no single canonical entry
  marker; the manifest likely needs to name the entry module/file directly,
  falling back to an `if __name__ == "__main__":` heuristic if it doesn't.
- **Java** (once CheerpJ lands): search for
  `public static void main(String[] args)`; since multiple submitted files
  could each define a `main`, the manifest should name the entry class
  explicitly rather than relying purely on detection.

### 11.5 Code viewer

One component, reused across §11.1 (student submission), §11.2 (instructor's
reference implementation), and §11.3 (per-student drill-down): a file tree
next to a read-only, syntax-highlighted source pane for whichever file is
selected. Needs a lightweight syntax-highlighting editor component —
CodeMirror was already the named candidate in §8 step 5.

---

### First task for Claude Code (suggested)

Scaffold the Python slice from step 8.1: a static page that loads a **pinned**
Pyodide in a **Web Worker**, mounts an uploaded file (and any package files) into
the VFS, runs the submission against a list of `{stdin, expected_output,
comparison}` test cases with a configurable timeout (terminating the worker on
overrun), and renders per-test pass/fail. Keep the runner runtime-agnostic behind
a `{language, source, files, stdin, limits} -> {stdout, stderr, status, time}`
interface so Java and C runners can slot in later.
