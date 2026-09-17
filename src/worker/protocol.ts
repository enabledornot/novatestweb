/** Shared message protocol every per-language grading worker implements. */

export type GradingWorkerRequest = {
  files: Record<string, string>;
  tests: { id: string; stdin: string }[];
};

export type GradingWorkerMessage =
  | { type: "compile_error"; compileOutput: string }
  | { type: "compile_ok" }
  | { type: "test_start"; id: string }
  | { type: "test_result"; id: string; stdout: string; stderr: string; timeMs: number }
  | { type: "done" }
  | { type: "fatal_error"; message: string };
