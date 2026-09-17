import { compileC } from "./c-compiler";
import { runModule } from "./c-run";
import type { GradingWorkerMessage, GradingWorkerRequest } from "./protocol";

function post(msg: GradingWorkerMessage) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = async (event: MessageEvent<GradingWorkerRequest>) => {
  const { files, tests } = event.data;
  try {
    // Compiled once and reused for every test. Each test still starts from
    // a clean slate — a fresh WebAssembly instance and fresh WASI file
    // descriptors per run — without paying to recompile; the compiled
    // module itself never changes between tests.
    const { compileOutput, module } = await compileC(files);
    if (!module) {
      post({ type: "compile_error", compileOutput });
      return;
    }
    post({ type: "compile_ok" });

    for (const test of tests) {
      post({ type: "test_start", id: test.id });
      const start = performance.now();
      const { stdout, stderr } = runModule(module, test.stdin);
      post({ type: "test_result", id: test.id, stdout, stderr, timeMs: performance.now() - start });
    }
    post({ type: "done" });
  } catch (err) {
    post({ type: "fatal_error", message: err instanceof Error ? err.message : String(err) });
  }
};
