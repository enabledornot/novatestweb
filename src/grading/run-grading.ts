import type { GradingPackage, GradeResult, TestOutcome } from "./types";
import { compareOutput } from "./compare";
import { getLanguageRunner } from "../languages/registry";
import type { GradingWorkerMessage, GradingWorkerRequest } from "../worker/protocol";

const COMPILE_TIMEOUT_MS = 15000;

/**
 * Compiles the merged package+student files once and runs every test case
 * against the result, in a single Web Worker. A runaway test (e.g. an
 * infinite loop) is caught by watching the gap since the worker's last
 * message: once it exceeds that test's own time limit, the whole worker
 * is killed outright — terminating the worker is the only way to stop an
 * infinite loop, since there's no cooperative way to interrupt one. Tests
 * that never got to run are reported as "timeout", not silently dropped.
 */
export function gradeSubmission(
  pkg: GradingPackage,
  studentFiles: Record<string, string>,
): Promise<GradeResult> {
  const tests = pkg.manifest.tests;
  const pointsPossible = tests.reduce((sum, t) => sum + t.points, 0);

  return new Promise((resolve) => {
    const collision = Object.keys(studentFiles).find((name) => name in pkg.files);
    if (collision) {
      resolve({
        status: "error",
        compileOutput: `submission file "${collision}" collides with a package-supplied file`,
        outcomes: [],
        pointsEarned: 0,
        pointsPossible,
      });
      return;
    }

    const files = { ...pkg.files, ...studentFiles };
    const runner = getLanguageRunner(pkg.manifest.language);

    const violations = runner.checkAllowlist(files, pkg.manifest.allowedConstructs);
    if (violations.length > 0) {
      resolve({
        status: "compile_error",
        compileOutput: violations.map((v) => `${v.file}: disallowed ${v.construct}`).join("\n"),
        outcomes: tests.map((t) => ({
          id: t.id,
          name: t.name,
          visibility: t.visibility,
          points: t.points,
          pointsEarned: 0,
          status: "error",
          stdout: "",
          stderr: "",
          timeMs: 0,
        })),
        pointsEarned: 0,
        pointsPossible,
      });
      return;
    }

    const outcomes = new Map<string, TestOutcome>();
    let compileOutput = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const worker = runner.workerUrl();

    const finish = (status: GradeResult["status"]) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      worker.terminate();

      const fallbackStatus: TestOutcome["status"] =
        status === "compile_error" ? "error" : status === "timeout" ? "timeout" : "error";
      for (const test of tests) {
        if (!outcomes.has(test.id)) {
          outcomes.set(test.id, {
            id: test.id,
            name: test.name,
            visibility: test.visibility,
            points: test.points,
            pointsEarned: 0,
            status: fallbackStatus,
            stdout: "",
            stderr: "",
            timeMs: 0,
          });
        }
      }

      const orderedOutcomes = tests.map((t) => outcomes.get(t.id)!);
      resolve({
        status,
        compileOutput,
        outcomes: orderedOutcomes,
        pointsEarned: orderedOutcomes.reduce((sum, o) => sum + o.pointsEarned, 0),
        pointsPossible,
      });
    };

    const resetTimer = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => finish("timeout"), ms);
    };

    worker.onmessage = (event: MessageEvent<GradingWorkerMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "compile_error":
          compileOutput = msg.compileOutput;
          finish("compile_error");
          break;
        case "compile_ok":
          break;
        case "test_start": {
          const test = tests.find((t) => t.id === msg.id)!;
          resetTimer(test.timeMs);
          break;
        }
        case "test_result": {
          if (timer) clearTimeout(timer);
          timer = null;
          const test = tests.find((t) => t.id === msg.id)!;
          const passed = compareOutput(test.comparison, msg.stdout, test.expectedOutput);
          outcomes.set(test.id, {
            id: test.id,
            name: test.name,
            visibility: test.visibility,
            points: test.points,
            pointsEarned: passed ? test.points : 0,
            status: passed ? "pass" : "fail",
            stdout: msg.stdout,
            stderr: msg.stderr,
            timeMs: msg.timeMs,
          });
          break;
        }
        case "done":
          finish("graded");
          break;
        case "fatal_error":
          compileOutput = msg.message;
          finish("error");
          break;
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      compileOutput = event.message;
      finish("error");
    };

    resetTimer(COMPILE_TIMEOUT_MS);
    const req: GradingWorkerRequest = { files, tests: tests.map((t) => ({ id: t.id, stdin: t.stdin })) };
    worker.postMessage(req);
  });
}
