import { checkSyntax, runEntry } from "./python-runtime";
import { detectPythonEntryPoint } from "../grading/entry-point";
import type { GradingWorkerMessage, GradingWorkerRequest } from "./protocol";

function post(msg: GradingWorkerMessage) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = async (event: MessageEvent<GradingWorkerRequest>) => {
  const { files, tests } = event.data;
  try {
    const entry = detectPythonEntryPoint(files);
    if (entry.status !== "ok") {
      post({
        type: "compile_error",
        compileOutput:
          entry.status === "not_found"
            ? "No Python entry point found (no .py file)."
            : `Multiple candidate entry files: ${entry.files.join(", ")}`,
      });
      return;
    }

    const syntax = await checkSyntax(files, entry.file);
    if (!syntax.ok) {
      post({ type: "compile_error", compileOutput: syntax.message });
      return;
    }
    post({ type: "compile_ok" });

    for (const test of tests) {
      post({ type: "test_start", id: test.id });
      const start = performance.now();
      const { stdout, stderr } = await runEntry(files, entry.file, test.stdin);
      post({ type: "test_result", id: test.id, stdout, stderr, timeMs: performance.now() - start });
    }
    post({ type: "done" });
  } catch (err) {
    post({ type: "fatal_error", message: err instanceof Error ? err.message : String(err) });
  }
};
