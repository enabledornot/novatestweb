import { loadPyodide, type PyodideInterface } from "pyodide";

const SUBMISSION_DIR = "/home/pyodide";

// Pyodide's runtime files live in public/pyodide/, served as plain static
// assets rather than bundled — Pyodide locates them by string
// concatenation (`indexURL + "pyodide.asm.wasm"`) at runtime, not an
// import Vite's asset pipeline can rewrite. This also pins the exact
// Pyodide build the app ships with: nothing is ever fetched from a CDN
// that could quietly serve a different version to different people.
let pyodidePromise: Promise<PyodideInterface> | null = null;
function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    // self.location.origin anchors this to the page's actual origin — a
    // Worker's relative URLs otherwise resolve against its own script
    // location (nested under assets/), not the page's. Combined with
    // import.meta.env.BASE_URL, this finds public/pyodide/ correctly
    // whether the app is served from the domain root or a GitHub Pages
    // project subpath.
    const indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, self.location.origin).href;
    pyodidePromise = loadPyodide({ indexURL });
  }
  return pyodidePromise;
}

function mountFiles(pyodide: PyodideInterface, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    const path = `${SUBMISSION_DIR}/${name}`;
    // Every parent directory is created before its file is written: a
    // folder-uploaded submission always has at least one level of nesting
    // (the browser prefixes every path with the picked folder's own
    // name), and FS.writeFile requires the directory to already exist.
    const dir = path.split("/").slice(0, -1).join("/");
    pyodide.FS.mkdirTree(dir);
    pyodide.FS.writeFile(path, content);
  }
}

export type SyntaxCheckResult = { ok: true } | { ok: false; message: string };

/** Compiles (but doesn't execute) the entry file, to catch syntax errors up front. */
export async function checkSyntax(files: Record<string, string>, entryFile: string): Promise<SyntaxCheckResult> {
  const pyodide = await getPyodide();
  mountFiles(pyodide, files);
  try {
    await pyodide.runPythonAsync(
      `compile(open(${JSON.stringify(`${SUBMISSION_DIR}/${entryFile}`)}).read(), ${JSON.stringify(entryFile)}, "exec")`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export type RunOutcome = { stdout: string; stderr: string };

export async function runEntry(files: Record<string, string>, entryFile: string, stdin: string): Promise<RunOutcome> {
  const pyodide = await getPyodide();
  mountFiles(pyodide, files);

  let stdout = "";
  let stderr = "";
  pyodide.setStdout({ batched: (s) => (stdout += s + "\n") });
  pyodide.setStderr({ batched: (s) => (stderr += s + "\n") });
  let stdinSent = false;
  pyodide.setStdin({ stdin: () => (stdinSent ? null : ((stdinSent = true), stdin)) });

  // Each test run gets a clean slate without paying for a fresh WASM
  // instance (unlike C): modules cached from a previous run of this
  // submission are dropped, and the script executes in a fresh globals
  // namespace, so a variable set while handling test 1 can't leak into
  // test 2's result.
  //
  // The entry file's own directory is also added to sys.path — the same
  // thing a real Python interpreter does automatically for any script run
  // directly (`python some/dir/main.py` puts `some/dir` at sys.path[0]).
  // This is what lets a submission's sibling modules import each other.
  const entryDirSuffix = entryFile.split("/").slice(0, -1).join("/");
  const entryDir = entryDirSuffix ? `${SUBMISSION_DIR}/${entryDirSuffix}` : SUBMISSION_DIR;
  await pyodide.runPythonAsync(`
import sys
_entry_dir = ${JSON.stringify(entryDir)}
if _entry_dir not in sys.path:
    sys.path.insert(0, _entry_dir)
for _name in list(sys.modules):
    _mod = sys.modules[_name]
    _file = getattr(_mod, "__file__", None)
    if _file and _file.startswith(${JSON.stringify(SUBMISSION_DIR)}):
        del sys.modules[_name]
`);

  const freshGlobals = pyodide.toPy({ __name__: "__main__" });
  try {
    const source = pyodide.FS.readFile(`${SUBMISSION_DIR}/${entryFile}`, { encoding: "utf8" }) as string;
    await pyodide.runPythonAsync(source, { globals: freshGlobals });
  } catch (err) {
    stderr += (err instanceof Error ? err.message : String(err)) + "\n";
  } finally {
    freshGlobals.destroy();
  }
  return { stdout, stderr };
}
